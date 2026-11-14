import base64
import hashlib
import re
import uuid
from typing import AsyncGenerator
from urllib.parse import urlsplit

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from backend.app.content.storage_adapter import storage_adapter
from backend.app.database.session import async_engine, get_db, set_rls_context
from backend.app.main import app


@pytest.fixture
async def day8_client() -> AsyncGenerator[tuple[AsyncClient, object], None]:
    async with async_engine.connect() as connection:
        outer_transaction = await connection.begin()

        async def override_get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
            await connection.execute(text("RESET ROLE"))
            async with AsyncSession(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            ) as session:
                user_id = getattr(request.state, "user_id", None)
                tenant_id = getattr(request.state, "tenant_id", None)
                tenant_header = request.headers.get("X-Tenant-ID")
                if tenant_id is None and tenant_header:
                    tenant_id = uuid.UUID(tenant_header)
                await set_rls_context(session, user_id=user_id, tenant_id=tenant_id)
                yield session

        app.dependency_overrides[get_db] = override_get_db
        client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        try:
            yield client, connection
        finally:
            await client.aclose()
            app.dependency_overrides.pop(get_db, None)
            await outer_transaction.rollback()


async def register_student(client: AsyncClient, label: str) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"day8-{label}-{uuid.uuid4().hex[:12]}@example.com",
            "password": "Day8-Strong-Password-27!",
            "full_name": f"Day 8 {label}",
            "device_id": str(uuid.uuid4()),
            "device_name": f"Day 8 {label} Device",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_day8_download_grant_and_resumable_range(day8_client, tmp_path, monkeypatch):
    client, _ = day8_client
    registration = await register_student(client, "download")
    auth_headers = {"Authorization": f"Bearer {registration['access_token']}"}

    resources_response = await client.get(
        "/api/v1/courses/1/resources",
        headers=auth_headers,
    )
    assert resources_response.status_code == 200, resources_response.text
    past_exam = next(
        item
        for item in resources_response.json()["resources"]
        if item["type"] == "PAST_EXAM"
    )

    idempotency_headers = {
        **auth_headers,
        "Idempotency-Key": f"day8-{uuid.uuid4()}",
    }
    grant_response = await client.post(
        f"/api/v1/resources/{past_exam['resource_id']}/download-grant",
        headers=idempotency_headers,
        json={"device_id": registration["device_id"]},
    )
    assert grant_response.status_code == 200, grant_response.text
    grant = grant_response.json()
    assert grant["resource_id"] == past_exam["resource_id"]
    assert grant["package_id"]
    assert grant["file_size_bytes"] == past_exam["file_size_bytes"]
    assert re.fullmatch(r"[0-9a-f]{64}", grant["sha256_checksum"])
    assert len(base64.b64decode(grant["ephemeral_aes_key_b64"])) == 32
    assert grant["license_expires_at"]

    replay_response = await client.post(
        f"/api/v1/resources/{past_exam['resource_id']}/download-grant",
        headers=idempotency_headers,
        json={"device_id": registration["device_id"]},
    )
    assert replay_response.status_code == 200, replay_response.text
    assert replay_response.json()["grant_id"] == grant["grant_id"]

    monkeypatch.setattr(storage_adapter, "local_root", tmp_path)
    expected = bytes(range(256)) * 8
    object_key = f"day8-tests/{uuid.uuid4()}.bin"
    storage_adapter.upload_encrypted_package("course-packages", object_key, expected)
    signed_url = storage_adapter.create_signed_download_url(
        "course-packages",
        object_key,
        expires_in=300,
    )
    parsed_url = urlsplit(signed_url)
    range_response = await client.get(
        f"{parsed_url.path}?{parsed_url.query}",
        headers={"Range": "bytes=0-1023"},
    )
    assert range_response.status_code == 206, range_response.text
    assert range_response.content == expected[:1024]
    assert range_response.headers["content-range"] == f"bytes 0-1023/{len(expected)}"
    assert range_response.headers["accept-ranges"] == "bytes"
    assert range_response.headers["content-length"] == "1024"
    assert hashlib.sha256(range_response.content).hexdigest() == hashlib.sha256(
        expected[:1024]
    ).hexdigest()


@pytest.mark.asyncio
async def test_day8_cross_tenant_resource_download_is_forbidden(day8_client):
    client, connection = day8_client
    owner = await register_student(client, "owner")
    other_user = await register_student(client, "other")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    other_headers = {"Authorization": f"Bearer {other_user['access_token']}"}

    owner_tenant_response = await client.post(
        "/api/v1/tenants",
        json={
            "organization_name": f"Day 8 Owner {uuid.uuid4().hex[:8]}",
            "slug": f"day8-owner-{uuid.uuid4().hex[:12]}",
        },
        headers=owner_headers,
    )
    other_tenant_response = await client.post(
        "/api/v1/tenants",
        json={
            "organization_name": f"Day 8 Other {uuid.uuid4().hex[:8]}",
            "slug": f"day8-other-{uuid.uuid4().hex[:12]}",
        },
        headers=other_headers,
    )
    assert owner_tenant_response.status_code == 201, owner_tenant_response.text
    assert other_tenant_response.status_code == 201, other_tenant_response.text
    owner_tenant_id = owner_tenant_response.json()["tenant_id"]
    other_tenant_id = other_tenant_response.json()["tenant_id"]
    resource_id = uuid.uuid4()

    await connection.execute(text("RESET ROLE"))
    await connection.execute(
        text(
            "SELECT set_config('app.current_user_id', '', true), "
            "set_config('app.current_tenant_id', '', true)"
        )
    )
    async with AsyncSession(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    ) as session:
        await session.execute(
            text(
                """
                INSERT INTO course_resources (
                    resource_id, course_id, tenant_id, type, title,
                    storage_bucket, storage_object_key, file_size_bytes,
                    sha256_checksum, is_offline_eligible, version, published_at
                ) VALUES (
                    :resource_id, 1, :tenant_id, 'LECTURE_NOTE', 'Private Day 8 Resource',
                    'course-packages', 'day8/private.bin', 12, repeat('a', 64),
                    TRUE, 1, now()
                )
                """
            ),
            {"resource_id": resource_id, "tenant_id": other_tenant_id},
        )
        await session.commit()

    denied_response = await client.post(
        f"/api/v1/resources/{resource_id}/download-grant",
        headers={
            **owner_headers,
            "X-Tenant-ID": owner_tenant_id,
        },
        json={"device_id": owner["device_id"]},
    )
    assert denied_response.status_code == 403, denied_response.text
    assert denied_response.json()["reason_code"] in {
        "ENTITLEMENT_REQUIRED",
        "RESOURCE_TENANT_MISMATCH",
    }

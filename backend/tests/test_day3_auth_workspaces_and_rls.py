import uuid
from typing import AsyncGenerator

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from backend.app.core.config import settings
from backend.app.database.session import async_engine, get_db, set_rls_context
from backend.app.main import app


@pytest.fixture
async def day3_client() -> AsyncGenerator[tuple[AsyncClient, object], None]:
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
        client = AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        )
        try:
            yield client, connection
        finally:
            await client.aclose()
            app.dependency_overrides.pop(get_db, None)
            await outer_transaction.rollback()


@pytest.mark.asyncio
async def test_day3_auth_workspaces_rls_and_catalog(day3_client):
    client, connection = day3_client
    unique = uuid.uuid4().hex[:12]
    password = "Day3-Strong-Password-27!"

    async def register_user(label: str):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"day3-{label}-{unique}@example.com",
                "password": password,
                "full_name": f"Day 3 {label}",
                "device_id": str(uuid.uuid4()),
                "device_name": f"Day 3 {label} Device",
            },
        )
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["offline_biometric_grant"]
        grant_claims = jwt.decode(
            data["offline_biometric_grant"],
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        assert grant_claims["type"] == "offline_biometric_grant"
        assert grant_claims["exp"] - grant_claims["iat"] == 7 * 24 * 60 * 60
        return data

    user_a = await register_user("alpha")
    user_b = await register_user("beta")
    user_c = await register_user("gamma")

    user_a_email = user_a["user"]["email"]
    device_a_id = user_a["device_id"]
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user_a_email,
            "password": password,
            "device_id": device_a_id,
            "device_name": "Updated Alpha Device",
            "os_version": "Android 15",
            "app_version": "1.0.0",
        },
    )
    assert login_response.status_code == 200, login_response.text
    login_data = login_response.json()
    initial_refresh = login_data["refresh_token"]
    access_claims = jwt.decode(
        login_data["access_token"],
        settings.JWT_SECRET_KEY,
        algorithms=["HS256"],
    )
    assert access_claims["exp"] - access_claims["iat"] == 15 * 60
    auth_a = {"Authorization": f"Bearer {login_data['access_token']}"}

    entitlement_response = await client.get(
        "/api/v1/me/entitlements",
        headers=auth_a,
    )
    assert entitlement_response.status_code == 200, entitlement_response.text
    assert entitlement_response.json()["offline_download_allowed"] is True
    assert entitlement_response.json()["storage_quota_mb"] == 2048
    assert entitlement_response.json()["ai_monthly_quota"] == 50
    assert entitlement_response.json()["offline_grace_days"] == 7
    assert jwt.decode(
        entitlement_response.json()["offline_grant"],
        settings.JWT_SECRET_KEY,
        algorithms=["HS256"],
    )["entitlements"]["offline_download_allowed"] is True

    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": initial_refresh, "device_id": device_a_id},
    )
    assert refresh_response.status_code == 200, refresh_response.text
    rotated_refresh = refresh_response.json()["refresh_token"]
    assert rotated_refresh != initial_refresh

    replay_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": initial_refresh, "device_id": device_a_id},
    )
    assert replay_response.status_code == 401
    assert "TOKEN_REUSE_DETECTED" in replay_response.json()["detail"]

    relogin_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user_a_email,
            "password": password,
            "device_id": device_a_id,
        },
    )
    assert relogin_response.status_code == 200, relogin_response.text
    auth_a = {"Authorization": f"Bearer {relogin_response.json()['access_token']}"}

    login_b = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user_b["user"]["email"],
            "password": password,
            "device_id": user_b["device_id"],
        },
    )
    assert login_b.status_code == 200, login_b.text
    auth_b = {"Authorization": f"Bearer {login_b.json()['access_token']}"}

    login_c = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user_c["user"]["email"],
            "password": password,
            "device_id": user_c["device_id"],
        },
    )
    assert login_c.status_code == 200, login_c.text
    auth_c = {"Authorization": f"Bearer {login_c.json()['access_token']}"}

    tenant_a_response = await client.post(
        "/api/v1/tenants",
        json={"organization_name": f"Day 3 Tenant Alpha {unique}", "slug": f"day3-a-{unique}"},
        headers=auth_a,
    )
    tenant_b_response = await client.post(
        "/api/v1/tenants",
        json={"organization_name": f"Day 3 Tenant Beta {unique}", "slug": f"day3-b-{unique}"},
        headers=auth_b,
    )
    assert tenant_a_response.status_code == 201, tenant_a_response.text
    assert tenant_b_response.status_code == 201, tenant_b_response.text
    tenant_a_id = tenant_a_response.json()["tenant_id"]
    tenant_b_id = tenant_b_response.json()["tenant_id"]

    invite_response = await client.post(
        f"/api/v1/tenants/{tenant_a_id}/invitations",
        json={"email": user_c["user"]["email"], "role": "STUDENT", "cohort_name": "2026"},
        headers=auth_a,
    )
    assert invite_response.status_code == 201, invite_response.text
    workspaces_c = await client.get("/api/v1/me/workspaces", headers=auth_c)
    assert workspaces_c.status_code == 200, workspaces_c.text
    assert any(
        item["tenant_id"] == tenant_a_id
        and item["cohort_name"] == "2026"
        for item in workspaces_c.json()["institutional_workspaces"]
    )

    await connection.execute(text("RESET ROLE"))
    await connection.execute(
        text(
            "SELECT set_config('app.current_user_id', '', true), "
            "set_config('app.current_tenant_id', '', true)"
        )
    )
    resource_a_id = uuid.uuid4()
    resource_b_id = uuid.uuid4()
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
                    sha256_checksum, is_offline_eligible, version
                ) VALUES
                    (:resource_a, 1, :tenant_a, 'LECTURE_NOTE', 'Alpha Private Resource',
                     'course-packages', 'day3/alpha.enc', 11, repeat('a', 64), TRUE, 1),
                    (:resource_b, 1, :tenant_b, 'LECTURE_NOTE', 'Beta Private Resource',
                     'course-packages', 'day3/beta.enc', 12, repeat('b', 64), TRUE, 1)
                """
            ),
            {
                "resource_a": resource_a_id,
                "tenant_a": tenant_a_id,
                "resource_b": resource_b_id,
                "tenant_b": tenant_b_id,
            },
        )
        await session.commit()

    resources_a = await client.get(
        "/api/v1/courses/1/resources",
        headers={**auth_a, "X-Tenant-ID": tenant_a_id},
    )
    assert resources_a.status_code == 200, resources_a.text
    resource_ids_a = {item["resource_id"] for item in resources_a.json()["resources"]}
    assert str(resource_a_id) in resource_ids_a
    assert str(resource_b_id) not in resource_ids_a

    resources_b = await client.get(
        "/api/v1/courses/1/resources",
        headers={**auth_b, "X-Tenant-ID": tenant_b_id},
    )
    assert resources_b.status_code == 200, resources_b.text
    resource_ids_b = {item["resource_id"] for item in resources_b.json()["resources"]}
    assert str(resource_b_id) in resource_ids_b
    assert str(resource_a_id) not in resource_ids_b

    denied_workspace = await client.get(
        "/api/v1/courses/1/resources",
        headers={**auth_b, "X-Tenant-ID": tenant_a_id},
    )
    assert denied_workspace.status_code == 403

    themes_response = await client.get("/api/v1/curriculum/themes")
    assert themes_response.status_code == 200, themes_response.text
    themes = themes_response.json()
    assert len(themes) == 5
    assert sum(theme["total_credit_hours"] for theme in themes) == 45
    assert sum(len(theme["courses"]) for theme in themes) == 15
    assert all("version" in course for theme in themes for course in theme["courses"])

    course_response = await client.get(
        "/api/v1/courses/1",
        headers={**auth_a, "X-Tenant-ID": tenant_a_id},
    )
    assert course_response.status_code == 200, course_response.text
    course_data = course_response.json()
    assert course_data["code"] == "IT-CMTS-101"
    assert course_data["learning_outcomes"]
    assert course_data["resource_count"] >= 1

    exams_response = await client.get(
        "/api/v1/exams?type=NATIONAL_EXIT_SIMULATION&difficulty=EASY",
        headers=auth_a,
    )
    assert exams_response.status_code == 200, exams_response.text
    hu_exam = next(
        (
            exam
            for exam in exams_response.json()
            if exam["title"]
            == "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)"
        ),
        None,
    )
    assert hu_exam is not None
    assert hu_exam["total_questions"] == 100

    new_device_id = str(uuid.uuid4())
    device_response = await client.post(
        "/api/v1/devices/register",
        json={
            "device_id": new_device_id,
            "device_name": "Secondary Day 3 Device",
            "os_version": "Android 15",
            "app_version": "1.0.0",
        },
        headers=auth_a,
    )
    assert device_response.status_code == 200, device_response.text
    revoke_device_response = await client.delete(
        f"/api/v1/devices/{new_device_id}",
        headers=auth_a,
    )
    assert revoke_device_response.status_code == 200, revoke_device_response.text

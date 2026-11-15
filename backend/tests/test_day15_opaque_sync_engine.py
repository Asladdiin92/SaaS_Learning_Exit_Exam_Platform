from datetime import datetime, timezone
from typing import AsyncGenerator
import uuid

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from backend.app.core.security import create_offline_grant
from backend.app.database.session import async_engine, get_db, set_rls_context
from backend.app.main import app
from backend.app.mobile_sync.router import _scope_key, decode_cursor, encode_cursor

HU_BLUEPRINT_TITLE = (
    "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)"
)


@pytest.fixture
async def day15_client() -> AsyncGenerator[tuple[AsyncClient, object], None]:
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


async def register_student(client: AsyncClient) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"day15-{uuid.uuid4().hex[:12]}@example.com",
            "password": "Day15-Strong-Password-27!",
            "full_name": "Day 15 Student",
            "device_id": str(uuid.uuid4()),
            "device_name": "Day 15 Sync Device",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_sync_pull_returns_incremental_ordered_changes_and_tombstones(day15_client):
    client, connection = day15_client
    registration = await register_student(client)
    user_id = uuid.UUID(registration["user"]["user_id"])
    entity_upsert = f"day15-upsert-{uuid.uuid4()}"
    entity_tombstone = f"day15-tombstone-{uuid.uuid4()}"
    await connection.execute(text("RESET ROLE"))
    baseline = await connection.execute(
        text("SELECT COALESCE(MAX(change_seq), 0) FROM sync_changes")
    )
    initial_cursor = encode_cursor(
        baseline.scalar_one(),
        _scope_key(user_id, None),
    )
    await connection.execute(
        text(
            """
            INSERT INTO sync_changes (
                tenant_id, user_id, entity_type, entity_id, operation, version, payload
            ) VALUES
                (NULL, NULL, 'day15-test', :upsert_id, 'UPSERT', 1, '{"value": 1}'),
                (NULL, NULL, 'day15-test', :tombstone_id, 'TOMBSTONE', 2, '{}')
            """
        ),
        {"upsert_id": entity_upsert, "tombstone_id": entity_tombstone},
    )
    headers = {"Authorization": f"Bearer {registration['access_token']}"}

    response = await client.get(
        f"/api/v1/sync/pull?cursor={initial_cursor}&limit=1",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    first_page = response.json()
    assert first_page["has_more"] is True
    second_response = await client.get(
        f"/api/v1/sync/pull?cursor={first_page['next_cursor']}&limit=1",
        headers=headers,
    )
    assert second_response.status_code == 200, second_response.text
    second_page = second_response.json()
    assert second_page["has_more"] is False
    items = first_page["changes"] + first_page["tombstones"]
    items += second_page["changes"] + second_page["tombstones"]
    assert {item["entity_id"] for item in items} == {
        entity_upsert,
        entity_tombstone,
    }
    sequences = [item["change_seq"] for item in items]
    assert sequences == sorted(sequences)
    assert decode_cursor(
        second_page["next_cursor"], _scope_key(user_id, None)
    ) >= sequences[-1]


@pytest.mark.asyncio
async def test_content_and_entitlement_triggers_append_upserts_and_tombstones(day15_client):
    client, connection = day15_client
    await connection.execute(text("RESET ROLE"))
    registration = await register_student(client)
    user_id = registration["user"]["user_id"]
    await connection.execute(text("RESET ROLE"))
    baseline = await connection.execute(
        text("SELECT COALESCE(MAX(change_seq), 0) FROM sync_changes")
    )
    baseline_sequence = baseline.scalar_one()

    await connection.execute(
        text("UPDATE courses SET version = version + 1 WHERE course_id = 1")
    )
    resource_id = await connection.scalar(
        text(
            "SELECT resource_id FROM course_resources "
            "WHERE published_at IS NOT NULL ORDER BY resource_id LIMIT 1"
        )
    )
    assert resource_id is not None
    await connection.execute(
        text(
            "UPDATE course_resources SET published_at = NULL "
            "WHERE resource_id = :resource_id"
        ),
        {"resource_id": resource_id},
    )
    exam_id = await connection.scalar(
        text("SELECT exam_id FROM exam_blueprints ORDER BY exam_id LIMIT 1")
    )
    assert exam_id is not None
    await connection.execute(
        text(
            "UPDATE exam_blueprints SET version = version + 1 WHERE exam_id = :exam_id"
        ),
        {"exam_id": exam_id},
    )
    entitlement_id = await connection.scalar(
        text(
            "SELECT entitlement_id FROM feature_entitlements "
            "WHERE user_id = :user_id AND revoked_at IS NULL LIMIT 1"
        ),
        {"user_id": user_id},
    )
    assert entitlement_id is not None
    await connection.execute(
        text(
            "UPDATE feature_entitlements SET revoked_at = CURRENT_TIMESTAMP "
            "WHERE entitlement_id = :entitlement_id"
        ),
        {"entitlement_id": entitlement_id},
    )

    changes = await connection.execute(
        text(
            """
            SELECT entity_type, entity_id, operation
            FROM sync_changes
            WHERE change_seq > :baseline
            ORDER BY change_seq
            """
        ),
        {"baseline": baseline_sequence},
    )
    actual = {
        (row["entity_type"], row["entity_id"], row["operation"])
        for row in changes.mappings().all()
    }
    assert ("course", "1", "UPSERT") in actual
    assert ("resource", str(resource_id), "TOMBSTONE") in actual
    assert ("exam_blueprint", str(exam_id), "UPSERT") in actual
    assert ("entitlement", str(entitlement_id), "TOMBSTONE") in actual


def test_sync_cursor_authenticates_signature_and_scope():
    scope = f"{uuid.uuid4()}:personal"
    cursor = encode_cursor(1234, scope)
    assert decode_cursor(cursor, scope) == 1234
    with pytest.raises(HTTPException):
        decode_cursor(cursor, f"{uuid.uuid4()}:personal")
    encoded_payload, encoded_signature = cursor.split(".", 1)
    tampered = f"{encoded_payload[:-1]}{'A' if encoded_payload[-1] != 'A' else 'B'}.{encoded_signature}"
    with pytest.raises(HTTPException):
        decode_cursor(tampered, scope)


@pytest.mark.asyncio
async def test_push_exam_attempt_is_scored_and_replay_is_idempotent(day15_client):
    client, connection = day15_client
    registration = await register_student(client)
    auth_headers = {"Authorization": f"Bearer {registration['access_token']}"}
    await connection.execute(text("RESET ROLE"))
    blueprint_result = await connection.execute(
        text(
            """
            SELECT exam_id, version FROM exam_blueprints
            WHERE title = :title
            """
        ),
        {"title": HU_BLUEPRINT_TITLE},
    )
    exam_id, blueprint_version = blueprint_result.one()
    question_result = await connection.execute(
        text(
            """
            SELECT q.question_id, qo.option_id
            FROM questions q
            JOIN question_options qo
              ON qo.question_id = q.question_id AND qo.is_correct = TRUE
            WHERE q.is_published = TRUE AND q.question_text LIKE '**[Q%'
            ORDER BY q.created_at, q.question_id
            """
        )
    )
    answers = [
        {"question_id": str(question_id), "selected_option_id": str(option_id), "sequence_no": 1}
        for question_id, option_id in question_result.all()
    ]
    assert len(answers) >= 100
    answers = answers[:100]

    operation_id = uuid.uuid4()
    local_attempt_id = uuid.uuid4()
    offline_grant = create_offline_grant(
        uuid.UUID(registration["user"]["user_id"]),
        uuid.UUID(registration["device_id"]),
    )
    operation = {
        "operation_id": str(operation_id),
        "type": "exam_attempt.submit",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "exam_id": str(exam_id),
            "local_attempt_id": str(local_attempt_id),
            "exam_package_id": "pkg_hu_cci_model_exit_2023",
            "blueprint_version": blueprint_version,
            "offline_grant": offline_grant,
            "answers": answers,
        },
    }
    request_payload = {
        "device_id": registration["device_id"],
        "operations": [operation],
    }
    responses = []
    for _ in range(3):
        response = await client.post(
            "/api/v1/sync/push",
            headers=auth_headers,
            json=request_payload,
        )
        assert response.status_code == 200, response.text
        responses.append(response.json())

    accepted = responses[0]["accepted"]
    assert len(accepted) == 1
    assert accepted[0]["operation_id"] == str(operation_id)
    assert accepted[0]["result"]["status"] == "SCORED"
    assert accepted[0]["result"]["correct_count"] == 100
    assert accepted[0]["result"]["score_percent"] == 100.0
    assert all(result == responses[0] for result in responses[1:])

    await connection.execute(text("RESET ROLE"))
    count_result = await connection.execute(
        text(
            """
            SELECT COUNT(*)
            FROM exam_attempts
            WHERE user_id = :user_id AND client_operation_id = :operation_id
            """
        ),
        {
            "user_id": registration["user"]["user_id"],
            "operation_id": str(operation_id),
        },
    )
    assert count_result.scalar_one() == 1


@pytest.mark.asyncio
async def test_bookmark_push_merges_by_field_version_and_status_recovers_result(day15_client):
    client, _ = day15_client
    registration = await register_student(client)
    auth_headers = {"Authorization": f"Bearer {registration['access_token']}"}
    operation_id = str(uuid.uuid4())
    request_payload = {
        "device_id": registration["device_id"],
        "operations": [
            {
                "operation_id": operation_id,
                "type": "bookmark.upsert",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "bookmark_key": "course:1:resource:chapter-1",
                    "version": 1,
                    "fields": {"position": 20, "note": "first"},
                    "field_versions": {"position": 2, "note": 1},
                },
            }
        ],
    }
    first = await client.post(
        "/api/v1/sync/push", headers=auth_headers, json=request_payload
    )
    assert first.status_code == 200, first.text
    operation = request_payload["operations"][0]
    operation["operation_id"] = str(uuid.uuid4())
    operation["payload"] = {
        "bookmark_key": "course:1:resource:chapter-1",
        "version": 2,
        "fields": {"position": 5, "note": "newer"},
        "field_versions": {"position": 1, "note": 3},
    }
    second = await client.post(
        "/api/v1/sync/push", headers=auth_headers, json=request_payload
    )
    assert second.status_code == 200, second.text
    assert second.json()["accepted"][0]["result"]["fields"] == {
        "position": 20,
        "note": "newer",
    }

    status_response = await client.get(
        f"/api/v1/sync/status?operation_ids={operation_id},{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert status_response.status_code == 200, status_response.text
    statuses = status_response.json()["operations"]
    assert statuses[0]["status"] == "ACCEPTED"
    assert statuses[0]["result"] == first.json()["accepted"][0]["result"]
    assert statuses[1]["status"] == "NOT_FOUND"

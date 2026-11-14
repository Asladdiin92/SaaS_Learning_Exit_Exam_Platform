from typing import AsyncGenerator
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from backend.app.database.session import async_engine, get_db, set_rls_context
from backend.app.main import app

HU_BLUEPRINT_TITLE = (
    "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)"
)


@pytest.fixture
async def day12_client() -> AsyncGenerator[tuple[AsyncClient, object], None]:
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
            "email": f"day12-{uuid.uuid4().hex[:12]}@example.com",
            "password": "Day12-Strong-Password-27!",
            "full_name": "Day 12 Student",
            "device_id": str(uuid.uuid4()),
            "device_name": "Day 12 Test Device",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def get_hu_exam_id(connection) -> uuid.UUID:
    await connection.execute(text("RESET ROLE"))
    result = await connection.execute(
        text("SELECT exam_id FROM exam_blueprints WHERE title = :title"),
        {"title": HU_BLUEPRINT_TITLE},
    )
    exam_id = result.scalar_one_or_none()
    assert exam_id is not None, "HU Model Exit Exam blueprint must be seeded before Day 12 tests."
    return exam_id


async def start_hu_attempt(
    client: AsyncClient,
    connection,
    registration: dict,
    idempotency_key: str | None = None,
):
    exam_id = await get_hu_exam_id(connection)
    headers = {
        "Authorization": f"Bearer {registration['access_token']}",
        "Idempotency-Key": idempotency_key or str(uuid.uuid4()),
    }
    response = await client.post(
        f"/api/v1/exams/{exam_id}/attempts",
        headers=headers,
        json={
            "device_id": registration["device_id"],
            "mode": "ONLINE",
        },
    )
    assert response.status_code == 201, response.text
    return response


@pytest.mark.asyncio
async def test_hu_attempt_locks_100_questions_and_hides_answer_key(day12_client):
    client, connection = day12_client
    registration = await register_student(client)
    response = await start_hu_attempt(client, connection, registration)
    payload = response.json()

    assert payload["total_questions"] == 100
    assert len(payload["question_snapshots"]) == 100
    assert all("explanation" not in question for question in payload["question_snapshots"])
    assert all(
        "is_correct" not in option
        for question in payload["question_snapshots"]
        for option in question["options"]
    )

    stored = await connection.execute(
        text(
            "SELECT question_snapshots FROM exam_attempts WHERE attempt_id = :attempt_id"
        ),
        {"attempt_id": payload["attempt_id"]},
    )
    locked_snapshot = stored.scalar_one()
    assert len(locked_snapshot) == 100
    assert all("explanation" in question for question in locked_snapshot)
    assert all(
        "is_correct" in option
        for question in locked_snapshot
        for option in question["options"]
    )


@pytest.mark.asyncio
async def test_question_edits_do_not_change_snapshot_or_server_score(day12_client):
    client, connection = day12_client
    registration = await register_student(client)
    start_response = await start_hu_attempt(client, connection, registration)
    start_payload = start_response.json()
    attempt_id = start_payload["attempt_id"]

    stored = await connection.execute(
        text(
            "SELECT question_snapshots FROM exam_attempts WHERE attempt_id = :attempt_id"
        ),
        {"attempt_id": attempt_id},
    )
    locked_snapshot = stored.scalar_one()
    first_question = locked_snapshot[0]
    correct_option = next(
        option for option in first_question["options"] if option["is_correct"]
    )

    await connection.execute(text("RESET ROLE"))
    await connection.execute(
        text(
            "UPDATE questions SET question_text = 'Edited after attempt start' "
            "WHERE question_id = :question_id"
        ),
        {"question_id": first_question["question_id"]},
    )
    await connection.execute(
        text(
            "UPDATE question_options SET is_correct = FALSE "
            "WHERE option_id = :option_id"
        ),
        {"option_id": correct_option["option_id"]},
    )

    operation_id = str(uuid.uuid4())
    submitted = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers={
            "Authorization": f"Bearer {registration['access_token']}",
            "Idempotency-Key": operation_id,
        },
        json={
            "operation_id": operation_id,
            "answers": [
                {
                    "question_id": question["question_id"],
                    "selected_option_id": next(
                        option["option_id"]
                        for option in question["options"]
                        if option["is_correct"]
                    ),
                    "sequence_no": 1,
                }
                for question in locked_snapshot
            ],
        },
    )
    assert submitted.status_code == 200, submitted.text
    result = submitted.json()
    assert result["status"] == "SCORED"
    assert result["correct_count"] == 100
    assert result["score_percent"] == 100.0
    assert result["review_items"][0]["is_correct"] is True
    assert result["review_items"][0]["explanation"] == first_question["explanation"]

    after_edit = await connection.execute(
        text(
            "SELECT question_snapshots FROM exam_attempts WHERE attempt_id = :attempt_id"
        ),
        {"attempt_id": attempt_id},
    )
    assert after_edit.scalar_one() == locked_snapshot


@pytest.mark.asyncio
async def test_repeated_submit_returns_identical_scored_result(day12_client):
    client, connection = day12_client
    registration = await register_student(client)
    start_response = await start_hu_attempt(client, connection, registration)
    attempt = start_response.json()

    stored = await connection.execute(
        text(
            "SELECT question_snapshots FROM exam_attempts WHERE attempt_id = :attempt_id"
        ),
        {"attempt_id": attempt["attempt_id"]},
    )
    locked_snapshot = stored.scalar_one()
    body = {
        "operation_id": str(uuid.uuid4()),
        "answers": [
            {
                "question_id": question["question_id"],
                "selected_option_id": next(
                    option["option_id"]
                    for option in question["options"]
                    if option["is_correct"]
                ),
                "sequence_no": 1,
            }
            for question in locked_snapshot
        ],
    }
    headers = {
        "Authorization": f"Bearer {registration['access_token']}",
        "Idempotency-Key": body["operation_id"],
    }

    first_response = await client.post(
        f"/api/v1/attempts/{attempt['attempt_id']}/submit",
        headers=headers,
        json=body,
    )
    second_response = await client.post(
        f"/api/v1/attempts/{attempt['attempt_id']}/submit",
        headers=headers,
        json=body,
    )
    assert first_response.status_code == 200, first_response.text
    assert second_response.status_code == 200, second_response.text
    assert second_response.json() == first_response.json()


@pytest.mark.asyncio
async def test_answer_endpoint_rejects_client_supplied_correctness(day12_client):
    client, connection = day12_client
    registration = await register_student(client)
    start_response = await start_hu_attempt(client, connection, registration)
    attempt = start_response.json()
    question = attempt["question_snapshots"][0]

    response = await client.post(
        f"/api/v1/attempts/{attempt['attempt_id']}/answers",
        headers={"Authorization": f"Bearer {registration['access_token']}"},
        json={
            "question_id": question["question_id"],
            "selected_option_id": question["options"][0]["option_id"],
            "is_correct": True,
        },
    )
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_attempt_and_answer_upserts_are_idempotent_and_sequence_ordered(day12_client):
    client, connection = day12_client
    registration = await register_student(client)
    start_key = str(uuid.uuid4())
    first_start = await start_hu_attempt(client, connection, registration, start_key)
    replay_start = await start_hu_attempt(client, connection, registration, start_key)
    attempt = first_start.json()
    assert replay_start.json()["attempt_id"] == attempt["attempt_id"]

    stored = await connection.execute(
        text(
            "SELECT question_snapshots FROM exam_attempts WHERE attempt_id = :attempt_id"
        ),
        {"attempt_id": attempt["attempt_id"]},
    )
    question = stored.scalar_one()[0]
    correct_option_id = next(
        option["option_id"] for option in question["options"] if option["is_correct"]
    )
    wrong_option_id = next(
        option["option_id"] for option in question["options"] if not option["is_correct"]
    )
    auth_headers = {"Authorization": f"Bearer {registration['access_token']}"}

    first_answer = await client.post(
        f"/api/v1/attempts/{attempt['attempt_id']}/answers",
        headers=auth_headers,
        json={
            "question_id": question["question_id"],
            "selected_option_id": wrong_option_id,
            "sequence_no": 1,
        },
    )
    later_answer = await client.post(
        f"/api/v1/attempts/{attempt['attempt_id']}/answers",
        headers=auth_headers,
        json={
            "question_id": question["question_id"],
            "selected_option_id": correct_option_id,
            "sequence_no": 2,
        },
    )
    assert first_answer.status_code == 200, first_answer.text
    assert later_answer.status_code == 200, later_answer.text

    operation_id = str(uuid.uuid4())
    result = await client.post(
        f"/api/v1/attempts/{attempt['attempt_id']}/submit",
        headers={**auth_headers, "Idempotency-Key": operation_id},
        json={"operation_id": operation_id, "answers": []},
    )
    assert result.status_code == 200, result.text
    assert result.json()["correct_count"] == 1

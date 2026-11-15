import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from backend.app.main import app
from backend.app.database.session import AsyncSessionLocal


@pytest.mark.asyncio
async def test_device_management_and_revocation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request should be rejected
        unauth_res = await client.get("/api/v1/devices")
        assert unauth_res.status_code == 401

        # 2. Register new student with device 1
        unique = uuid.uuid4().hex[:8]
        email = f"student_devices_{unique}@aau.edu.et"
        device1_id = str(uuid.uuid4())
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePassword123!",
                "full_name": f"Device Tester {unique}",
                "device_id": device1_id,
                "device_name": "Pixel 7 Pro",
                "os_version": "Android 14",
                "app_version": "1.0.0",
            },
        )
        assert reg_res.status_code == 201, reg_res.text
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. List active devices -> should have 1 device
        devices_res = await client.get("/api/v1/devices", headers=headers)
        assert devices_res.status_code == 200
        devices = devices_res.json()
        assert len(devices) == 1
        assert devices[0]["device_id"] == device1_id
        assert devices[0]["device_name"] == "Pixel 7 Pro"

        # 4. Register a second device
        device2_id = str(uuid.uuid4())
        dev2_res = await client.post(
            "/api/v1/devices/register",
            headers=headers,
            json={
                "device_id": device2_id,
                "device_name": "Samsung Galaxy Tab S8",
                "os_version": "Android 13",
                "app_version": "1.0.0",
            },
        )
        assert dev2_res.status_code == 200, dev2_res.text
        assert dev2_res.json()["device_id"] == device2_id

        # 5. List active devices -> should now have 2 devices
        devices_res2 = await client.get("/api/v1/devices", headers=headers)
        assert devices_res2.status_code == 200
        devices2 = devices_res2.json()
        assert len(devices2) == 2
        device_ids = [d["device_id"] for d in devices2]
        assert device1_id in device_ids
        assert device2_id in device_ids

        # 6. Revoke device 2 (DELETE /api/v1/devices/{device_id})
        del_res = await client.delete(f"/api/v1/devices/{device2_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "revoked"

        # 7. List active devices -> should now have only 1 active device
        devices_res3 = await client.get("/api/v1/devices", headers=headers)
        assert devices_res3.status_code == 200
        devices3 = devices_res3.json()
        assert len(devices3) == 1
        assert devices3[0]["device_id"] == device1_id


@pytest.mark.asyncio
async def test_ai_tutor_rag_and_remediation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register student
        unique = uuid.uuid4().hex[:8]
        email = f"student_ai_{unique}@aau.edu.et"
        device_id = str(uuid.uuid4())
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePassword123!",
                "full_name": f"AI Student {unique}",
                "device_id": device_id,
            },
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. General Course Concept Inquiry (MOB-08 flow)
        ai_res = await client.post(
            "/api/v1/ai/tutor/messages",
            headers=headers,
            json={
                "prompt": "Explain database normalization forms from 1NF to Boyce-Codd Normal Form (BCNF)",
                "course_id": 1,
            },
        )
        assert ai_res.status_code == 200, ai_res.text
        data = ai_res.json()
        assert "tutor_response" in data
        assert "concept_summary" in data
        assert "step_by_step_explanation" in data
        assert "citations" in data
        assert len(data["citations"]) >= 1
        assert data["remaining_monthly_quota"] >= 0

        # 3. Contextual Question Remediation (MOB-19 flow)
        # Fetch an existing question from the database
        async with AsyncSessionLocal() as session:
            q_res = await session.execute(
                text("SELECT question_id FROM questions ORDER BY question_id LIMIT 1")
            )
            row = q_res.first()
            question_id = str(row[0]) if row else None

        if question_id:
            ai_q_res = await client.post(
                "/api/v1/ai/tutor/messages",
                headers=headers,
                json={
                    "prompt": "Why is the correct option chosen over the other options?",
                    "question_id": question_id,
                },
            )
            assert ai_q_res.status_code == 200, ai_q_res.text
            q_data = ai_q_res.json()
            assert "tutor_response" in q_data
            assert "distractor_analysis" in q_data
            assert len(q_data["distractor_analysis"]) >= 1
            assert "citations" in q_data
            assert len(q_data["citations"]) >= 1
            assert "step_by_step_explanation" in q_data

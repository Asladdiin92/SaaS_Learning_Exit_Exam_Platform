import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.security import create_access_token


@pytest.mark.asyncio
async def test_get_course_resources_and_download_grant():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register a test student
        test_email = f"student_s3_{uuid.uuid4().hex[:8]}@hu.edu.et"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": test_email,
                "password": "SecurePassword123!",
                "full_name": "Slice 3 Student",
            },
        )
        assert reg_res.status_code == 201, reg_res.text
        registration = reg_res.json()
        token = registration["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 2. Query resources for Course 1 (IT-CMTS-101)
        res_list = await client.get("/api/v1/courses/1/resources", headers=auth_headers)
        assert res_list.status_code == 200, res_list.text
        data = res_list.json()
        assert data["course_id"] == 1
        assert data["total_resources"] >= 1
        past_exam = next((r for r in data["resources"] if r["type"] == "PAST_EXAM"), None)
        assert past_exam is not None, "Seeded past exam resource not found"
        resource_id = past_exam["resource_id"]
        assert past_exam["storage_bucket"] == "course-packages"
        assert past_exam["is_accessible"] is True

        # 3. Request Download Grant for the past exam
        grant_res = await client.post(
            f"/api/v1/resources/{resource_id}/download-grant",
            headers=auth_headers,
            json={"device_id": registration["device_id"]},
        )
        assert grant_res.status_code == 200, grant_res.text
        grant = grant_res.json()
        assert grant["resource_id"] == resource_id
        assert "download_url" in grant and len(grant["download_url"]) > 0
        assert "wrapped_aes_key" in grant and len(grant["wrapped_aes_key"]) == 64  # 32-byte hex HMAC
        assert "license_expiry" in grant
        assert "watermark" in grant
        assert grant["watermark"]["email"] == test_email
        assert "Slice 3 Student" in grant["watermark"]["formatted_watermark"]
        assert grant["sha256_checksum"] is not None


@pytest.mark.asyncio
async def test_download_grant_404_for_nonexistent_resource():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register a real user
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"user_{uuid.uuid4().hex[:8]}@hu.edu.et",
                "password": "SecurePassword123!",
                "full_name": "Test User",
            },
        )
        token = reg_res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        fake_resource_id = str(uuid.uuid4())
        res = await client.post(
            f"/api/v1/resources/{fake_resource_id}/download-grant",
            headers=auth_headers,
            json={},
        )
        assert res.status_code == 404

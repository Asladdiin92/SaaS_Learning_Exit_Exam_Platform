import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app

ADMIN_HEADER = {"X-Admin-Key": "asladin-platform-owner-master-key-2026"}


@pytest.mark.asyncio
async def test_admin_overview_and_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Overview KPIs
        res = await client.get("/api/v1/admin/overview", headers=ADMIN_HEADER)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "total_users" in data
        assert "total_courses" in data
        assert data["total_courses"] >= 15
        assert data["system_status"] == "HEALTHY"

        # 2. System Health Diagnostic
        health_res = await client.get("/api/v1/admin/system/health", headers=ADMIN_HEADER)
        assert health_res.status_code == 200, health_res.text
        health = health_res.json()
        assert health["status"] == "OPERATIONAL"
        assert "database" in health
        assert health["database"]["pooler_port"] == 6543


@pytest.mark.asyncio
async def test_admin_user_management_and_entitlement_grant():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List users
        users_res = await client.get("/api/v1/admin/users?limit=10", headers=ADMIN_HEADER)
        assert users_res.status_code == 200, users_res.text
        users = users_res.json()
        assert isinstance(users, list)
        assert len(users) >= 1

        target_user = users[0]
        user_id = target_user["user_id"]

        # 2. Get User Detail
        detail_res = await client.get(f"/api/v1/admin/users/{user_id}", headers=ADMIN_HEADER)
        assert detail_res.status_code == 200, detail_res.text
        detail = detail_res.json()
        assert detail["email"] == target_user["email"]
        assert "memberships" in detail
        assert "devices" in detail
        assert "entitlements" in detail

        # 3. Direct Manual Entitlement Grant by Platform Owner
        grant_res = await client.post(
            f"/api/v1/admin/users/{user_id}/entitlements",
            headers=ADMIN_HEADER,
            json={
                "offline_download_allowed": True,
                "storage_quota_mb": 4096,
                "ai_monthly_quota": 500,
                "valid_days": 60,
            },
        )
        assert grant_res.status_code == 200, grant_res.text
        grant_data = grant_res.json()
        assert "entitlement_id" in grant_data
        assert "valid_until" in grant_data


@pytest.mark.asyncio
async def test_admin_activity_logs_and_curriculum():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Activity Logs Feed
        logs_res = await client.get("/api/v1/admin/activity-logs?limit=25", headers=ADMIN_HEADER)
        assert logs_res.status_code == 200, logs_res.text
        logs = logs_res.json()
        assert isinstance(logs, list)

        # 2. Curriculum Courses List
        courses_res = await client.get("/api/v1/admin/curriculum/courses", headers=ADMIN_HEADER)
        assert courses_res.status_code == 200, courses_res.text
        courses = courses_res.json()
        assert len(courses) >= 15
        course_codes = [c["code"] for c in courses]
        assert "IT-CMTS-101" in course_codes
        assert "IT-IASC-401" in course_codes

        # 3. Products Catalog
        products_res = await client.get("/api/v1/admin/commerce/products", headers=ADMIN_HEADER)
        assert products_res.status_code == 200, products_res.text
        products = products_res.json()
        assert len(products) >= 5

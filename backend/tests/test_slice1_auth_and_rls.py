import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from backend.app.main import app
from backend.app.database.session import AsyncSessionLocal, set_rls_context


@pytest.mark.asyncio
async def test_auth_workflow_and_workspaces():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        unique_suffix = uuid.uuid4().hex[:8]
        email = f"student_{unique_suffix}@aau.edu.et"
        password = "SecurePassword123!"
        device_id = str(uuid.uuid4())

        # 1. Register User
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": f"Student {unique_suffix}",
                "device_id": device_id,
                "device_name": "Pixel 8 Pro",
            },
        )
        assert reg_resp.status_code == 201
        reg_data = reg_resp.json()
        assert "access_token" in reg_data
        assert "refresh_token" in reg_data
        assert reg_data["user"]["email"] == email

        # 2. Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": password,
                "device_id": device_id,
            },
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        access_token = login_data["access_token"]
        refresh_token = login_data["refresh_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        # 3. Rotate Refresh Token
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": refresh_token,
                "device_id": device_id,
            },
        )
        assert refresh_resp.status_code == 200
        refreshed_data = refresh_resp.json()
        new_access_token = refreshed_data["access_token"]
        new_refresh_token = refreshed_data["refresh_token"]
        assert new_refresh_token != refresh_token

        # Verify old refresh token is rejected and triggers token reuse revocation
        stale_refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": refresh_token,
                "device_id": device_id,
            },
        )
        assert stale_refresh_resp.status_code == 401
        assert "reuse detected" in stale_refresh_resp.json()["detail"].lower()

        # Re-login to get fresh active session
        relogin_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": password,
                "device_id": device_id,
            },
        )
        assert relogin_resp.status_code == 200
        auth_headers = {"Authorization": f"Bearer {relogin_resp.json()['access_token']}"}

        # 4. Check Workspaces (Initially Personal Workspace only)
        ws_resp = await client.get("/api/v1/me/workspaces", headers=auth_headers)
        assert ws_resp.status_code == 200
        ws_data = ws_resp.json()
        assert ws_data["personal_workspace"]["is_personal"] is True
        assert ws_data["personal_workspace"]["tenant_id"] is None
        assert len(ws_data["institutional_workspaces"]) == 0

        # 5. Create Institutional Tenant Workspace
        tenant_slug = f"aau-it-{unique_suffix}"
        create_tenant_resp = await client.post(
            "/api/v1/tenants",
            json={
                "organization_name": f"Addis Ababa University - {unique_suffix}",
                "slug": tenant_slug,
            },
            headers=auth_headers,
        )
        assert create_tenant_resp.status_code == 201
        tenant_id = create_tenant_resp.json()["tenant_id"]

        # 6. Verify Workspaces now lists both Personal and Institutional Workspaces
        ws_updated_resp = await client.get("/api/v1/me/workspaces", headers=auth_headers)
        assert ws_updated_resp.status_code == 200
        ws_updated_data = ws_updated_resp.json()
        assert ws_updated_data["personal_workspace"]["is_personal"] is True
        assert len(ws_updated_data["institutional_workspaces"]) == 1
        inst_ws = ws_updated_data["institutional_workspaces"][0]
        assert inst_ws["tenant_id"] == tenant_id
        assert inst_ws["role"] == "TENANT_ADMIN"

        # 7. Check Curriculum Themes and Courses
        themes_resp = await client.get("/api/v1/curriculum/themes")
        assert themes_resp.status_code == 200
        themes_data = themes_resp.json()
        assert len(themes_data) == 5
        total_hours = sum(t["total_credit_hours"] for t in themes_data)
        assert total_hours == 45

        # Check Course Details
        course_resp = await client.get("/api/v1/courses/1", headers=auth_headers)
        assert course_resp.status_code == 200
        course_data = course_resp.json()
        assert course_data["code"] == "IT-CMTS-101"
        assert len(course_data["outcomes"]) > 0

        # 8. Logout
        logout_resp = await client.post(
            "/api/v1/auth/logout",
            json={"device_id": device_id},
            headers=auth_headers,
        )
        assert logout_resp.status_code == 200


@pytest.mark.asyncio
async def test_cross_tenant_rls_isolation():
    """Proves that PostgreSQL Row-Level Security blocks Tenant A from reading Tenant B's records."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    async with AsyncSessionLocal() as session:
        # 1. Setup isolated tenants, users and resources directly in database
        await session.execute(
            text("""
            INSERT INTO tenants (tenant_id, organization_name, slug, status)
            VALUES 
                (:t_a, 'Tenant Alpha', :slug_a, 'ACTIVE'::tenant_status),
                (:t_b, 'Tenant Beta', :slug_b, 'ACTIVE'::tenant_status);
            """),
            {
                "t_a": tenant_a, "slug_a": f"tenant-alpha-{tenant_a.hex[:6]}",
                "t_b": tenant_b, "slug_b": f"tenant-beta-{tenant_b.hex[:6]}",
            },
        )
        await session.execute(
            text("""
            INSERT INTO users (user_id, email, password_hash, full_name)
            VALUES 
                (:u_a, :e_a, 'hash', 'User Alpha'),
                (:u_b, :e_b, 'hash', 'User Beta');
            """),
            {
                "u_a": user_a, "e_a": f"alpha-{user_a.hex[:6]}@test.com",
                "u_b": user_b, "e_b": f"beta-{user_b.hex[:6]}@test.com",
            },
        )
        # Insert a course resource for Tenant A and Tenant B
        res_a_id = uuid.uuid4()
        res_b_id = uuid.uuid4()
        await session.execute(
            text("""
            INSERT INTO course_resources (
                resource_id, course_id, tenant_id, type, title, storage_bucket, storage_object_key
            ) VALUES 
                (:res_a, 1, :t_a, 'LECTURE_NOTE'::resource_type, 'Tenant A Secret Document', 'course-packages', 'keys/a.enc'),
                (:res_b, 1, :t_b, 'LECTURE_NOTE'::resource_type, 'Tenant B Secret Document', 'course-packages', 'keys/b.enc');
            """),
            {"res_a": res_a_id, "t_a": tenant_a, "res_b": res_b_id, "t_b": tenant_b},
        )
        await session.commit()

    # 2. Test querying as Tenant A context
    async with AsyncSessionLocal() as session_a:
        await set_rls_context(session_a, user_id=user_a, tenant_id=tenant_a)
        result_a = await session_a.execute(
            text("SELECT resource_id, title FROM course_resources WHERE tenant_id IS NOT NULL")
        )
        rows_a = result_a.fetchall()
        tenant_a_resource_ids = [r[0] for r in rows_a]

        # Tenant A MUST see Resource A
        assert res_a_id in tenant_a_resource_ids
        # Tenant A MUST NOT see Resource B (Cross-Tenant RLS isolation)
        assert res_b_id not in tenant_a_resource_ids

    # 3. Test querying as Tenant B context
    async with AsyncSessionLocal() as session_b:
        await set_rls_context(session_b, user_id=user_b, tenant_id=tenant_b)
        result_b = await session_b.execute(
            text("SELECT resource_id, title FROM course_resources WHERE tenant_id IS NOT NULL")
        )
        rows_b = result_b.fetchall()
        tenant_b_resource_ids = [r[0] for r in rows_b]

        # Tenant B MUST see Resource B
        assert res_b_id in tenant_b_resource_ids
        # Tenant B MUST NOT see Resource A (Cross-Tenant RLS isolation)
        assert res_a_id not in tenant_b_resource_ids

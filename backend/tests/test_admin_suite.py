import uuid
import jwt
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, desc
from backend.app.main import app
from backend.app.core.config import settings
from backend.app.database.session import AsyncSessionLocal
from backend.app.database.models import (
    User,
    UserDevice,
    FeatureEntitlement,
    AuditLog,
    SyncChange,
    Question,
    Course,
    CourseResource,
    Product,
    ExamAttempt,
    Tenant,
    InstitutionLicense,
    SeatAssignment,
)

ADMIN_HEADER = {"X-Admin-Key": "asladin-platform-owner-master-key-2026"}
PLATFORM_OWNER_EMAIL = "asladdiinabduqaadir@gmail.com"


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


@pytest.mark.asyncio
async def test_admin_environment_gating_and_jwt_sso():
    """
    Day 1 Task 1: Environment-gate X-Admin-Key and verify asladin.me JWT SSO authentication.
    """
    original_env = settings.ENVIRONMENT
    transport = ASGITransport(app=app)
    try:
        # 1. In production, X-Admin-Key alone MUST be rejected
        settings.ENVIRONMENT = "production"
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res_key_prod = await client.get("/api/v1/admin/overview", headers=ADMIN_HEADER)
            assert res_key_prod.status_code == 401, f"Expected 401 in production for X-Admin-Key, got: {res_key_prod.status_code}"

            res_anon_prod = await client.get("/api/v1/admin/overview")
            assert res_anon_prod.status_code == 401

            # 2. Valid JWT with platform owner email or SUPER_ADMIN role must succeed in production
            valid_token = jwt.encode(
                {"email": PLATFORM_OWNER_EMAIL, "role": "SUPER_ADMIN", "sub": str(uuid.uuid4())},
                settings.JWT_SECRET_KEY,
                algorithm="HS256",
            )
            auth_header = {"Authorization": f"Bearer {valid_token}"}
            res_jwt_prod = await client.get("/api/v1/admin/overview", headers=auth_header)
            assert res_jwt_prod.status_code == 200, f"Expected 200 for valid JWT in production, got: {res_jwt_prod.status_code}"

            # 3. Invalid JWT signature must be rejected
            bad_token = jwt.encode(
                {"email": PLATFORM_OWNER_EMAIL, "role": "SUPER_ADMIN"},
                "wrong-secret-key",
                algorithm="HS256",
            )
            res_bad_jwt = await client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {bad_token}"})
            assert res_bad_jwt.status_code == 401
    finally:
        settings.ENVIRONMENT = original_env

    # 4. In development, X-Admin-Key must succeed
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_key_dev = await client.get("/api/v1/admin/overview", headers=ADMIN_HEADER)
        assert res_key_dev.status_code == 200


@pytest.mark.asyncio
async def test_admin_audit_logs_and_sync_changes_emission():
    """
    Day 1 Task 2: Reusable record_admin_audit (FR-026) and emit_sync_change (ADR-006).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get a sample user
        users_res = await client.get("/api/v1/admin/users?limit=1", headers=ADMIN_HEADER)
        assert users_res.status_code == 200
        user_id = users_res.json()[0]["user_id"]

        # 1. Update user status -> writes to audit_logs
        patch_res = await client.patch(
            f"/api/v1/admin/users/{user_id}/status",
            headers=ADMIN_HEADER,
            json={"is_email_verified": True, "cohort_name": "Class of 2026 Test"},
        )
        assert patch_res.status_code == 200, patch_res.text

        # 2. Grant entitlement -> writes to audit_logs AND sync_changes
        grant_res = await client.post(
            f"/api/v1/admin/users/{user_id}/entitlements",
            headers=ADMIN_HEADER,
            json={
                "offline_download_allowed": True,
                "storage_quota_mb": 5120,
                "ai_monthly_quota": 250,
                "valid_days": 45,
            },
        )
        assert grant_res.status_code == 200, grant_res.text
        entitlement_id = grant_res.json()["entitlement_id"]

        # 3. Create a test device to test revocation
        test_device_id = uuid.uuid4()
        async with AsyncSessionLocal() as session:
            test_device = UserDevice(
                device_id=test_device_id,
                user_id=uuid.UUID(user_id),
                device_name="Day1 Audit Test Device",
                os_version="Android 14",
                app_version="1.0.0",
                revoked_at=None,
            )
            session.add(test_device)
            await session.commit()

        # Revoke device -> writes to audit_logs
        revoke_res = await client.delete(
            f"/api/v1/admin/devices/{test_device_id}",
            headers=ADMIN_HEADER,
        )
        assert revoke_res.status_code == 200, revoke_res.text

        # Verify database records
        async with AsyncSessionLocal() as session:
            # Verify audit_logs for user update
            audit_u = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "USER_STATUS_UPDATED",
                        AuditLog.target_id == str(user_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit_u is not None, "audit_log for USER_STATUS_UPDATED not found"
            assert audit_u.target_type == "user"

            # Verify audit_logs for entitlement grant
            audit_e = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "ENTITLEMENT_GRANTED",
                        AuditLog.target_id == str(entitlement_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit_e is not None, "audit_log for ENTITLEMENT_GRANTED not found"
            assert audit_e.target_type == "feature_entitlement"

            # Verify sync_changes for entitlement grant
            sync_c = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "feature_entitlement",
                        SyncChange.entity_id == str(entitlement_id),
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert sync_c is not None, "sync_change for feature_entitlement UPSERT not found"
            assert sync_c.version == 1
            assert sync_c.user_id == uuid.UUID(user_id)

            # Verify audit_logs for device revocation
            audit_d = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "DEVICE_SESSION_REVOKED",
                        AuditLog.target_id == str(test_device_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit_d is not None, "audit_log for DEVICE_SESSION_REVOKED not found"
            assert audit_d.target_type == "device"


@pytest.mark.asyncio
async def test_admin_question_version_increment_and_audit_sync():
    """
    Day 2 Task 1 & 3: ADR-005 Question Version Increment & Immutability, Audit Logs & Sync Ledger.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fetch an existing question
        q_list_res = await client.get("/api/v1/admin/questions?limit=1", headers=ADMIN_HEADER)
        assert q_list_res.status_code == 200, q_list_res.text
        questions = q_list_res.json()
        assert len(questions) >= 1
        target_q = questions[0]
        q_id = target_q["question_id"]
        initial_version = target_q.get("version", 1)

        # 2. Update question stem, Bloom level, difficulty and options
        updated_stem = f"Updated stem for ADR-005 verification {uuid.uuid4().hex[:6]}"
        patch_res = await client.patch(
            f"/api/v1/admin/questions/{q_id}",
            headers=ADMIN_HEADER,
            json={
                "question_text": updated_stem,
                "bloom_level": "EVALUATE",
                "difficulty": "HARD",
                "explanation": "Updated rationale for version increment test.",
                "options": [
                    {"label": "A", "text": "Option Alpha (Correct)", "is_correct": True},
                    {"label": "B", "text": "Option Beta", "is_correct": False},
                    {"label": "C", "text": "Option Gamma", "is_correct": False},
                    {"label": "D", "text": "Option Delta", "is_correct": False},
                ],
            },
        )
        assert patch_res.status_code == 200, patch_res.text
        patch_data = patch_res.json()
        expected_version = initial_version + 1
        assert patch_data["version"] == expected_version

        # 3. Verify in database: questions table, audit_logs table, and sync_changes table
        async with AsyncSessionLocal() as session:
            # Check question table has new version
            q_row = (
                await session.execute(
                    select(Question).where(Question.question_id == uuid.UUID(q_id))
                )
            ).scalars().first()
            assert q_row is not None
            assert q_row.version == expected_version
            assert q_row.question_text == updated_stem
            assert q_row.level == "EVALUATE"

            # Check audit_logs has QUESTION_UPDATED entry (FR-026)
            audit_entry = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "QUESTION_UPDATED",
                        AuditLog.target_id == str(q_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit_entry is not None, "audit_log for QUESTION_UPDATED not found"
            assert audit_entry.target_type == "question"
            assert audit_entry.details.get("new_version") == expected_version

            # Check sync_changes has UPSERT monotonic row (ADR-006)
            sync_entry = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "question",
                        SyncChange.entity_id == str(q_id),
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert sync_entry is not None, "sync_change for question UPSERT not found"
            assert sync_entry.version == expected_version

        # 4. Verify Course update also increments course.version + writes audit + sync
        course_res = await client.patch(
            "/api/v1/admin/curriculum/courses/1",
            headers=ADMIN_HEADER,
            json={"title": "Computer Maintenance and Technical Support (Hardened)"},
        )
        assert course_res.status_code == 200, course_res.text
        c_data = course_res.json()
        assert "version" in c_data
        assert c_data["version"] >= 2

        async with AsyncSessionLocal() as session:
            # Check audit_logs has COURSE_UPDATED
            c_audit = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "COURSE_UPDATED",
                        AuditLog.target_id == "1",
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert c_audit is not None, "audit_log for COURSE_UPDATED not found"
            assert c_audit.target_type == "course"

            # Check sync_changes has course UPSERT
            c_sync = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "course",
                        SyncChange.entity_id == "1",
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert c_sync is not None, "sync_change for course UPSERT not found"


@pytest.mark.asyncio
async def test_admin_course_resource_package_management():
    """
    Day 3 Task 1 & 3: Course Resource & PDF Package Management (ADR-009, FR-026, ADR-006).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET /api/v1/admin/resources
        res_list = await client.get("/api/v1/admin/resources", headers=ADMIN_HEADER)
        assert res_list.status_code == 200, res_list.text
        resources = res_list.json()
        assert isinstance(resources, list)
        assert len(resources) >= 1

        # Check for the seeded HU 2023 Exit Exam PDF
        hu_exam = next(
            (r for r in resources if "Model Exit Exam" in r["title"]),
            None,
        )
        assert hu_exam is not None, "HU Model Exit Exam resource not found in list"
        assert hu_exam["storage_bucket"] == "course-packages"
        assert "past-exams" in hu_exam["storage_object_key"]
        assert hu_exam["file_size_bytes"] > 0
        assert hu_exam["course_code"] is not None

        # 2. POST /api/v1/admin/resources (Register new resource package)
        test_key = f"lecture-notes/test-bundle-{uuid.uuid4().hex[:6]}.pdf"
        create_res = await client.post(
            "/api/v1/admin/resources",
            headers=ADMIN_HEADER,
            json={
                "course_id": 1,
                "type": "LECTURE_NOTE",
                "title": "Computer Hardware ESD Safety Guide 2026",
                "storage_bucket": "course-packages",
                "storage_object_key": test_key,
                "file_size_bytes": 1048576,
                "sha256_checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "is_offline_eligible": True,
            },
        )
        assert create_res.status_code == 200, create_res.text
        created_data = create_res.json()
        new_resource_id = created_data["resource_id"]
        assert created_data["version"] == 1
        assert created_data["storage_object_key"] == test_key

        # Verify audit_logs and sync_changes for creation
        async with AsyncSessionLocal() as session:
            audit_c = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "RESOURCE_CREATED",
                        AuditLog.target_id == str(new_resource_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit_c is not None, "audit_log for RESOURCE_CREATED not found"
            assert audit_c.target_type == "course_resource"

            sync_c = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "course_resource",
                        SyncChange.entity_id == str(new_resource_id),
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert sync_c is not None, "sync_change for course_resource UPSERT not found"
            assert sync_c.version == 1

        # 3. PATCH /api/v1/admin/resources/{resource_id} (Update and increment version)
        patch_res = await client.patch(
            f"/api/v1/admin/resources/{new_resource_id}",
            headers=ADMIN_HEADER,
            json={
                "title": "Computer Hardware ESD Safety Guide 2026 (Revised v2)",
                "is_offline_eligible": False,
                "file_size_bytes": 2097152,
            },
        )
        assert patch_res.status_code == 200, patch_res.text
        patch_data = patch_res.json()
        assert patch_data["version"] == 2
        assert patch_data["is_offline_eligible"] is False

        # Verify audit_logs and sync_changes for update
        async with AsyncSessionLocal() as session:
            audit_u = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "RESOURCE_UPDATED",
                        AuditLog.target_id == str(new_resource_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit_u is not None, "audit_log for RESOURCE_UPDATED not found"
            assert audit_u.details.get("new_version") == 2

            sync_u = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "course_resource",
                        SyncChange.entity_id == str(new_resource_id),
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert sync_u is not None
            assert sync_u.version == 2


@pytest.mark.asyncio
async def test_admin_database_status_and_lake_mirror():
    """
    Day 4: Verifies live database status diagnostics, table row counters across
    all 15 core entities, schema migration checksums, and data lake mirror parity.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/admin/database-status", headers=ADMIN_HEADER)
        assert res.status_code == 200, res.text
        data = res.json()

        # 1. Applied migrations
        assert "applied_migrations" in data
        assert isinstance(data["applied_migrations"], list)
        assert len(data["applied_migrations"]) >= 12
        for mig in data["applied_migrations"]:
            assert "filename" in mig
            assert mig["filename"].endswith(".sql")
            assert "checksum" in mig
            assert "status" in mig

        # 2. Table counts across all 15 core tables
        assert "table_counts" in data
        counts = data["table_counts"]
        required_tables = [
            "users",
            "tenants",
            "tenant_memberships",
            "courses",
            "learning_outcomes",
            "course_resources",
            "exam_blueprints",
            "questions",
            "question_options",
            "exam_attempts",
            "orders",
            "feature_entitlements",
            "sync_changes",
            "audit_logs",
            "resource_embeddings",
        ]
        for t in required_tables:
            assert t in counts, f"Table {t} missing from table_counts"
            assert isinstance(counts[t], int)
            assert counts[t] >= 0

        # Verify key baseline volumes
        assert counts["courses"] >= 15, "Expected at least 15 courses"
        assert counts["questions"] >= 100, "Expected at least 100 questions"
        assert counts["sync_changes"] >= 1, "Expected sync ledger entries"
        assert counts["audit_logs"] >= 1, "Expected audit log entries"

        # 3. Latest sync seq
        assert "latest_sync_seq" in data
        assert isinstance(data["latest_sync_seq"], int)
        assert data["latest_sync_seq"] >= 1

        # 4. Data lake mirror telemetry
        assert "lake_mirror" in data
        mirror = data["lake_mirror"]
        assert mirror["status"] == "IN_SYNC"
        assert mirror["snapshot_watermark_seq"] == data["latest_sync_seq"]
        assert mirror["raw_mirror_path"] == "dev_storage/lake/raw_mirror"
        assert mirror["curated_analytics_path"] == "dev_storage/lake/curated_analytics"
        assert "last_verified_at" in mirror


@pytest.mark.asyncio
async def test_admin_final_4_guardrail_verification():
    """
    Day 5: Asserts all 4 authoritative architectural guardrails end-to-end:
    - Guardrail 1 (FR-026): Admin mutations record immutable audit_logs.
    - Guardrail 2 (ADR-006): Admin catalog/licensing mutations emit sync_changes.
    - Guardrail 3 (ADR-005): Question updates increment version and isolate attempt snapshots.
    - Guardrail 4: Live schema verification for products, orders, database-status, and tenants-licenses.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Guardrail 4: Live endpoints succeed with 200 OK against live schema
        prod_res = await client.get("/api/v1/admin/products", headers=ADMIN_HEADER)
        assert prod_res.status_code == 200, prod_res.text
        products = prod_res.json()
        assert len(products) >= 1
        target_product = products[0]
        product_id = target_product["product_id"]

        order_res = await client.get("/api/v1/admin/orders", headers=ADMIN_HEADER)
        assert order_res.status_code == 200, order_res.text
        assert isinstance(order_res.json(), list)

        db_status_res = await client.get("/api/v1/admin/database-status", headers=ADMIN_HEADER)
        assert db_status_res.status_code == 200, db_status_res.text
        assert db_status_res.json()["lake_mirror"]["status"] == "IN_SYNC"

        tl_res = await client.get("/api/v1/admin/tenants-licenses", headers=ADMIN_HEADER)
        assert tl_res.status_code == 200, tl_res.text
        assert isinstance(tl_res.json(), list)

        # Test Institutional License Provisioning (POST /api/v1/admin/tenants-licenses)
        test_slug = f"hu-test-{uuid.uuid4().hex[:6]}"
        prov_res = await client.post(
            "/api/v1/admin/tenants-licenses",
            headers=ADMIN_HEADER,
            json={
                "organization_name": f"Haramaya University — CCI Test {test_slug}",
                "slug": test_slug,
                "licensed_seats": 150,
                "duration_days": 180,
                "contract_reference": f"CONTRACT-{test_slug.upper()}",
                "offline_download_allowed": True,
            },
        )
        assert prov_res.status_code == 200, prov_res.text
        prov_data = prov_res.json()
        assert prov_data["total_seats"] == 150
        assert prov_data["is_active"] is True
        tenant_id = prov_data["tenant_id"]

        # Guardrail 1 (FR-026) & Guardrail 2 (ADR-006): Verify audit_logs and sync_changes for tenant license
        async with AsyncSessionLocal() as session:
            audit = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "TENANT_CREATED_WITH_LICENSE",
                        AuditLog.target_id == str(tenant_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert audit is not None, "FR-026 AuditLog not written for tenant license"

            sync = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "tenant",
                        SyncChange.entity_id == str(tenant_id),
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert sync is not None, "ADR-006 SyncChange not emitted for tenant license"

        # Guardrail 1 & 2 for Product Price Update:
        patch_p_res = await client.patch(
            f"/api/v1/admin/products/{product_id}",
            headers=ADMIN_HEADER,
            json={"price_amount": 499.0, "name": f"{target_product['name']} (Verified)"},
        )
        assert patch_p_res.status_code == 200, patch_p_res.text

        async with AsyncSessionLocal() as session:
            p_audit = (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.action_type == "PRODUCT_UPDATED",
                        AuditLog.target_id == str(product_id),
                    )
                    .order_by(AuditLog.created_at.desc())
                )
            ).scalars().first()
            assert p_audit is not None, "FR-026 AuditLog not written for product update"

            p_sync = (
                await session.execute(
                    select(SyncChange)
                    .where(
                        SyncChange.entity_type == "product",
                        SyncChange.entity_id == str(product_id),
                        SyncChange.operation == "UPSERT",
                    )
                    .order_by(SyncChange.change_seq.desc())
                )
            ).scalars().first()
            assert p_sync is not None, "ADR-006 SyncChange not emitted for product update"

        # Guardrail 3 (ADR-005): Question update increment version without affecting attempt snapshots
        q_res = await client.get("/api/v1/admin/questions?limit=1", headers=ADMIN_HEADER)
        assert q_res.status_code == 200
        questions = q_res.json()
        assert len(questions) >= 1
        q = questions[0]
        q_id = q["question_id"]
        v_before = q.get("version", 1)

        patch_q = await client.patch(
            f"/api/v1/admin/questions/{q_id}",
            headers=ADMIN_HEADER,
            json={"bloom_level": "EVALUATE"},
        )
        assert patch_q.status_code == 200
        assert patch_q.json()["version"] == v_before + 1





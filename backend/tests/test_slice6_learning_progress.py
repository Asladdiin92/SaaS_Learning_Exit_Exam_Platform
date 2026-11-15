import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from backend.app.main import app
from backend.app.database.session import AsyncSessionLocal


@pytest.mark.asyncio
async def test_learning_progress_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request should fail
        unauth_res = await client.get("/api/v1/me/progress")
        assert unauth_res.status_code == 401

        # 2. Register test user
        unique_suffix = uuid.uuid4().hex[:8]
        email = f"student_progress_{unique_suffix}@aau.edu.et"
        password = "SecurePassword123!"
        device_id = str(uuid.uuid4())

        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": f"Progress Student {unique_suffix}",
                "device_id": device_id,
            },
        )
        assert reg_res.status_code == 201, reg_res.text
        reg_data = reg_res.json()
        token = reg_data["access_token"]
        user_id = reg_data["user"]["user_id"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Initial progress request
        res = await client.get("/api/v1/me/progress", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()

        # Check summary
        summary = data["summary"]
        assert summary["overall_readiness_percent"] == 0.0
        assert summary["active_courses_count"] == 0
        assert summary["total_courses_count"] >= 15
        assert summary["validated_attempts_count"] == 0
        assert "disclaimer" in summary

        # Check themes (5 themes)
        themes = data["themes"]
        assert len(themes) == 5
        theme_numbers = [t["theme_number"] for t in themes]
        assert theme_numbers == [1, 2, 3, 4, 5]
        total_ch = sum(t["credit_hours"] for t in themes)
        assert total_ch == 45

        # Check Bloom's levels (6 levels)
        blooms = data["blooms_distribution"]
        assert len(blooms) == 6
        levels = [b["level"] for b in blooms]
        assert levels == ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE"]

        # Check courses
        courses = data["courses"]
        assert len(courses) >= 15

        # 4. Seed an outcome mastery record directly for this user to test rolling calculation
        first_course = courses[0]
        if first_course["outcomes"]:
            test_outcome_id = first_course["outcomes"][0]["outcome_id"]
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text(
                        """
                        INSERT INTO outcome_mastery (
                            user_id, tenant_id, outcome_id,
                            attempts_evidence_count, correct_evidence_count,
                            mastery_score, last_evaluated_at
                        )
                        VALUES (:user_id, NULL, :outcome_id, 10, 8, 0.800, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, tenant_id, outcome_id)
                        DO UPDATE SET
                            attempts_evidence_count = 10,
                            correct_evidence_count = 8,
                            mastery_score = 0.800
                        """
                    ),
                    {"user_id": user_id, "outcome_id": test_outcome_id},
                )
                await session.commit()

            # Re-fetch progress
            res2 = await client.get("/api/v1/me/progress", headers=headers)
            assert res2.status_code == 200
            data2 = res2.json()

            # Active courses should now be 1
            assert data2["summary"]["active_courses_count"] == 1
            assert data2["summary"]["overall_readiness_percent"] > 0.0

            # The updated course should reflect mastery
            updated_course = next(c for c in data2["courses"] if c["course_id"] == first_course["course_id"])
            assert updated_course["attempted_outcomes_count"] >= 1
            assert updated_course["mastery_score"] > 0.0

        # 5. Test course filter param
        res_filter = await client.get(
            f"/api/v1/me/progress?course_id={first_course['course_id']}",
            headers=headers,
        )
        assert res_filter.status_code == 200
        filtered_data = res_filter.json()
        assert len(filtered_data["courses"]) == 1
        assert filtered_data["courses"][0]["course_id"] == first_course["course_id"]

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database.session import get_db, set_rls_context
from backend.app.core.security import get_current_user
from backend.app.database.models import User
from backend.app.learning.schemas import (
    StudentProgressResponse,
    ProgressSummaryResponse,
    ThemeMasteryItem,
    BloomLevelItem,
    CourseMasteryItem,
    OutcomeMasteryDetail,
    RecentAttemptSummary,
)

learning_router = APIRouter(prefix="", tags=["Learning & Mastery Analytics"])

BLOOMS_LEVELS = [
    ("REMEMBER", "Remembering"),
    ("UNDERSTAND", "Understanding"),
    ("APPLY", "Applying"),
    ("ANALYSE", "Analyzing"),
    ("EVALUATE", "Evaluating"),
    ("CREATE", "Creating"),
]


@learning_router.get(
    "/me/progress",
    response_model=StudentProgressResponse,
    summary="Get authenticated student's learning progress, theme mastery, and Bloom's analytics",
)
async def get_my_progress(
    period: str = Query("ALL_TIME", pattern="^(7_DAYS|30_DAYS|ALL_TIME)$"),
    course_id: Optional[int] = Query(None, description="Optional filter for specific course progress"),
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[UUID] = Header(None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns rolling server-validated outcome mastery, theme competency,
    6-level Bloom's cognitive distribution, and study telemetry.
    Adheres to ADR-002 (multi-tenant isolation) and ADR-005 (server-authoritative scoring).
    """
    await set_rls_context(db, user_id=current_user.user_id, tenant_id=tenant_id)

    # 1. Fetch all curriculum Themes
    themes_res = await db.execute(
        text(
            """
            SELECT theme_id, theme_number, title, total_credit_hours
            FROM themes
            ORDER BY theme_number ASC
            """
        )
    )
    themes_rows = themes_res.fetchall()

    # 2. Fetch Courses
    courses_query = """
        SELECT course_id, theme_id, code, title, credit_hours
        FROM courses
    """
    params = {"user_id": current_user.user_id, "tenant_id": tenant_id}
    if course_id is not None:
        courses_query += " WHERE course_id = :filter_course_id"
        params["filter_course_id"] = course_id
    courses_query += " ORDER BY course_id ASC"

    courses_res = await db.execute(text(courses_query), params)
    courses_rows = courses_res.fetchall()

    # 3. Fetch Learning Outcomes
    outcomes_query = """
        SELECT outcome_id, course_id, outcome_code, description, domain, level
        FROM learning_outcomes
    """
    if course_id is not None:
        outcomes_query += " WHERE course_id = :filter_course_id"
    outcomes_query += " ORDER BY outcome_id ASC"

    outcomes_res = await db.execute(text(outcomes_query), params)
    outcomes_rows = outcomes_res.fetchall()

    # 4. Fetch User's Outcome Mastery Evidence
    mastery_res = await db.execute(
        text(
            """
            SELECT outcome_id, attempts_evidence_count, correct_evidence_count,
                   mastery_score, last_evaluated_at
            FROM outcome_mastery
            WHERE user_id = :user_id
              AND tenant_id IS NOT DISTINCT FROM :tenant_id
            """
        ),
        params,
    )
    mastery_map = {
        row.outcome_id: {
            "attempts": row.attempts_evidence_count,
            "correct": row.correct_evidence_count,
            "score": float(row.mastery_score),
            "last_evaluated_at": row.last_evaluated_at,
        }
        for row in mastery_res.fetchall()
    }

    # 5. Fetch Scored Exam Attempts
    attempts_query = """
        SELECT ea.attempt_id, ea.exam_id, eb.title AS exam_title,
               ea.score_percent, ea.started_at, ea.submitted_at, ea.scored_at
        FROM exam_attempts ea
        JOIN exam_blueprints eb ON ea.exam_id = eb.exam_id
        WHERE ea.user_id = :user_id
          AND ea.tenant_id IS NOT DISTINCT FROM :tenant_id
          AND ea.status = 'SCORED'
    """
    now = datetime.now(timezone.utc)
    if period == "7_DAYS":
        attempts_query += " AND ea.scored_at >= :since_date"
        params["since_date"] = now - timedelta(days=7)
    elif period == "30_DAYS":
        attempts_query += " AND ea.scored_at >= :since_date"
        params["since_date"] = now - timedelta(days=30)

    attempts_query += " ORDER BY ea.scored_at DESC"
    attempts_res = await db.execute(text(attempts_query), params)
    attempts_rows = attempts_res.fetchall()

    # Calculate Study Streak & Scored Attempts Summary
    distinct_dates = set()
    recent_attempts_list: list[RecentAttemptSummary] = []
    for att in attempts_rows:
        if att.scored_at:
            distinct_dates.add(att.scored_at.date())
        
        duration = None
        if att.started_at and att.submitted_at:
            duration = int((att.submitted_at - att.started_at).total_seconds())
        
        pass_pct = 50.0
        score_val = float(att.score_percent) if att.score_percent is not None else 0.0
        passed = score_val >= pass_pct

        if len(recent_attempts_list) < 10:
            recent_attempts_list.append(
                RecentAttemptSummary(
                    attempt_id=att.attempt_id,
                    exam_id=att.exam_id,
                    exam_title=att.exam_title or "Exit Exam Practice",
                    score_percent=score_val,
                    passed=passed,
                    duration_seconds=duration,
                    scored_at=att.scored_at.isoformat() if att.scored_at else None,
                )
            )

    # Calculate Consecutive Active Streak Days
    study_streak_days = len(distinct_dates)

    # 6. Aggregate Outcomes by Course
    course_outcomes_dict: dict[int, list[OutcomeMasteryDetail]] = {}
    blooms_agg: dict[str, dict[str, int]] = {
        lvl: {"attempts": 0, "correct": 0, "total_outcomes": 0}
        for lvl, _ in BLOOMS_LEVELS
    }

    for lo in outcomes_rows:
        m = mastery_map.get(lo.outcome_id, {"attempts": 0, "correct": 0, "score": 0.0})
        level_str = str(lo.level) if lo.level else "REMEMBER"

        if level_str in blooms_agg:
            blooms_agg[level_str]["total_outcomes"] += 1
            blooms_agg[level_str]["attempts"] += m["attempts"]
            blooms_agg[level_str]["correct"] += m["correct"]

        detail = OutcomeMasteryDetail(
            outcome_id=lo.outcome_id,
            outcome_code=lo.outcome_code,
            description=lo.description,
            domain=str(lo.domain) if lo.domain else "COGNITIVE",
            level=level_str,
            attempts_evidence_count=m["attempts"],
            correct_evidence_count=m["correct"],
            mastery_score=m["score"],
        )
        course_outcomes_dict.setdefault(lo.course_id, []).append(detail)

    # 7. Build Courses Mastery Items
    course_mastery_list: list[CourseMasteryItem] = []
    course_scores_by_theme: dict[int, list[float]] = {}
    active_courses_count = 0

    for c in courses_rows:
        c_outcomes = course_outcomes_dict.get(c.course_id, [])
        total_lo = len(c_outcomes)
        attempted_lo = sum(1 for o in c_outcomes if o.attempts_evidence_count > 0)
        
        if attempted_lo > 0:
            active_courses_count += 1
            # Rolling course score is average of outcome mastery scores
            c_score = sum(o.mastery_score for o in c_outcomes) / total_lo if total_lo > 0 else 0.0
        else:
            c_score = 0.0

        c_item = CourseMasteryItem(
            course_id=c.course_id,
            theme_id=c.theme_id,
            code=c.code,
            title=c.title,
            credit_hours=c.credit_hours,
            mastery_score=round(c_score, 3),
            mastery_percentage=round(c_score * 100.0, 1),
            total_outcomes_count=total_lo,
            attempted_outcomes_count=attempted_lo,
            outcomes=c_outcomes,
        )
        course_mastery_list.append(c_item)
        course_scores_by_theme.setdefault(c.theme_id, []).append(c_score)

    # 8. Build Theme Mastery Items
    theme_mastery_list: list[ThemeMasteryItem] = []
    weighted_theme_scores = 0.0
    total_curriculum_credit_hours = 0

    for t in themes_rows:
        c_scores = course_scores_by_theme.get(t.theme_id, [])
        courses_count = len(c_scores)
        theme_score = sum(c_scores) / courses_count if courses_count > 0 else 0.0
        
        # Count outcomes for theme
        theme_courses = [c for c in courses_rows if c.theme_id == t.theme_id]
        theme_total_outcomes = sum(len(course_outcomes_dict.get(c.course_id, [])) for c in theme_courses)
        theme_attempted_outcomes = sum(
            sum(1 for o in course_outcomes_dict.get(c.course_id, []) if o.attempts_evidence_count > 0)
            for c in theme_courses
        )

        t_item = ThemeMasteryItem(
            theme_id=t.theme_id,
            theme_number=t.theme_number,
            title=t.title,
            credit_hours=t.total_credit_hours,
            courses_count=courses_count,
            mastery_score=round(theme_score, 3),
            mastery_percentage=round(theme_score * 100.0, 1),
            attempted_outcomes_count=theme_attempted_outcomes,
            total_outcomes_count=theme_total_outcomes,
        )
        theme_mastery_list.append(t_item)
        
        weighted_theme_scores += theme_score * t.total_credit_hours
        total_curriculum_credit_hours += t.total_credit_hours

    # 9. Overall Readiness % (weighted across 45 credit hours)
    if total_curriculum_credit_hours > 0:
        overall_readiness_pct = round((weighted_theme_scores / total_curriculum_credit_hours) * 100.0, 1)
    else:
        overall_readiness_pct = 0.0

    # 10. Build 6-Level Bloom's Distribution
    blooms_distribution: list[BloomLevelItem] = []
    for lvl_code, disp_name in BLOOMS_LEVELS:
        b_data = blooms_agg[lvl_code]
        att = b_data["attempts"]
        corr = b_data["correct"]
        score = (corr / att) if att > 0 else 0.0
        blooms_distribution.append(
            BloomLevelItem(
                level=lvl_code,
                display_name=disp_name,
                attempted_count=att,
                correct_count=corr,
                mastery_score=round(score, 3),
                mastery_percentage=round(score * 100.0, 1),
            )
        )

    # 11. Freshness Timestamp
    latest_evaluated = max(
        (m["last_evaluated_at"] for m in mastery_map.values() if m.get("last_evaluated_at")),
        default=now,
    )
    last_calc_iso = latest_evaluated.isoformat() if hasattr(latest_evaluated, "isoformat") else now.isoformat()

    summary = ProgressSummaryResponse(
        overall_readiness_percent=overall_readiness_pct,
        active_courses_count=active_courses_count,
        total_courses_count=len(courses_rows),
        validated_attempts_count=len(attempts_rows),
        study_streak_days=study_streak_days,
        last_calculated_at=last_calc_iso,
    )

    return StudentProgressResponse(
        summary=summary,
        themes=theme_mastery_list,
        blooms_distribution=blooms_distribution,
        courses=course_mastery_list,
        recent_attempts=recent_attempts_list,
    )

from typing import Dict, List, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.security import get_current_user
from backend.app.curriculum.schemas import (
    CourseDetailOut,
    LearningOutcomeGroup,
    LearningOutcomeOut,
    ThemeOut,
)
from backend.app.database.models import Course, CourseResource, ExamBlueprint, Theme
from backend.app.database.session import get_db

curriculum_router = APIRouter(tags=["Curriculum"])


@curriculum_router.get(
    "/curriculum/themes",
    response_model=List[ThemeOut],
    summary="List all curriculum themes and their canonical courses",
)
async def list_themes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.courses))
        .order_by(Theme.theme_number)
    )
    return result.scalars().all()


@curriculum_router.get(
    "/courses/{course_id}",
    response_model=CourseDetailOut,
    summary="Get course details, grouped learning outcomes, and resource counts",
    dependencies=[Depends(get_current_user)],
)
async def get_course_detail(
    course_id: int,
    x_tenant_id: UUID | None = Header(None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.theme),
            selectinload(Course.outcomes),
        )
        .where(Course.course_id == course_id)
    )
    course = result.scalars().first()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} not found.",
        )

    grouped_outcomes: Dict[Tuple[str, str], list[LearningOutcomeOut]] = {}
    for outcome in course.outcomes:
        grouped_outcomes.setdefault((outcome.domain, outcome.level), []).append(
            LearningOutcomeOut.model_validate(outcome)
        )

    resource_count = await db.scalar(
        select(func.count(CourseResource.resource_id)).where(
            CourseResource.course_id == course_id,
            or_(
                CourseResource.tenant_id.is_(None),
                CourseResource.tenant_id == x_tenant_id,
            ),
        )
    )
    exam_count = await db.scalar(
        select(func.count(ExamBlueprint.exam_id)).where(
            ExamBlueprint.course_id == course_id,
            or_(
                ExamBlueprint.tenant_id.is_(None),
                ExamBlueprint.tenant_id == x_tenant_id,
            ),
        )
    )

    return CourseDetailOut(
        course_id=course.course_id,
        theme_id=course.theme_id,
        code=course.code,
        title=course.title,
        credit_hours=course.credit_hours,
        general_objective=course.general_objective,
        theme_title=course.theme.title if course.theme else None,
        outcomes=course.outcomes,
        learning_outcomes=[
            LearningOutcomeGroup(domain=domain, level=level, outcomes=outcomes)
            for (domain, level), outcomes in sorted(grouped_outcomes.items())
        ],
        resource_count=resource_count or 0,
        exam_blueprint_count=exam_count or 0,
    )

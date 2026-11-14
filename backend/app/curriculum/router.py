from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.database.models import Course, Theme
from backend.app.database.session import get_db
from backend.app.curriculum.schemas import CourseDetailOut, ThemeOut

curriculum_router = APIRouter(tags=["Curriculum"])


@curriculum_router.get(
    "/curriculum/themes",
    response_model=List[ThemeOut],
    summary="List all 5 curriculum themes and their canonical courses",
)
async def list_themes(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Theme)
        .options(selectinload(Theme.courses))
        .order_by(Theme.theme_number)
    )
    result = await db.execute(stmt)
    themes = result.scalars().all()
    return themes


@curriculum_router.get(
    "/courses/{course_id}",
    response_model=CourseDetailOut,
    summary="Get detailed course syllabus, learning outcomes, and resources",
)
async def get_course_detail(course_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Course)
        .options(
            selectinload(Course.theme),
            selectinload(Course.outcomes),
            selectinload(Course.resources),
        )
        .where(Course.course_id == course_id)
    )
    result = await db.execute(stmt)
    course = result.scalars().first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} not found.",
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
        resources=course.resources,
    )

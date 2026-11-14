from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import get_current_user
from backend.app.curriculum.schemas import ExamBlueprintOut
from backend.app.database.models import ExamBlueprint, Question
from backend.app.database.session import get_db

assessments_router = APIRouter(tags=["Assessments"])
EXAM_TYPES = {"PRACTICE_QUIZ", "COURSE_EXAM", "NATIONAL_EXIT_SIMULATION"}
DIFFICULTIES = {"EASY", "MEDIUM", "HARD"}


@assessments_router.get(
    "/exams",
    response_model=list[ExamBlueprintOut],
    summary="List exam blueprints filtered by course, type, and question difficulty",
    dependencies=[Depends(get_current_user)],
)
async def list_exams(
    course_id: Optional[int] = Query(None, ge=1),
    exam_type: Optional[str] = Query(None, alias="type"),
    difficulty: Optional[str] = Query(None),
    x_tenant_id: Optional[UUID] = Header(None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
):
    normalized_type = exam_type.upper() if exam_type else None
    normalized_difficulty = difficulty.upper() if difficulty else None
    if normalized_type and normalized_type not in EXAM_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported exam type: {exam_type}.",
        )
    if normalized_difficulty and normalized_difficulty not in DIFFICULTIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported difficulty: {difficulty}.",
        )

    query = select(ExamBlueprint).where(
        or_(
            ExamBlueprint.tenant_id.is_(None),
            ExamBlueprint.tenant_id == x_tenant_id,
        )
    )
    if course_id is not None:
        query = query.where(ExamBlueprint.course_id == course_id)
    if normalized_type:
        query = query.where(ExamBlueprint.type == normalized_type)
    result = await db.execute(query.order_by(ExamBlueprint.title))
    blueprints = result.scalars().all()

    items = []
    for blueprint in blueprints:
        blueprint_difficulty = (blueprint.rules_json or {}).get("difficulty")
        observed_difficulties = set()
        if blueprint_difficulty:
            observed_difficulties.add(str(blueprint_difficulty).upper())
        else:
            question_query = select(Question.difficulty).distinct()
            if blueprint.course_id is not None:
                question_query = question_query.where(
                    Question.course_id == blueprint.course_id
                )
            else:
                question_query = question_query.where(
                    Question.tenant_id.is_not_distinct_from(blueprint.tenant_id)
                )
            question_result = await db.execute(question_query)
            observed_difficulties = {
                str(value).upper() for value in question_result.scalars().all()
            }
        if not observed_difficulties:
            observed_difficulties = {"MEDIUM"}
        if normalized_difficulty and normalized_difficulty not in observed_difficulties:
            continue

        item = ExamBlueprintOut.model_validate(blueprint)
        item.difficulty = (
            next(iter(observed_difficulties))
            if len(observed_difficulties) == 1
            else "MIXED"
        )
        items.append(item)
    return items

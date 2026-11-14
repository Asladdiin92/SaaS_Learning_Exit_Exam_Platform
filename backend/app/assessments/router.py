import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import get_current_user
from backend.app.curriculum.schemas import ExamBlueprintOut
from backend.app.database.models import (
    AttemptAnswer,
    ExamAttempt,
    ExamBlueprint,
    FeatureEntitlement,
    Question,
    QuestionOption,
    User,
    UserDevice,
)
from backend.app.database.session import get_db, set_rls_context
from backend.app.assessments.schemas import (
    AnswerSubmission,
    AnswerSavedResponse,
    AttemptResultResponse,
    StartAttemptResponse,
    StartAttemptRequest,
    SubmitAttemptRequest,
)
from backend.app.learning.service import recompute_outcome_mastery

assessments_router = APIRouter(tags=["Assessments"])
EXAM_TYPES = {"PRACTICE_QUIZ", "COURSE_EXAM", "NATIONAL_EXIT_SIMULATION"}
DIFFICULTIES = {"EASY", "MEDIUM", "HARD"}
HU_QUESTION_NUMBER = re.compile(r"\[Q(\d+)\b")


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


def _client_snapshot(snapshots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            key: value
            for key, value in item.items()
            if key not in {"explanation"}
        }
        | {
            "options": [
                {key: value for key, value in option.items() if key != "is_correct"}
                for option in item["options"]
            ]
        }
        for item in snapshots
    ]


async def _check_exam_entitlement(
    db: AsyncSession,
    user_id: UUID,
    tenant_id: Optional[UUID],
    blueprint: ExamBlueprint,
) -> None:
    tenant_scope = (
        FeatureEntitlement.tenant_id.is_(None)
        if tenant_id is None
        else or_(
            FeatureEntitlement.tenant_id.is_(None),
            FeatureEntitlement.tenant_id == tenant_id,
        )
    )
    now = datetime.now(timezone.utc)
    grants = await db.scalars(
        select(FeatureEntitlement).where(
            FeatureEntitlement.user_id == user_id,
            tenant_scope,
            FeatureEntitlement.revoked_at.is_(None),
            FeatureEntitlement.valid_from <= now,
            or_(
                FeatureEntitlement.valid_until.is_(None),
                FeatureEntitlement.valid_until > now,
            ),
        )
    )
    scope_matches = False
    for grant in grants:
        scope_type = grant.scope_type.upper()
        if scope_type == "GLOBAL":
            scope_matches = True
        elif scope_type == "EXAM" and grant.scope_target_id == str(blueprint.exam_id):
            scope_matches = True
        elif (
            scope_type == "COURSE"
            and blueprint.course_id is not None
            and grant.scope_target_id == str(blueprint.course_id)
        ):
            scope_matches = True
        if scope_matches:
            break
    if not scope_matches:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"reason_code": "EXAM_ENTITLEMENT_REQUIRED"},
        )


async def _load_snapshot(
    db: AsyncSession,
    blueprint: ExamBlueprint,
    tenant_id: Optional[UUID],
) -> list[dict[str, Any]]:
    rules = blueprint.rules_json or {}
    question_query = select(Question).where(
        Question.is_published.is_(True),
        or_(Question.tenant_id.is_(None), Question.tenant_id == tenant_id),
    )
    if blueprint.course_id is not None:
        question_query = question_query.where(Question.course_id == blueprint.course_id)
    if rules.get("difficulty"):
        question_query = question_query.where(
            Question.difficulty == str(rules["difficulty"]).upper()
        )
    if rules.get("level"):
        question_query = question_query.where(Question.level == str(rules["level"]).upper())
    question_result = await db.execute(
        question_query.order_by(Question.created_at, Question.question_id).with_for_update()
    )
    questions = list(question_result.scalars().all())

    requested_ids = rules.get("question_ids")
    if isinstance(requested_ids, list) and requested_ids:
        positions = {str(question_id): index for index, question_id in enumerate(requested_ids)}
        questions = [question for question in questions if str(question.question_id) in positions]
        questions.sort(key=lambda question: positions[str(question.question_id)])
    elif blueprint.type == "NATIONAL_EXIT_SIMULATION":
        questions.sort(
            key=lambda question: (
                int(match.group(1)) if (match := HU_QUESTION_NUMBER.search(question.question_text)) else 2**31,
                str(question.question_id),
            )
        )

    questions = questions[: blueprint.total_questions]
    if len(questions) != blueprint.total_questions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason_code": "INSUFFICIENT_PUBLISHED_QUESTIONS",
                "required": blueprint.total_questions,
                "available": len(questions),
            },
        )

    question_ids = [question.question_id for question in questions]
    option_result = await db.execute(
        select(QuestionOption)
        .where(QuestionOption.question_id.in_(question_ids))
        .order_by(QuestionOption.option_label, QuestionOption.option_id)
        .with_for_update()
    )
    options_by_question: dict[UUID, list[QuestionOption]] = {}
    for option in option_result.scalars().all():
        options_by_question.setdefault(option.question_id, []).append(option)

    snapshots = []
    for question in questions:
        options = options_by_question.get(question.question_id, [])
        if not options:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Published question {question.question_id} has no options.",
            )
        snapshots.append(
            {
                "question_id": str(question.question_id),
                "course_id": question.course_id,
                "outcome_id": question.outcome_id,
                "question_text": question.question_text,
                "type": str(question.type),
                "level": str(question.level),
                "difficulty": str(question.difficulty),
                "explanation": question.explanation,
                "options": [
                    {
                        "option_id": str(option.option_id),
                        "option_label": option.option_label.strip(),
                        "option_text": option.option_text,
                        "is_correct": option.is_correct,
                    }
                    for option in options
                ],
            }
        )
    return snapshots


@assessments_router.post(
    "/exams/{exam_id}/attempts",
    status_code=status.HTTP_201_CREATED,
    summary="Start an exam attempt with an immutable server-side question snapshot",
    response_model=StartAttemptResponse,
)
async def start_exam_attempt(
    exam_id: UUID,
    payload: StartAttemptRequest,
    request: Request,
    idempotency_key: UUID = Header(..., alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = getattr(request.state, "tenant_id", None)
    existing = await db.scalar(
        select(ExamAttempt).where(
            ExamAttempt.client_operation_id == idempotency_key
        )
    )
    if existing is not None:
        if (
            existing.user_id != user.user_id
            or existing.exam_id != exam_id
            or existing.tenant_id != tenant_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Idempotency-Key was already used for a different attempt.",
            )
        return {
            "attempt_id": str(existing.attempt_id),
            "exam_id": str(existing.exam_id),
            "status": str(existing.status),
            "total_questions": existing.total_questions,
            "question_snapshots": _client_snapshot(existing.question_snapshots),
        }

    blueprint = await db.scalar(
        select(ExamBlueprint)
        .where(
            ExamBlueprint.exam_id == exam_id,
            or_(ExamBlueprint.tenant_id.is_(None), ExamBlueprint.tenant_id == tenant_id),
        )
        .with_for_update()
    )
    if blueprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found.")
    if payload.mode == "OFFLINE_PACKAGE" and not blueprint.is_offline_eligible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"reason_code": "OFFLINE_EXAM_NOT_PERMITTED"},
        )
    await _check_exam_entitlement(db, user.user_id, tenant_id, blueprint)

    device = await db.scalar(
        select(UserDevice).where(
            UserDevice.device_id == payload.device_id,
            UserDevice.user_id == user.user_id,
            UserDevice.revoked_at.is_(None),
        )
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The requested device is not registered to this user.",
        )

    snapshots = await _load_snapshot(db, blueprint, tenant_id)
    attempt = ExamAttempt(
        attempt_id=uuid.uuid4(),
        client_operation_id=idempotency_key,
        user_id=user.user_id,
        tenant_id=tenant_id,
        exam_id=blueprint.exam_id,
        status="IN_PROGRESS",
        question_snapshots=snapshots,
        total_questions=len(snapshots),
    )
    db.add(attempt)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        await set_rls_context(db, user_id=user.user_id, tenant_id=tenant_id)
        existing = await db.scalar(
            select(ExamAttempt).where(
                ExamAttempt.client_operation_id == idempotency_key
            )
        )
        if existing is None:
            raise
        if (
            existing.user_id != user.user_id
            or existing.exam_id != exam_id
            or existing.tenant_id != tenant_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Idempotency-Key was already used for a different attempt.",
            )
        return {
            "attempt_id": str(existing.attempt_id),
            "exam_id": str(existing.exam_id),
            "status": str(existing.status),
            "total_questions": existing.total_questions,
            "question_snapshots": _client_snapshot(existing.question_snapshots),
        }
    return {
        "attempt_id": str(attempt.attempt_id),
        "exam_id": str(attempt.exam_id),
        "status": attempt.status,
        "total_questions": attempt.total_questions,
        "question_snapshots": _client_snapshot(snapshots),
    }


def _snapshot_index(attempt: ExamAttempt) -> dict[str, dict[str, Any]]:
    return {item["question_id"]: item for item in attempt.question_snapshots}


def _validate_answer_snapshot(
    answer: AnswerSubmission,
    snapshot_index: dict[str, dict[str, Any]],
) -> None:
    snapshot = snapshot_index.get(str(answer.question_id))
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Answer references a question outside the locked attempt snapshot.",
        )
    if answer.selected_option_id is not None and not any(
        option["option_id"] == str(answer.selected_option_id)
        for option in snapshot["options"]
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selected option does not belong to the locked question snapshot.",
        )


async def _upsert_answers(
    db: AsyncSession,
    attempt: ExamAttempt,
    answers: list[AnswerSubmission],
) -> None:
    snapshot_index = _snapshot_index(attempt)
    seen: set[UUID] = set()
    for answer in answers:
        _validate_answer_snapshot(answer, snapshot_index)
        if answer.question_id in seen:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A submission cannot contain duplicate question answers.",
            )
        seen.add(answer.question_id)
        existing = await db.scalar(
            select(AttemptAnswer).where(
                AttemptAnswer.attempt_id == attempt.attempt_id,
                AttemptAnswer.question_id == answer.question_id,
            )
        )
        if existing is not None and answer.sequence_no < existing.sequence_no:
            continue
        if existing is None:
            db.add(
                AttemptAnswer(
                    attempt_id=attempt.attempt_id,
                    question_id=answer.question_id,
                    selected_option_id=answer.selected_option_id,
                    text_or_code_response=answer.text_or_code_response,
                    response_time_seconds=answer.response_time_seconds,
                    sequence_no=answer.sequence_no,
                    is_correct=False,
                )
            )
        else:
            existing.selected_option_id = answer.selected_option_id
            existing.text_or_code_response = answer.text_or_code_response
            existing.response_time_seconds = answer.response_time_seconds
            existing.sequence_no = answer.sequence_no
            existing.is_correct = False


async def _get_owned_attempt(
    db: AsyncSession,
    attempt_id: UUID,
    user_id: UUID,
    tenant_id: Optional[UUID],
) -> ExamAttempt:
    attempt = await db.scalar(
        select(ExamAttempt)
        .where(
            ExamAttempt.attempt_id == attempt_id,
            ExamAttempt.user_id == user_id,
            ExamAttempt.tenant_id.is_not_distinct_from(tenant_id),
        )
        .with_for_update()
    )
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found.")
    return attempt


@assessments_router.post(
    "/attempts/{attempt_id}/answers",
    summary="Save a student's answer for an in-progress attempt",
    response_model=AnswerSavedResponse,
)
async def save_attempt_answers(
    attempt_id: UUID,
    answer: AnswerSubmission,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _get_owned_attempt(
        db, attempt_id, user.user_id, getattr(request.state, "tenant_id", None)
    )
    if attempt.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Answers can only be changed while an attempt is in progress.",
        )
    await _upsert_answers(db, attempt, [answer])
    await db.commit()
    return {"attempt_id": str(attempt.attempt_id), "saved": True}


async def _scored_result(db: AsyncSession, attempt: ExamAttempt) -> dict[str, Any]:
    answers_result = await db.execute(
        select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt.attempt_id)
    )
    answers = {str(answer.question_id): answer for answer in answers_result.scalars().all()}
    blueprint = await db.get(ExamBlueprint, attempt.exam_id)
    reveal = bool(blueprint and blueprint.reveal_answers_immediately)
    outcome_totals: dict[int, dict[str, int]] = {}
    review_items = []

    for question in attempt.question_snapshots:
        question_id = question["question_id"]
        answer = answers.get(question_id)
        selected_option_id = (
            str(answer.selected_option_id) if answer and answer.selected_option_id else None
        )
        correct_option = next(
            (option for option in question["options"] if option["is_correct"]),
            None,
        )
        is_correct = bool(
            answer
            and selected_option_id
            and correct_option
            and correct_option["option_id"] == selected_option_id
        )
        outcome_id = question.get("outcome_id")
        if outcome_id is not None:
            totals = outcome_totals.setdefault(int(outcome_id), {"total": 0, "correct": 0})
            totals["total"] += 1
            totals["correct"] += int(is_correct)

        review_item = {
            "question_id": question_id,
            "selected_option_id": selected_option_id,
        }
        if reveal:
            review_item.update(
                {
                    "is_correct": is_correct,
                    "correct_option_id": correct_option["option_id"] if correct_option else None,
                    "explanation": question.get("explanation"),
                }
            )
        review_items.append(review_item)

    outcome_breakdown = [
        {
            "outcome_id": outcome_id,
            "total_questions": totals["total"],
            "correct_count": totals["correct"],
            "score_percent": round(totals["correct"] * 100 / totals["total"], 2),
        }
        for outcome_id, totals in sorted(outcome_totals.items())
    ]
    return {
        "attempt_id": str(attempt.attempt_id),
        "status": str(attempt.status),
        "score_percent": float(Decimal(attempt.score_percent)),
        "correct_count": attempt.correct_count,
        "total_questions": attempt.total_questions,
        "scored_at": attempt.scored_at.isoformat() if attempt.scored_at else None,
        "outcome_breakdown": outcome_breakdown,
        "review_items": review_items,
    }


@assessments_router.post(
    "/attempts/{attempt_id}/submit",
    summary="Submit and grade an attempt using its immutable question snapshot",
    response_model=AttemptResultResponse,
    response_model_exclude_none=True,
)
async def submit_attempt(
    attempt_id: UUID,
    payload: SubmitAttemptRequest,
    request: Request,
    idempotency_key: Optional[UUID] = Header(None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if (
        idempotency_key is not None
        and payload.operation_id is not None
        and idempotency_key != payload.operation_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key and operation_id must match when both are supplied.",
        )

    attempt = await _get_owned_attempt(
        db, attempt_id, user.user_id, getattr(request.state, "tenant_id", None)
    )
    if attempt.status == "SCORED":
        return await _scored_result(db, attempt)
    if attempt.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only in-progress attempts can be submitted.",
        )

    await _upsert_answers(db, attempt, payload.answers)
    await db.flush()
    await db.execute(
        text("SELECT * FROM public.grade_exam_attempt(:attempt_id)"),
        {"attempt_id": attempt.attempt_id},
    )
    await db.refresh(attempt)
    outcome_ids = {
        int(item["outcome_id"])
        for item in attempt.question_snapshots
        if item.get("outcome_id") is not None
    }
    await recompute_outcome_mastery(
        db,
        attempt.user_id,
        attempt.tenant_id,
        outcome_ids,
    )
    result = await _scored_result(db, attempt)
    await db.commit()
    return result

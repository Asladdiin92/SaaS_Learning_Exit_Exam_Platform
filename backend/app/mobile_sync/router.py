import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from sqlalchemy import or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.assessments.router import (
    _load_snapshot,
    _scored_result,
    _upsert_answers,
)
from backend.app.assessments.schemas import AnswerSubmission
from backend.app.core.config import settings
from backend.app.core.security import get_current_user
from backend.app.database.models import (
    ExamAttempt,
    ExamBlueprint,
    FeatureEntitlement,
    User,
    UserDevice,
)
from backend.app.database.session import get_db
from backend.app.learning.service import recompute_outcome_mastery
from backend.app.mobile_sync.schemas import SyncOperationIn, SyncPushRequest

mobile_sync_router = APIRouter(prefix="/sync", tags=["Mobile Sync"])
_CURSOR_VERSION = 1
_ATTEMPT_ID_NAMESPACE = uuid.UUID("7a337566-46d4-47e1-ae47-7165f34ea842")
_HU_BLUEPRINT_TITLE = (
    "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)"
)


class SyncRejected(Exception):
    def __init__(self, reason_code: str):
        self.reason_code = reason_code
        super().__init__(reason_code)


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _scope_key(user_id: UUID, tenant_id: Optional[UUID]) -> str:
    return f"{user_id}:{tenant_id or 'personal'}"


def encode_cursor(sequence: int, scope: str) -> str:
    payload = json.dumps(
        {"v": _CURSOR_VERSION, "seq": sequence, "scope": scope},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded_payload = _b64url_encode(payload)
    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{encoded_payload}.{_b64url_encode(signature)}"


def decode_cursor(cursor: Optional[str], expected_scope: str) -> int:
    if not cursor:
        return 0
    try:
        encoded_payload, encoded_signature = cursor.split(".", 1)
        expected_signature = hmac.new(
            settings.JWT_SECRET_KEY.encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        signature = _b64url_decode(encoded_signature)
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("Invalid cursor signature.")
        payload = json.loads(_b64url_decode(encoded_payload))
        sequence = payload["seq"]
        if (
            payload.get("v") != _CURSOR_VERSION
            or payload.get("scope") != expected_scope
            or not isinstance(sequence, int)
            or isinstance(sequence, bool)
            or sequence < 0
        ):
            raise ValueError("Invalid cursor scope or sequence.")
        return sequence
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or incompatible sync cursor.",
        ) from exc


@mobile_sync_router.get("/pull", summary="Pull ordered changes after an opaque cursor")
async def pull_changes(
    request: Request,
    cursor: Optional[str] = Query(None, max_length=2048),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = getattr(request.state, "tenant_id", None)
    scope = _scope_key(user.user_id, tenant_id)
    sequence = decode_cursor(cursor, scope)
    result = await db.execute(
        text(
            """
            SELECT change_seq, entity_type, entity_id, operation, version, payload
            FROM sync_changes
            WHERE change_seq > :sequence
              AND (tenant_id IS NULL OR tenant_id = :tenant_id)
              AND (user_id IS NULL OR user_id = :user_id)
            ORDER BY change_seq ASC
            LIMIT :limit
            """
        ),
        {
            "sequence": sequence,
            "tenant_id": tenant_id,
            "user_id": user.user_id,
            "limit": limit + 1,
        },
    )
    rows = result.mappings().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    changes = []
    tombstones = []
    for row in page:
        item = {
            "change_seq": row["change_seq"],
            "entity_type": row["entity_type"],
            "entity_id": row["entity_id"],
            "version": row["version"],
            "payload": row["payload"],
        }
        (tombstones if row["operation"] == "TOMBSTONE" else changes).append(item)

    if has_more and page:
        next_sequence = page[-1]["change_seq"]
    else:
        max_result = await db.execute(
            text("SELECT COALESCE(MAX(change_seq), :sequence) FROM sync_changes"),
            {"sequence": sequence},
        )
        next_sequence = max_result.scalar_one()

    return {
        "next_cursor": encode_cursor(next_sequence, scope),
        "has_more": has_more,
        "changes": changes,
        "tombstones": tombstones,
    }


async def _active_device(
    db: AsyncSession,
    user_id: UUID,
    device_id: UUID,
) -> UserDevice:
    device = await db.scalar(
        select(UserDevice).where(
            UserDevice.device_id == device_id,
            UserDevice.user_id == user_id,
            UserDevice.revoked_at.is_(None),
        )
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The sync device is not registered or has been revoked.",
        )
    return device


async def _cached_operation(
    db: AsyncSession,
    operation_id: UUID,
    user_id: UUID,
) -> Optional[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT status, reason_code, server_entity_id, result_payload
            FROM sync_operations_log
            WHERE operation_id = :operation_id AND user_id = :user_id
            """
        ),
        {"operation_id": operation_id, "user_id": user_id},
    )
    row = result.mappings().first()
    if row is None:
        collision = await db.scalar(
            text(
                "SELECT 1 FROM sync_operations_log WHERE operation_id = :operation_id"
            ),
            {"operation_id": operation_id},
        )
        if collision:
            return {
                "rejected": {
                    "operation_id": str(operation_id),
                    "reason_code": "VALIDATION_ERROR",
                },
                "record": False,
            }
        return None
    if row["status"] == "ACCEPTED":
        return {
            "accepted": {
                "operation_id": str(operation_id),
                "server_id": str(row["server_entity_id"]) if row["server_entity_id"] else None,
                "result": row["result_payload"] or {},
            }
        }
    return {
        "rejected": {
            "operation_id": str(operation_id),
            "reason_code": row["reason_code"] or "VALIDATION_ERROR",
        }
    }


async def _record_operation(
    db: AsyncSession,
    operation: SyncOperationIn,
    user_id: UUID,
    device_id: UUID,
    tenant_id: Optional[UUID],
    operation_status: str,
    server_entity_id: Optional[UUID] = None,
    result_payload: Optional[dict[str, Any]] = None,
    reason_code: Optional[str] = None,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO sync_operations_log (
                operation_id, user_id, device_id, tenant_id, operation_type,
                status, reason_code, server_entity_id, result_payload
            ) VALUES (
                :operation_id, :user_id, :device_id, :tenant_id, :operation_type,
                :status, :reason_code, :server_entity_id, CAST(:result_payload AS jsonb)
            )
            """
        ),
        {
            "operation_id": operation.operation_id,
            "user_id": user_id,
            "device_id": device_id,
            "tenant_id": tenant_id,
            "operation_type": operation.type,
            "status": operation_status,
            "reason_code": reason_code,
            "server_entity_id": server_entity_id,
            "result_payload": json.dumps(result_payload or {}),
        },
    )


async def _resolve_blueprint(
    db: AsyncSession,
    payload: dict[str, Any],
    tenant_id: Optional[UUID],
) -> ExamBlueprint:
    blueprint = None
    candidate = payload.get("exam_id")
    if candidate:
        try:
            exam_id = UUID(str(candidate))
        except ValueError:
            exam_id = None
        if exam_id:
            blueprint = await db.scalar(
                select(ExamBlueprint).where(
                    ExamBlueprint.exam_id == exam_id,
                    or_(
                        ExamBlueprint.tenant_id.is_(None),
                        ExamBlueprint.tenant_id == tenant_id,
                    ),
                )
            )

    if blueprint is None:
        package_id = payload.get("exam_package_id")
        if not isinstance(package_id, str) or not package_id:
            raise SyncRejected("VALIDATION_ERROR")
        if package_id == "pkg_hu_cci_model_exit_2023":
            blueprint = await db.scalar(
                select(ExamBlueprint).where(
                    ExamBlueprint.title == _HU_BLUEPRINT_TITLE,
                    or_(
                        ExamBlueprint.tenant_id.is_(None),
                        ExamBlueprint.tenant_id == tenant_id,
                    ),
                ),
            )
        else:
            blueprint = await db.scalar(
                select(ExamBlueprint).where(
                    ExamBlueprint.rules_json["package_id"].astext == package_id,
                    or_(
                        ExamBlueprint.tenant_id.is_(None),
                        ExamBlueprint.tenant_id == tenant_id,
                    ),
                ),
            )
    if blueprint is None:
        raise SyncRejected("BLUEPRINT_SUPERSEDED")

    client_version = payload.get("blueprint_version")
    if client_version is not None and int(client_version) != blueprint.version:
        raise SyncRejected("BLUEPRINT_SUPERSEDED")
    return blueprint


async def _validate_offline_grant(
    db: AsyncSession,
    user_id: UUID,
    device_id: UUID,
    tenant_id: Optional[UUID],
    blueprint: ExamBlueprint,
    payload: dict[str, Any],
) -> None:
    grant_token = payload.get("offline_grant") or payload.get("offline_biometric_grant")
    if not isinstance(grant_token, str) or not grant_token:
        raise SyncRejected("GRANT_EXPIRED")
    try:
        claims = jwt.decode(
            grant_token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
            options={"verify_exp": False},
        )
        if (
            claims.get("type") not in {"offline_grant", "offline_biometric_grant"}
            or UUID(str(claims.get("sub"))) != user_id
            or UUID(str(claims.get("device_id"))) != device_id
            or claims.get("tenant_id") != (str(tenant_id) if tenant_id else None)
        ):
            raise ValueError("Grant identity mismatch.")
        issued_at = datetime.fromtimestamp(int(claims["iat"]), timezone.utc)
        expires_at = datetime.fromtimestamp(int(claims["exp"]), timezone.utc)
    except (jwt.PyJWTError, KeyError, TypeError, ValueError, OverflowError) as exc:
        raise SyncRejected("GRANT_EXPIRED") from exc

    tenant_scope = (
        FeatureEntitlement.tenant_id.is_(None)
        if tenant_id is None
        else or_(
            FeatureEntitlement.tenant_id.is_(None),
            FeatureEntitlement.tenant_id == tenant_id,
        )
    )
    grants = await db.scalars(
        select(FeatureEntitlement).where(
            FeatureEntitlement.user_id == user_id,
            tenant_scope,
            FeatureEntitlement.revoked_at.is_(None),
            FeatureEntitlement.valid_from <= issued_at,
            or_(
                FeatureEntitlement.valid_until.is_(None),
                FeatureEntitlement.valid_until > issued_at,
            ),
        )
    )
    current_time = datetime.now(timezone.utc)
    allowed = False
    for grant in grants:
        scope_type = grant.scope_type.upper()
        if scope_type == "GLOBAL":
            allowed = True
        elif scope_type == "EXAM" and grant.scope_target_id == str(blueprint.exam_id):
            allowed = True
        elif (
            scope_type == "COURSE"
            and blueprint.course_id is not None
            and grant.scope_target_id == str(blueprint.course_id)
        ):
            allowed = True
        if allowed and current_time <= issued_at + timedelta(days=grant.offline_grace_days):
            break
        allowed = False
    if not allowed or expires_at < issued_at:
        raise SyncRejected("GRANT_EXPIRED")


def _answers_from_payload(payload: dict[str, Any]) -> list[AnswerSubmission]:
    raw_answers = payload.get("answers")
    if not isinstance(raw_answers, list):
        raise SyncRejected("VALIDATION_ERROR")
    parsed = []
    try:
        for answer in raw_answers:
            if not isinstance(answer, dict) or "is_correct" in answer:
                raise ValueError("Malformed answer.")
            if "text_or_code_answer" in answer:
                answer = dict(answer)
                answer = {
                    **{
                        key: value
                        for key, value in answer.items()
                        if key != "text_or_code_answer"
                    },
                    "text_or_code_response": answer["text_or_code_answer"],
                }
            parsed.append(AnswerSubmission.model_validate(answer))
    except (ValueError, TypeError, RequestValidationError):
        raise SyncRejected("VALIDATION_ERROR") from None
    return parsed


async def _process_exam_submission(
    db: AsyncSession,
    operation: SyncOperationIn,
    user: User,
    device_id: UUID,
    tenant_id: Optional[UUID],
) -> tuple[UUID, dict[str, Any]]:
    blueprint = await _resolve_blueprint(db, operation.payload, tenant_id)
    await _validate_offline_grant(
        db, user.user_id, device_id, tenant_id, blueprint, operation.payload
    )
    snapshot = await _load_snapshot(db, blueprint, tenant_id)
    local_attempt_id = operation.payload.get("local_attempt_id")
    try:
        attempt_uuid = UUID(str(operation.payload.get("attempt_id") or local_attempt_id))
    except (ValueError, TypeError, AttributeError):
        attempt_uuid = uuid.uuid5(
            _ATTEMPT_ID_NAMESPACE,
            f"{user.user_id}:{operation.operation_id}",
        )

    attempt = await db.scalar(
        select(ExamAttempt)
        .where(
            ExamAttempt.attempt_id == attempt_uuid,
            ExamAttempt.user_id == user.user_id,
            ExamAttempt.tenant_id.is_not_distinct_from(tenant_id),
        )
        .with_for_update()
    )
    if attempt is None:
        attempt = ExamAttempt(
            attempt_id=attempt_uuid,
            client_operation_id=operation.operation_id,
            user_id=user.user_id,
            tenant_id=tenant_id,
            exam_id=blueprint.exam_id,
            status="IN_PROGRESS",
            question_snapshots=snapshot,
            total_questions=len(snapshot),
        )
        db.add(attempt)
        await db.flush()
    elif attempt.exam_id != blueprint.exam_id:
        raise SyncRejected("BLUEPRINT_SUPERSEDED")
    if attempt.status == "SCORED":
        return attempt.attempt_id, await _scored_result(db, attempt)
    if attempt.status != "IN_PROGRESS":
        raise SyncRejected("VALIDATION_ERROR")

    answers = _answers_from_payload(operation.payload)
    try:
        await _upsert_answers(db, attempt, answers)
    except HTTPException as exc:
        raise SyncRejected("VALIDATION_ERROR") from exc
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
        user.user_id,
        tenant_id,
        outcome_ids,
    )
    result = await _scored_result(db, attempt)
    return attempt.attempt_id, result


async def _process_bookmark(
    db: AsyncSession,
    operation: SyncOperationIn,
    user_id: UUID,
    tenant_id: Optional[UUID],
) -> tuple[UUID, dict[str, Any]]:
    payload = operation.payload
    key = payload.get("bookmark_key") or payload.get("entity_id")
    fields = payload.get("fields")
    field_versions = payload.get("field_versions", {})
    if not isinstance(key, str) or not key or not isinstance(fields, dict):
        raise SyncRejected("VALIDATION_ERROR")
    if not isinstance(field_versions, dict):
        raise SyncRejected("VALIDATION_ERROR")

    existing = await db.execute(
        text(
            """
            SELECT bookmark_id, fields, field_versions
            FROM sync_bookmarks
            WHERE user_id = :user_id
              AND tenant_id IS NOT DISTINCT FROM :tenant_id
              AND bookmark_key = :bookmark_key
            FOR UPDATE
            """
        ),
        {"user_id": user_id, "tenant_id": tenant_id, "bookmark_key": key},
    )
    row = existing.mappings().first()
    bookmark_id = row["bookmark_id"] if row else uuid.uuid4()
    merged_fields = dict(row["fields"] or {}) if row else {}
    merged_versions = dict(row["field_versions"] or {}) if row else {}
    default_version = int(payload.get("version", 0))
    for field, value in fields.items():
        incoming_version = int(field_versions.get(field, default_version))
        current_version = int(merged_versions.get(field, -1))
        if incoming_version >= current_version:
            merged_fields[field] = value
            merged_versions[field] = incoming_version

    await db.execute(
        text(
            """
            INSERT INTO sync_bookmarks (
                bookmark_id, user_id, tenant_id, bookmark_key, fields, field_versions
            ) VALUES (
                :bookmark_id, :user_id, :tenant_id, :bookmark_key,
                CAST(:fields AS jsonb), CAST(:field_versions AS jsonb)
            )
            ON CONFLICT (user_id, tenant_id, bookmark_key)
            DO UPDATE SET fields = EXCLUDED.fields,
                          field_versions = EXCLUDED.field_versions,
                          updated_at = CURRENT_TIMESTAMP
            """
        ),
        {
            "bookmark_id": bookmark_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "bookmark_key": key,
            "fields": json.dumps(merged_fields),
            "field_versions": json.dumps(merged_versions),
        },
    )
    return bookmark_id, {"bookmark_id": str(bookmark_id), "fields": merged_fields}


async def _process_support_case(
    db: AsyncSession,
    operation: SyncOperationIn,
    user_id: UUID,
    tenant_id: Optional[UUID],
) -> tuple[UUID, dict[str, Any]]:
    subject = operation.payload.get("subject")
    description = operation.payload.get("description")
    metadata = operation.payload.get("metadata", {})
    if (
        not isinstance(subject, str)
        or not subject.strip()
        or not isinstance(description, str)
        or not description.strip()
        or not isinstance(metadata, dict)
    ):
        raise SyncRejected("VALIDATION_ERROR")
    case_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO support_cases (
                support_case_id, user_id, tenant_id, subject, description, metadata
            ) VALUES (
                :case_id, :user_id, :tenant_id, :subject, :description, CAST(:metadata AS jsonb)
            )
            """
        ),
        {
            "case_id": case_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "subject": subject.strip(),
            "description": description.strip(),
            "metadata": json.dumps(metadata),
        },
    )
    return case_id, {"support_case_id": str(case_id), "status": "RECEIVED"}


@mobile_sync_router.post("/push", summary="Push idempotent offline operations")
async def push_operations(
    payload: SyncPushRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = getattr(request.state, "tenant_id", None)
    await _active_device(db, user.user_id, payload.device_id)
    accepted = []
    rejected = []

    for operation in payload.operations:
        await db.execute(
            text(
                "SELECT pg_advisory_xact_lock(hashtextextended(:operation_id, 0))"
            ),
            {"operation_id": str(operation.operation_id)},
        )
        cached = await _cached_operation(db, operation.operation_id, user.user_id)
        if cached:
            if cached.get("record") is False:
                rejected.append(cached["rejected"])
                continue
            (accepted if "accepted" in cached else rejected).append(
                cached.get("accepted") or cached["rejected"]
            )
            continue

        try:
            async with db.begin_nested():
                if operation.type == "exam_attempt.submit":
                    server_id, result = await _process_exam_submission(
                        db, operation, user, payload.device_id, tenant_id
                    )
                elif operation.type == "bookmark.upsert":
                    server_id, result = await _process_bookmark(
                        db, operation, user.user_id, tenant_id
                    )
                else:
                    server_id, result = await _process_support_case(
                        db, operation, user.user_id, tenant_id
                    )
                await _record_operation(
                    db,
                    operation,
                    user.user_id,
                    payload.device_id,
                    tenant_id,
                    "ACCEPTED",
                    server_id,
                    result,
                )
            accepted.append(
                {
                    "operation_id": str(operation.operation_id),
                    "server_id": str(server_id),
                    "result": result,
                }
            )
        except SyncRejected as exc:
            await _record_operation(
                db,
                operation,
                user.user_id,
                payload.device_id,
                tenant_id,
                "REJECTED",
                reason_code=exc.reason_code,
            )
            rejected.append(
                {
                    "operation_id": str(operation.operation_id),
                    "reason_code": exc.reason_code,
                }
            )
        except (IntegrityError, ValueError, TypeError, KeyError):
            await _record_operation(
                db,
                operation,
                user.user_id,
                payload.device_id,
                tenant_id,
                "REJECTED",
                reason_code="VALIDATION_ERROR",
            )
            rejected.append(
                {
                    "operation_id": str(operation.operation_id),
                    "reason_code": "VALIDATION_ERROR",
                }
            )

    await db.commit()
    return {"accepted": accepted, "rejected": rejected}


@mobile_sync_router.get("/status", summary="Check server-side operation results")
async def get_operation_status(
    operation_ids: str = Query(..., min_length=1, max_length=4000),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_ids = operation_ids.split(",")
    if len(raw_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At most 100 operation IDs may be queried.",
        )
    try:
        parsed_ids = list(dict.fromkeys(UUID(item.strip()) for item in raw_ids))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="operation_ids must be comma-separated UUIDs.",
        ) from exc

    result = await db.execute(
        text(
            """
            SELECT operation_id, status, reason_code, server_entity_id, result_payload
            FROM sync_operations_log
            WHERE user_id = :user_id AND operation_id = ANY(:operation_ids)
            """
        ),
        {"user_id": user.user_id, "operation_ids": parsed_ids},
    )
    records = {row["operation_id"]: row for row in result.mappings().all()}
    return {
        "operations": [
            {
                "operation_id": str(operation_id),
                "status": records[operation_id]["status"] if operation_id in records else "NOT_FOUND",
                "reason_code": records[operation_id]["reason_code"] if operation_id in records else None,
                "server_id": (
                    str(records[operation_id]["server_entity_id"])
                    if operation_id in records and records[operation_id]["server_entity_id"]
                    else None
                ),
                "result": (
                    records[operation_id]["result_payload"]
                    if operation_id in records
                    else None
                ),
            }
            for operation_id in parsed_ids
        ]
    }

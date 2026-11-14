import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.content.schemas import (
    CourseResourcesResponse,
    DownloadGrantResponse,
    ResourceCategorySummary,
    ResourceListItem,
    WatermarkPayload,
)
from backend.app.content.storage_adapter import storage_adapter
from backend.app.core.config import settings
from backend.app.database.models import (
    Course,
    CourseChapter,
    CourseResource,
    FeatureEntitlement,
    ResourceCategory,
    User,
    UserDevice,
)
from backend.app.entitlements.service import evaluate_resource_access


class ContentService:
    @staticmethod
    async def get_course_resources(
        db: AsyncSession,
        course_id: int,
        user_id: UUID,
        tenant_id: Optional[UUID] = None,
        resource_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        academic_year_label: Optional[str] = None,
        semester: Optional[int] = None,
        category: Optional[str] = None,
    ) -> CourseResourcesResponse:
        course_result = await db.execute(
            select(Course).where(Course.course_id == course_id)
        )
        if course_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course with ID {course_id} not found.",
            )

        now = datetime.now(timezone.utc)
        query = select(CourseResource).where(
            CourseResource.course_id == course_id,
            CourseResource.published_at.is_not(None),
            CourseResource.published_at <= now,
            or_(
                CourseResource.tenant_id.is_(None),
                CourseResource.tenant_id == tenant_id,
            ),
        ).options(
            selectinload(CourseResource.chapter),
            selectinload(CourseResource.categories),
        ).outerjoin(CourseResource.chapter)
        if resource_type:
            query = query.where(CourseResource.type == resource_type)
        if chapter_id is not None:
            query = query.where(CourseResource.chapter_id == chapter_id)
        if academic_year_label:
            query = query.where(
                CourseResource.chapter.has(
                    CourseChapter.academic_year_label == academic_year_label
                )
            )
        if semester is not None:
            query = query.where(
                CourseResource.chapter.has(CourseChapter.semester == semester)
            )
        if category:
            query = query.where(
                CourseResource.categories.any(
                    (ResourceCategory.slug == category)
                    & ResourceCategory.is_active.is_(True)
                )
            )
        result = await db.execute(
            query.order_by(
                CourseChapter.chapter_number.nulls_last(),
                CourseResource.type,
                CourseResource.title,
            )
        )
        resources = result.scalars().all()

        entitlements_result = await db.execute(
            select(FeatureEntitlement).where(
                FeatureEntitlement.user_id == user_id,
                or_(
                    FeatureEntitlement.tenant_id.is_(None),
                    FeatureEntitlement.tenant_id == tenant_id,
                ),
                FeatureEntitlement.revoked_at.is_(None),
                FeatureEntitlement.valid_from <= now,
                or_(
                    FeatureEntitlement.valid_until.is_(None),
                    FeatureEntitlement.valid_until > now,
                ),
            )
        )
        offline_allowed = any(
            grant.offline_download_allowed
            for grant in entitlements_result.scalars().all()
        )
        items = [
            ResourceListItem(
                resource_id=resource.resource_id,
                course_id=resource.course_id,
                chapter_id=resource.chapter_id,
                chapter_number=(
                    resource.chapter.chapter_number if resource.chapter else None
                ),
                chapter_title=resource.chapter.title if resource.chapter else None,
                academic_year_label=(
                    resource.chapter.academic_year_label if resource.chapter else None
                ),
                semester=resource.chapter.semester if resource.chapter else None,
                tenant_id=resource.tenant_id,
                type=resource.type,
                title=resource.title,
                storage_bucket=resource.storage_bucket,
                file_size_bytes=resource.file_size_bytes,
                sha256_checksum=resource.sha256_checksum,
                is_offline_eligible=resource.is_offline_eligible,
                version=resource.version,
                metadata=resource.metadata_ or {},
                categories=[
                    ResourceCategorySummary.model_validate(category)
                    for category in resource.categories
                    if category.is_active
                ],
                published_at=resource.published_at,
                is_accessible=offline_allowed and resource.is_offline_eligible,
            )
            for resource in resources
        ]
        return CourseResourcesResponse(
            course_id=course_id,
            total_resources=len(items),
            resources=items,
        )

    @staticmethod
    async def issue_download_grant(
        db: AsyncSession,
        resource_id: UUID,
        user: User,
        tenant_id: Optional[UUID] = None,
        device_id: Optional[UUID] = None,
        idempotency_key: Optional[str] = None,
    ) -> DownloadGrantResponse:
        decision = await evaluate_resource_access(
            db=db,
            user_id=user.user_id,
            tenant_id=tenant_id,
            resource_id=resource_id,
            action="DOWNLOAD",
        )
        if decision.reason_code == "RESOURCE_NOT_FOUND":
            if tenant_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"reason_code": "RESOURCE_TENANT_MISMATCH"},
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource {resource_id} not found.",
            )
        if decision.reason_code == "RESOURCE_TENANT_MISMATCH":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"reason_code": "RESOURCE_TENANT_MISMATCH"},
            )
        if decision.reason_code == "RESOURCE_NOT_PUBLISHED":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource is not published.",
            )
        if not decision.allowed:
            reason_code = (
                decision.reason_code
                if decision.reason_code in {
                    "ENTITLEMENT_REQUIRED",
                    "OFFLINE_NOT_PERMITTED",
                }
                else "ENTITLEMENT_REQUIRED"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"reason_code": reason_code},
            )

        resource_result = await db.execute(
            select(CourseResource).where(
                CourseResource.resource_id == resource_id,
                or_(
                    CourseResource.tenant_id.is_(None),
                    CourseResource.tenant_id == tenant_id,
                ),
            )
        )
        resource = resource_result.scalars().first()
        if resource is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource {resource_id} not found.",
            )
        if device_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="device_id is required to issue a download grant.",
            )

        device_result = await db.execute(
            select(UserDevice).where(
                UserDevice.device_id == device_id,
                UserDevice.user_id == user.user_id,
                UserDevice.revoked_at.is_(None),
            )
        )
        if device_result.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An active device registered to this user is required.",
            )

        package_id = uuid.uuid5(resource.resource_id, f"version:{resource.version}")
        fingerprint = hashlib.sha256(
            f"{user.user_id}:{tenant_id or ''}:{resource_id}:{device_id}:"
            f"{resource.version}".encode("utf-8")
        ).hexdigest()

        if idempotency_key:
            existing_result = await db.execute(
                text(
                    """
                    SELECT request_fingerprint, response
                    FROM download_grant_events
                    WHERE user_id = :user_id AND idempotency_key = :idempotency_key
                    """
                ),
                {"user_id": user.user_id, "idempotency_key": idempotency_key},
            )
            existing = existing_result.first()
            if existing:
                if existing.request_fingerprint.strip() != fingerprint:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Idempotency-Key was already used for a different request.",
                    )
                return DownloadGrantResponse.model_validate(existing.response)

        grant_id = uuid.uuid4()
        download_url = storage_adapter.create_signed_download_url(
            bucket=resource.storage_bucket,
            object_key=resource.storage_object_key,
            expires_in=3600,
        )
        ephemeral_key = storage_adapter.derive_ephemeral_aes_key(
            user_id=user.user_id,
            device_id=device_id,
            grant_id=grant_id,
            resource_id=resource.resource_id,
            version=resource.version,
        )
        legacy_key = hmac.new(
            settings.JWT_SECRET_KEY.encode("utf-8"),
            f"{grant_id}:{device_id}:{user.user_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        now = datetime.now(timezone.utc)
        device_str = str(device_id)[:8]
        watermark = WatermarkPayload(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            tenant_id=tenant_id,
            device_id=device_id,
            issued_at=now,
            formatted_watermark=(
                f"{user.full_name} • {user.email} • {device_str} • "
                f"{now.strftime('%Y-%m-%d %H:%M UTC')}"
            ),
        )
        response = DownloadGrantResponse(
            grant_id=grant_id,
            resource_id=resource.resource_id,
            package_id=package_id,
            course_id=resource.course_id,
            version=resource.version,
            title=resource.title,
            type=resource.type,
            storage_bucket=resource.storage_bucket,
            storage_object_key=resource.storage_object_key,
            download_url=download_url,
            file_size_bytes=resource.file_size_bytes,
            sha256_checksum=resource.sha256_checksum,
            ephemeral_aes_key_b64=ephemeral_key,
            license_expires_at=decision.license_expires_at,
            wrapped_aes_key=legacy_key,
            license_expiry=decision.license_expires_at,
            watermark=watermark,
        )
        response_json = response.model_dump(mode="json")
        insert_result = await db.execute(
            text(
                """
                INSERT INTO download_grant_events (
                    user_id, tenant_id, resource_id, device_id, grant_id,
                    package_id, version, idempotency_key, request_fingerprint, response
                )
                VALUES (
                    :user_id, :tenant_id, :resource_id, :device_id, :grant_id,
                    :package_id, :version, :idempotency_key, :request_fingerprint,
                    CAST(:response AS jsonb)
                )
                ON CONFLICT (user_id, idempotency_key)
                    WHERE idempotency_key IS NOT NULL
                DO NOTHING
                RETURNING event_id
                """
            ),
            {
                "user_id": user.user_id,
                "tenant_id": tenant_id,
                "resource_id": resource.resource_id,
                "device_id": device_id,
                "grant_id": grant_id,
                "package_id": package_id,
                "version": resource.version,
                "idempotency_key": idempotency_key,
                "request_fingerprint": fingerprint,
                "response": json.dumps(response_json),
            },
        )
        event_id = insert_result.scalar_one_or_none()
        if event_id is None and idempotency_key:
            raced_result = await db.execute(
                text(
                    """
                    SELECT request_fingerprint, response
                    FROM download_grant_events
                    WHERE user_id = :user_id AND idempotency_key = :idempotency_key
                    """
                ),
                {"user_id": user.user_id, "idempotency_key": idempotency_key},
            )
            raced = raced_result.first()
            if raced is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Download grant idempotency conflict; retry the request.",
                )
            if raced.request_fingerprint.strip() != fingerprint:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency-Key was already used for a different request.",
                )
            response = DownloadGrantResponse.model_validate(raced.response)

        await db.commit()
        return response

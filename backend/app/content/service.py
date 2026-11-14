import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.content.schemas import (
    CourseResourcesResponse,
    DownloadGrantResponse,
    ResourceListItem,
    WatermarkPayload,
)
from backend.app.content.storage_adapter import storage_adapter
from backend.app.core.config import settings
from backend.app.database.models import Course, CourseResource, FeatureEntitlement, User


class ContentService:
    @staticmethod
    async def get_course_resources(
        db: AsyncSession,
        course_id: int,
        user_id: uuid.UUID,
        tenant_id: Optional[uuid.UUID] = None,
        resource_type: Optional[str] = None,
    ) -> CourseResourcesResponse:
        # 1. Verify course exists
        course_res = await db.execute(select(Course).where(Course.course_id == course_id))
        course = course_res.scalar_one_or_none()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course with ID {course_id} not found.",
            )

        # 2. Query resources accessible in current workspace (personal or tenant-specific)
        query = select(CourseResource).where(
            CourseResource.course_id == course_id,
            or_(
                CourseResource.tenant_id.is_(None),
                CourseResource.tenant_id == tenant_id,
            ),
        )

        if resource_type:
            query = query.where(CourseResource.type == resource_type)

        query = query.order_by(CourseResource.type, CourseResource.title)
        res = await db.execute(query)
        resources = res.scalars().all()

        # 3. Check user's entitlement
        entitlement_res = await db.execute(
            select(FeatureEntitlement).where(
                FeatureEntitlement.user_id == user_id,
                or_(
                    FeatureEntitlement.tenant_id.is_(None),
                    FeatureEntitlement.tenant_id == tenant_id,
                ),
                FeatureEntitlement.revoked_at.is_(None),
                FeatureEntitlement.valid_from <= datetime.now(timezone.utc),
                or_(
                    FeatureEntitlement.valid_until.is_(None),
                    FeatureEntitlement.valid_until > datetime.now(timezone.utc),
                ),
            )
        )
        entitlements = entitlement_res.scalars().all()
        is_entitled = any(grant.offline_download_allowed for grant in entitlements)

        items = [
            ResourceListItem(
                resource_id=r.resource_id,
                course_id=r.course_id,
                tenant_id=r.tenant_id,
                type=r.type,
                title=r.title,
                storage_bucket=r.storage_bucket,
                file_size_bytes=r.file_size_bytes,
                sha256_checksum=r.sha256_checksum,
                is_offline_eligible=r.is_offline_eligible,
                version=r.version,
                metadata=r.metadata_ or {},
                published_at=r.published_at,
                is_accessible=is_entitled,
            )
            for r in resources
        ]

        return CourseResourcesResponse(
            course_id=course_id,
            total_resources=len(items),
            resources=items,
        )

    @staticmethod
    async def issue_download_grant(
        db: AsyncSession,
        resource_id: uuid.UUID,
        user: User,
        tenant_id: Optional[uuid.UUID] = None,
        device_id: Optional[uuid.UUID] = None,
    ) -> DownloadGrantResponse:
        # 1. Fetch resource
        res = await db.execute(
            select(CourseResource).where(
                CourseResource.resource_id == resource_id,
                or_(
                    CourseResource.tenant_id.is_(None),
                    CourseResource.tenant_id == tenant_id,
                ),
            )
        )
        resource = res.scalar_one_or_none()
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource {resource_id} not found or not accessible in current workspace.",
            )

        # 2. Check Entitlement
        entitlement_res = await db.execute(
            select(FeatureEntitlement).where(
                FeatureEntitlement.user_id == user.user_id,
                or_(
                    FeatureEntitlement.tenant_id.is_(None),
                    FeatureEntitlement.tenant_id == tenant_id,
                ),
                FeatureEntitlement.revoked_at.is_(None),
                FeatureEntitlement.valid_from <= datetime.now(timezone.utc),
                or_(
                    FeatureEntitlement.valid_until.is_(None),
                    FeatureEntitlement.valid_until > datetime.now(timezone.utc),
                ),
            )
        )
        entitlements = entitlement_res.scalars().all()
        grace_days = max(
            (grant.offline_grace_days for grant in entitlements),
            default=0,
        )
        if not any(grant.offline_download_allowed for grant in entitlements):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Offline package download is not permitted for your subscription tier.",
            )

        # 3. Generate signed download URL via StorageAdapter (Local or Supabase)
        try:
            download_url = storage_adapter.create_signed_download_url(
                bucket=resource.storage_bucket,
                object_key=resource.storage_object_key,
                expires_in=3600,
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate download grant: {str(e)}",
            )

        # 4. Generate wrapped AES-256 envelope key (ADR-009)
        # HKDF-derived 32-byte key bound to user, resource, and server secret
        key_material = f"{settings.JWT_SECRET_KEY}:{resource.resource_id}:{user.user_id}".encode("utf-8")
        wrapped_key = hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), key_material, hashlib.sha256).hexdigest()

        # 5. Build Watermark Payload & License Expiry
        now_utc = datetime.now(timezone.utc)
        license_expiry = now_utc + timedelta(days=grace_days)
        device_str = str(device_id)[:8] if device_id else "SECURE_DEVICE"
        watermark_str = f"{user.full_name} • {user.email} • {device_str} • {now_utc.strftime('%Y-%m-%d %H:%M UTC')}"

        watermark = WatermarkPayload(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            tenant_id=tenant_id,
            device_id=device_id,
            issued_at=now_utc,
            formatted_watermark=watermark_str,
        )

        grant_id = uuid.uuid4()
        return DownloadGrantResponse(
            grant_id=grant_id,
            resource_id=resource.resource_id,
            course_id=resource.course_id,
            title=resource.title,
            type=resource.type,
            storage_bucket=resource.storage_bucket,
            storage_object_key=resource.storage_object_key,
            download_url=download_url,
            file_size_bytes=resource.file_size_bytes,
            sha256_checksum=resource.sha256_checksum,
            version=resource.version,
            wrapped_aes_key=wrapped_key,
            license_expiry=license_expiry,
            watermark=watermark,
        )

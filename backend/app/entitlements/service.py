from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database.models import CourseResource, FeatureEntitlement


@dataclass(frozen=True)
class ResourceAccessDecision:
    allowed: bool
    source_type: str
    offline_download_allowed: bool
    storage_quota_mb: int
    license_expires_at: datetime
    reason_code: Optional[str] = None


async def evaluate_resource_access(
    db: AsyncSession,
    user_id: UUID,
    tenant_id: Optional[UUID],
    resource_id: UUID,
    action: str,
) -> ResourceAccessDecision:
    """Evaluate publication, workspace visibility, and active entitlement grants."""
    now = datetime.now(timezone.utc)
    resource_result = await db.execute(
        select(CourseResource).where(CourseResource.resource_id == resource_id)
    )
    resource = resource_result.scalars().first()
    if resource is None:
        return ResourceAccessDecision(
            allowed=False,
            source_type="NONE",
            offline_download_allowed=False,
            storage_quota_mb=0,
            license_expires_at=now,
            reason_code="RESOURCE_NOT_FOUND",
        )

    if resource.tenant_id is not None and resource.tenant_id != tenant_id:
        return ResourceAccessDecision(
            allowed=False,
            source_type="NONE",
            offline_download_allowed=False,
            storage_quota_mb=0,
            license_expires_at=now,
            reason_code="RESOURCE_TENANT_MISMATCH",
        )

    if resource.published_at is None or resource.published_at > now:
        return ResourceAccessDecision(
            allowed=False,
            source_type="NONE",
            offline_download_allowed=False,
            storage_quota_mb=0,
            license_expires_at=now,
            reason_code="RESOURCE_NOT_PUBLISHED",
        )

    tenant_filter = (
        FeatureEntitlement.tenant_id.is_(None)
        if tenant_id is None
        else or_(
            FeatureEntitlement.tenant_id.is_(None),
            FeatureEntitlement.tenant_id == tenant_id,
        )
    )
    grants_result = await db.execute(
        select(FeatureEntitlement)
        .where(
            FeatureEntitlement.user_id == user_id,
            tenant_filter,
            FeatureEntitlement.revoked_at.is_(None),
            FeatureEntitlement.valid_from <= now,
            or_(
                FeatureEntitlement.valid_until.is_(None),
                FeatureEntitlement.valid_until > now,
            ),
        )
        .order_by(FeatureEntitlement.tenant_id.desc().nulls_last())
    )
    grants = grants_result.scalars().all()
    if not grants:
        return ResourceAccessDecision(
            allowed=False,
            source_type="NONE",
            offline_download_allowed=False,
            storage_quota_mb=0,
            license_expires_at=now,
            reason_code="ENTITLEMENT_REQUIRED",
        )

    source_type = str(grants[0].source_type)
    offline_allowed = any(grant.offline_download_allowed for grant in grants)
    storage_quota = max(grant.storage_quota_mb for grant in grants)
    grace_days = max(grant.offline_grace_days for grant in grants)
    license_expiry = now + timedelta(days=grace_days)
    valid_until = min(
        (grant.valid_until for grant in grants if grant.valid_until is not None),
        default=None,
    )
    if valid_until is not None:
        license_expiry = min(license_expiry, valid_until)

    if action.upper() == "DOWNLOAD" and (
        not resource.is_offline_eligible or not offline_allowed
    ):
        return ResourceAccessDecision(
            allowed=False,
            source_type=source_type,
            offline_download_allowed=False,
            storage_quota_mb=storage_quota,
            license_expires_at=license_expiry,
            reason_code="OFFLINE_NOT_PERMITTED",
        )

    return ResourceAccessDecision(
        allowed=True,
        source_type=source_type,
        offline_download_allowed=offline_allowed,
        storage_quota_mb=storage_quota,
        license_expires_at=license_expiry,
    )

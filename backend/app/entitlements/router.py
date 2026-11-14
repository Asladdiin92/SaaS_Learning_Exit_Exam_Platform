from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import create_offline_grant, get_current_user
from backend.app.database.models import FeatureEntitlement, User, UserDevice
from backend.app.database.session import get_db
from backend.app.entitlements.schemas import EntitlementsResponse

entitlements_router = APIRouter(tags=["Entitlements"])


@entitlements_router.get(
    "/me/entitlements",
    response_model=EntitlementsResponse,
    summary="Evaluate active personal and institutional entitlement grants",
)
async def get_my_entitlements(
    device_id: Optional[UUID] = Query(None),
    x_tenant_id: Optional[UUID] = Header(None, alias="X-Tenant-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    tenant_scope = (
        FeatureEntitlement.tenant_id.is_(None)
        if x_tenant_id is None
        else or_(
            FeatureEntitlement.tenant_id.is_(None),
            FeatureEntitlement.tenant_id == x_tenant_id,
        )
    )
    grants_result = await db.execute(
        select(FeatureEntitlement).where(
            FeatureEntitlement.user_id == current_user.user_id,
            tenant_scope,
            FeatureEntitlement.revoked_at.is_(None),
            FeatureEntitlement.valid_from <= now,
            or_(
                FeatureEntitlement.valid_until.is_(None),
                FeatureEntitlement.valid_until > now,
            ),
        )
    )
    grants = grants_result.scalars().all()
    offline_allowed = any(grant.offline_download_allowed for grant in grants)
    storage_quota = max((grant.storage_quota_mb for grant in grants), default=0)
    ai_quota = max((grant.ai_monthly_quota for grant in grants), default=0)
    grace_days = max((grant.offline_grace_days for grant in grants), default=0)

    device_query = select(UserDevice).where(
        UserDevice.user_id == current_user.user_id,
        UserDevice.revoked_at.is_(None),
    )
    if device_id:
        device_query = device_query.where(UserDevice.device_id == device_id)
    device_result = await db.execute(device_query.order_by(UserDevice.last_seen_at.desc()).limit(1))
    device = device_result.scalars().first()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Register an active device before requesting an offline grant.",
        )

    return EntitlementsResponse(
        user_id=current_user.user_id,
        tenant_id=x_tenant_id,
        offline_download_allowed=offline_allowed,
        storage_quota_mb=storage_quota,
        ai_monthly_quota=ai_quota,
        offline_grace_days=grace_days,
        offline_grant=create_offline_grant(
            current_user.user_id,
            device.device_id,
            tenant_id=x_tenant_id,
            expires_in_days=max(grace_days, 1),
            entitlements={
                "offline_download_allowed": offline_allowed,
                "storage_quota_mb": storage_quota,
                "ai_monthly_quota": ai_quota,
                "offline_grace_days": grace_days,
            },
        ),
    )

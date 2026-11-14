import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.content.schemas import (
    CourseResourcesResponse,
    DownloadGrantRequest,
    DownloadGrantResponse,
)
from backend.app.content.service import ContentService
from backend.app.core.security import get_current_user
from backend.app.database.models import User
from backend.app.database.session import get_db

content_router = APIRouter(tags=["Course Resources & DRM"])


@content_router.get(
    "/courses/{course_id}/resources",
    response_model=CourseResourcesResponse,
    summary="List authorized course resources with offline eligibility",
)
async def list_course_resources(
    course_id: int,
    type: Optional[str] = Query(None, description="Filter by resource_type"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_uuid = None
    if x_tenant_id:
        try:
            tenant_uuid = uuid.UUID(x_tenant_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Tenant-ID header format.",
            )

    return await ContentService.get_course_resources(
        db=db,
        course_id=course_id,
        user_id=current_user.user_id,
        tenant_id=tenant_uuid,
        resource_type=type,
    )


@content_router.post(
    "/resources/{resource_id}/download-grant",
    response_model=DownloadGrantResponse,
    summary="Evaluate entitlement and issue signed download grant with wrapped AES key",
)
async def issue_resource_download_grant(
    resource_id: uuid.UUID,
    payload: Optional[DownloadGrantRequest] = None,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_uuid = None
    if x_tenant_id:
        try:
            tenant_uuid = uuid.UUID(x_tenant_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Tenant-ID header format.",
            )

    device_id = payload.device_id if payload else None

    return await ContentService.issue_download_grant(
        db=db,
        resource_id=resource_id,
        user=current_user,
        tenant_id=tenant_uuid,
        device_id=device_id,
    )

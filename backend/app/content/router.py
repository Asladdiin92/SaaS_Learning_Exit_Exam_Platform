import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
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
    chapter_id: Optional[int] = Query(None, gt=0),
    academic_year_label: Optional[str] = Query(None, min_length=1, max_length=32),
    semester: Optional[int] = Query(None, ge=1, le=2),
    category: Optional[str] = Query(None, min_length=1, max_length=64),
    x_tenant_id: Optional[uuid.UUID] = Header(None, alias="X-Tenant-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ContentService.get_course_resources(
        db=db,
        course_id=course_id,
        user_id=current_user.user_id,
        tenant_id=x_tenant_id,
        resource_type=type,
        chapter_id=chapter_id,
        academic_year_label=academic_year_label,
        semester=semester,
        category=category,
    )


@content_router.post(
    "/resources/{resource_id}/download-grant",
    response_model=DownloadGrantResponse,
    summary="Evaluate entitlement and issue signed download grant with wrapped AES key",
)
async def issue_resource_download_grant(
    resource_id: uuid.UUID,
    payload: Optional[DownloadGrantRequest] = None,
    x_tenant_id: Optional[uuid.UUID] = Header(None, alias="X-Tenant-ID"),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key", max_length=255),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    device_id = payload.device_id if payload else None
    if idempotency_key is not None and not idempotency_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key cannot be blank.",
        )
    try:
        return await ContentService.issue_download_grant(
            db=db,
            resource_id=resource_id,
            user=current_user,
            tenant_id=x_tenant_id,
            device_id=device_id,
            idempotency_key=idempotency_key.strip() if idempotency_key else None,
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_403_FORBIDDEN and isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        raise

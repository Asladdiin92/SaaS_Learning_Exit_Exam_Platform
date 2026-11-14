import uuid
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.security import get_current_user
from backend.app.database.models import Tenant, TenantMembership, User
from backend.app.database.session import get_db
from backend.app.tenants.schemas import (
    CreateTenantRequest,
    MembershipResponse,
    TenantInviteRequest,
    TenantResponse,
    WorkspaceItem,
    WorkspacesResponse,
)

tenants_router = APIRouter(tags=["Tenants & Workspaces"])


@tenants_router.get(
    "/me/workspaces",
    response_model=WorkspacesResponse,
    summary="List Personal Workspace and active institutional memberships",
)
async def get_my_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Personal Workspace is always available (tenant_id = None)
    personal = WorkspaceItem(
        tenant_id=None,
        organization_name=f"{current_user.full_name}'s Personal Workspace",
        slug="personal",
        role="OWNER",
        status="ACTIVE",
        is_personal=True,
    )

    # Fetch active tenant memberships
    stmt = (
        select(TenantMembership)
        .options(selectinload(TenantMembership.tenant))
        .where(
            TenantMembership.user_id == current_user.user_id,
            TenantMembership.status == "ACTIVE",
        )
    )
    result = await db.execute(stmt)
    memberships = result.scalars().all()

    institutional = [
        WorkspaceItem(
            tenant_id=m.tenant.tenant_id,
            organization_name=m.tenant.organization_name,
            slug=m.tenant.slug,
            role=m.role,
            status=m.status,
            is_personal=False,
            cohort_name=m.cohort_name,
            joined_at=m.joined_at,
        )
        for m in memberships
        if m.tenant and m.tenant.status == "ACTIVE"
    ]

    return WorkspacesResponse(
        personal_workspace=personal,
        institutional_workspaces=institutional,
    )


@tenants_router.post(
    "/tenants",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new institution tenant and enroll caller as TENANT_ADMIN",
)
async def create_tenant(
    payload: CreateTenantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check slug uniqueness
    stmt = select(Tenant).where(Tenant.slug == payload.slug)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant slug '{payload.slug}' is already taken.",
        )

    new_tenant = Tenant(
        tenant_id=uuid.uuid4(),
        organization_name=payload.organization_name,
        slug=payload.slug,
        status="ACTIVE",
    )
    db.add(new_tenant)
    await db.flush()

    # Automatically add creator as TENANT_ADMIN
    admin_membership = TenantMembership(
        membership_id=uuid.uuid4(),
        user_id=current_user.user_id,
        tenant_id=new_tenant.tenant_id,
        role="TENANT_ADMIN",
        status="ACTIVE",
        cohort_name="Administration",
    )
    db.add(admin_membership)
    await db.commit()
    await db.refresh(new_tenant)

    return TenantResponse.model_validate(new_tenant)


@tenants_router.post(
    "/tenants/{tenant_id}/invitations",
    response_model=MembershipResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a student or instructor to an institutional workspace",
)
async def invite_to_tenant(
    tenant_id: UUID,
    payload: TenantInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify caller is TENANT_ADMIN or SUPER_ADMIN in this tenant
    auth_check = select(TenantMembership).where(
        TenantMembership.tenant_id == tenant_id,
        TenantMembership.user_id == current_user.user_id,
        TenantMembership.role.in_(["TENANT_ADMIN", "SUPER_ADMIN"]),
        TenantMembership.status == "ACTIVE",
    )
    res = await db.execute(auth_check)
    if not res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permissions for this tenant workspace.",
        )

    # Find the target user by email
    target_user_stmt = select(User).where(User.email == payload.email)
    target_res = await db.execute(target_user_stmt)
    target_user = target_res.scalars().first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{payload.email}' not found.",
        )

    # Check if membership already exists
    mem_check = select(TenantMembership).where(
        TenantMembership.tenant_id == tenant_id,
        TenantMembership.user_id == target_user.user_id,
    )
    existing_mem = (await db.execute(mem_check)).scalars().first()

    if existing_mem:
        existing_mem.role = payload.role
        existing_mem.cohort_name = payload.cohort_name or existing_mem.cohort_name
        existing_mem.status = "ACTIVE"
        await db.commit()
        await db.refresh(existing_mem)
        return MembershipResponse.model_validate(existing_mem)

    new_membership = TenantMembership(
        membership_id=uuid.uuid4(),
        user_id=target_user.user_id,
        tenant_id=tenant_id,
        role=payload.role,
        status="ACTIVE",
        cohort_name=payload.cohort_name,
    )
    db.add(new_membership)
    await db.commit()
    await db.refresh(new_membership)

    return MembershipResponse.model_validate(new_membership)

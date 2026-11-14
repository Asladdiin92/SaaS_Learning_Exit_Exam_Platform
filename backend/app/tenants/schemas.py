from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class WorkspaceItem(BaseModel):
    tenant_id: Optional[UUID] = None
    organization_name: str
    slug: Optional[str] = None
    role: str
    status: str
    is_personal: bool
    cohort_name: Optional[str] = None
    joined_at: Optional[datetime] = None


class WorkspacesResponse(BaseModel):
    personal_workspace: WorkspaceItem
    institutional_workspaces: List[WorkspaceItem]


class CreateTenantRequest(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")


class TenantResponse(BaseModel):
    tenant_id: UUID
    organization_name: str
    slug: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TenantInviteRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="STUDENT", pattern=r"^(INSTRUCTOR|STUDENT)$")
    cohort_name: Optional[str] = None


class MembershipResponse(BaseModel):
    membership_id: UUID
    tenant_id: UUID
    user_id: UUID
    role: str
    status: str
    cohort_name: Optional[str]
    joined_at: datetime

    class Config:
        from_attributes = True

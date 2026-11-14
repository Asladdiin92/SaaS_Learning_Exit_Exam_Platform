from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class EntitlementsResponse(BaseModel):
    user_id: UUID
    tenant_id: Optional[UUID] = None
    offline_download_allowed: bool
    storage_quota_mb: int
    ai_monthly_quota: int
    offline_grace_days: int
    offline_grant: str

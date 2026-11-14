import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ResourceListItem(BaseModel):
    resource_id: uuid.UUID
    course_id: int
    tenant_id: Optional[uuid.UUID] = None
    type: str
    title: str
    storage_bucket: str
    file_size_bytes: int
    sha256_checksum: Optional[str] = None
    is_offline_eligible: bool
    version: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    published_at: Optional[datetime] = None
    is_accessible: bool = True

    class Config:
        from_attributes = True


class CourseResourcesResponse(BaseModel):
    course_id: int
    total_resources: int
    resources: List[ResourceListItem]


class DownloadGrantRequest(BaseModel):
    device_id: Optional[uuid.UUID] = None


class WatermarkPayload(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    tenant_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
    issued_at: datetime
    formatted_watermark: str


class DownloadGrantResponse(BaseModel):
    grant_id: uuid.UUID
    resource_id: uuid.UUID
    course_id: int
    title: str
    type: str
    storage_bucket: str
    storage_object_key: str
    download_url: str
    file_size_bytes: int
    sha256_checksum: Optional[str] = None
    version: int
    wrapped_aes_key: str
    license_expiry: datetime
    watermark: WatermarkPayload

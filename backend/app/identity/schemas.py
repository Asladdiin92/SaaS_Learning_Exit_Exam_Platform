from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Argon2id hashed password")
    full_name: str = Field(..., min_length=2, max_length=255)
    device_id: Optional[UUID] = None
    device_name: Optional[str] = "Web / Unknown Device"
    os_version: Optional[str] = None
    app_version: Optional[str] = None


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_id: UUID
    device_name: Optional[str] = "Default Device"
    os_version: Optional[str] = None
    app_version: Optional[str] = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str
    device_id: UUID


class LogoutRequest(BaseModel):
    device_id: UUID


class DeviceRegisterRequest(BaseModel):
    device_id: UUID
    device_name: str = Field(..., min_length=1, max_length=255)
    os_version: Optional[str] = Field(default=None, max_length=64)
    app_version: Optional[str] = Field(default=None, max_length=32)


class DeviceOut(BaseModel):
    device_id: UUID
    device_name: str
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    last_seen_at: datetime

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    user_id: UUID
    email: str
    full_name: str
    is_email_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    offline_biometric_grant: str
    device_id: UUID
    token_type: str = "Bearer"
    expires_in: int = 900  # 15 minutes
    user: UserOut

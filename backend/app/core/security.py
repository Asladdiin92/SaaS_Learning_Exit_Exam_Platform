import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.database.models import Tenant, TenantMembership, User, UserDevice
from backend.app.database.session import get_db, set_rls_context

hasher = PasswordHasher()
security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password with Argon2id."""
    return hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against an Argon2id hash."""
    try:
        return hasher.verify(hashed_password, plain_password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: UUID, email: str, device_id: Optional[UUID] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    if device_id:
        payload["device_id"] = str(device_id)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def create_offline_grant(
    user_id: UUID,
    device_id: UUID,
    tenant_id: Optional[UUID] = None,
    expires_in_days: int = 7,
    entitlements: Optional[dict[str, Any]] = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "device_id": str(device_id),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "type": "offline_biometric_grant",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expires_in_days)).timestamp()),
    }
    if entitlements is not None:
        payload["entitlements"] = entitlements
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def get_current_user(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            auth_header.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token type.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = UUID(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tenant_id = None
    tenant_header = request.headers.get("X-Tenant-ID")
    if tenant_header:
        try:
            tenant_id = UUID(tenant_header)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Tenant-ID header format.",
            ) from exc

    await set_rls_context(db, user_id=user.user_id, tenant_id=tenant_id)

    if tenant_id:
        membership_result = await db.execute(
            select(TenantMembership)
            .join(Tenant, Tenant.tenant_id == TenantMembership.tenant_id)
            .where(
                TenantMembership.user_id == user.user_id,
                TenantMembership.tenant_id == tenant_id,
                TenantMembership.status == "ACTIVE",
                Tenant.status == "ACTIVE",
            )
        )
        if membership_result.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not an active member of the requested workspace.",
            )

    device_id_claim = payload.get("device_id")
    if device_id_claim:
        try:
            device_id = UUID(device_id_claim)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid device claim.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        device_result = await db.execute(
            select(UserDevice).where(
                UserDevice.device_id == device_id,
                UserDevice.user_id == user.user_id,
                UserDevice.revoked_at.is_(None),
            )
        )
        if device_result.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Device session has been revoked.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    request.state.user_id = user.user_id
    request.state.tenant_id = tenant_id
    return user

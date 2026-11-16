import os
from typing import Optional
from fastapi import Header, HTTPException, Security, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.database.models import User, TenantMembership

security_bearer = HTTPBearer(auto_error=False)

PLATFORM_OWNER_EMAIL = "asladdiinabduqaadir@gmail.com"
ADMIN_MASTER_KEY = os.getenv("ADMIN_MASTER_KEY", "asladin-platform-owner-master-key-2026")


async def get_current_admin(
    admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Authenticates Platform Owner / Super Admin.
    Accepts:
    1. X-Admin-Key header matching ADMIN_MASTER_KEY (ONLY accepted in development/dev/test environments).
    2. Bearer access token belonging to the platform owner or a user with SUPER_ADMIN role (production & dev).
    """
    is_dev_env = (settings.ENVIRONMENT or "").lower() in ("development", "dev", "test")

    # 1. Master Key verification (ONLY accepted in development / test environments)
    if admin_key and admin_key == ADMIN_MASTER_KEY:
        if is_dev_env:
            return {
                "email": PLATFORM_OWNER_EMAIL,
                "role": "SUPER_ADMIN",
                "is_owner": True,
                "source": "master_key",
            }
        # In production, master key header bypass is strictly rejected

    # 2. JWT Bearer token verification (Production & Dev)
    if auth_header and auth_header.credentials:
        try:
            payload = jwt.decode(
                auth_header.credentials,
                settings.JWT_SECRET_KEY,
                algorithms=["HS256"],
            )
            email = payload.get("email")
            role = payload.get("role")
            user_id = payload.get("sub")

            # Check if matching owner email or role == "SUPER_ADMIN"
            if email == PLATFORM_OWNER_EMAIL or role == "SUPER_ADMIN":
                return {
                    "email": email or PLATFORM_OWNER_EMAIL,
                    "user_id": user_id,
                    "role": "SUPER_ADMIN",
                    "is_owner": (email == PLATFORM_OWNER_EMAIL),
                    "source": "jwt_owner" if email == PLATFORM_OWNER_EMAIL else "jwt_super_admin",
                }

            # Check if user has active SUPER_ADMIN tenant membership in DB
            if user_id:
                m_res = await db.execute(
                    select(TenantMembership).where(
                        TenantMembership.user_id == user_id,
                        TenantMembership.role == "SUPER_ADMIN",
                        TenantMembership.status == "ACTIVE",
                    )
                )
                membership = m_res.scalars().first()
                if membership:
                    return {
                        "email": email,
                        "user_id": user_id,
                        "role": "SUPER_ADMIN",
                        "is_owner": False,
                        "source": "jwt_membership",
                    }
        except Exception:
            pass

    # 3. If development environment and no credentials sent, allow seamless local dev inspection
    if is_dev_env and not auth_header and not admin_key:
        return {
            "email": PLATFORM_OWNER_EMAIL,
            "role": "SUPER_ADMIN",
            "is_owner": True,
            "source": "dev_bypass",
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Platform Owner / Super Admin access required. In production, a valid Bearer JWT is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )

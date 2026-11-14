import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.security import (
    create_access_token,
    create_offline_grant,
    generate_refresh_token,
    get_current_user,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from backend.app.database.models import (
    FeatureEntitlement,
    RefreshTokenHistory,
    User,
    UserDevice,
)
from backend.app.database.session import get_db
from backend.app.identity.schemas import (
    AuthResponse,
    DeviceOut,
    DeviceRegisterRequest,
    LogoutRequest,
    TokenRefreshRequest,
    UserLoginRequest,
    UserOut,
    UserRegisterRequest,
)

auth_router = APIRouter(tags=["Identity & Auth"])


async def _issue_refresh_token(
    db: AsyncSession,
    user: User,
    device: UserDevice,
    family_id: UUID,
) -> str:
    raw_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    device.refresh_token_family_id = family_id
    device.refresh_token_hash = token_hash
    device.revoked_at = None
    device.last_seen_at = datetime.now(timezone.utc)
    await db.flush()
    db.add(
        RefreshTokenHistory(
            token_hash=token_hash,
            user_id=user.user_id,
            device_id=device.device_id,
            family_id=family_id,
            expires_at=expires_at,
        )
    )
    return raw_token


def _auth_response(user: User, device: UserDevice, refresh_token: str) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.user_id, user.email, device.device_id),
        refresh_token=refresh_token,
        offline_biometric_grant=create_offline_grant(user.user_id, device.device_id),
        device_id=device.device_id,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user),
    )


async def _revoke_family(
    db: AsyncSession,
    family_id: UUID,
    user_id: UUID,
) -> None:
    await db.execute(
        text("SELECT public.revoke_refresh_token_family(:family_id, :user_id)"),
        {"family_id": family_id, "user_id": user_id},
    )


@auth_router.post(
    "/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a global user and issue initial device tokens",
)
async def register(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    email = str(payload.email).lower()
    existing = await db.execute(select(User.user_id).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    device_id = payload.device_id or uuid.uuid4()
    registered_device = await db.execute(
        select(UserDevice).where(UserDevice.device_id == device_id)
    )
    if registered_device.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This device is already registered.",
        )

    user = User(
        user_id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        is_email_verified=False,
    )
    db.add(user)
    await db.flush()

    db.add(
        FeatureEntitlement(
            entitlement_id=uuid.uuid4(),
            user_id=user.user_id,
            tenant_id=None,
            source_type="FREE_TIER",
            scope_type="GLOBAL",
            offline_download_allowed=True,
            offline_grace_days=7,
            storage_quota_mb=2048,
            ai_monthly_quota=50,
        )
    )
    device = UserDevice(
        device_id=device_id,
        user_id=user.user_id,
        device_name=payload.device_name or "Initial Registration Device",
        os_version=payload.os_version,
        app_version=payload.app_version,
    )
    db.add(device)
    family_id = uuid.uuid4()
    refresh_token = await _issue_refresh_token(db, user, device, family_id)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        duplicate_user = await db.scalar(select(User.user_id).where(User.email == email))
        duplicate_device = await db.scalar(
            select(UserDevice.device_id).where(UserDevice.device_id == device_id)
        )
        if duplicate_user is not None or duplicate_device is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The email address or device is already registered.",
            ) from exc
        raise
    await db.refresh(user)
    return _auth_response(user, device, refresh_token)


@auth_router.post(
    "/auth/login",
    response_model=AuthResponse,
    summary="Authenticate and receive access, rotating refresh, and offline tokens",
)
async def login(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(
        select(User).where(User.email == str(payload.email).lower())
    )
    user = user_result.scalars().first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    device_result = await db.execute(
        select(UserDevice)
        .where(UserDevice.device_id == payload.device_id)
        .with_for_update()
    )
    device = device_result.scalars().first()
    if device and device.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This device is registered to another user.",
        )

    if device is None:
        device = UserDevice(
            device_id=payload.device_id,
            user_id=user.user_id,
            device_name=payload.device_name or "Mobile / Web Device",
            os_version=payload.os_version,
            app_version=payload.app_version,
        )
        db.add(device)
    else:
        if device.refresh_token_family_id:
            await _revoke_family(db, device.refresh_token_family_id, user.user_id)
            await db.refresh(device)
        device.device_name = payload.device_name or device.device_name
        device.os_version = payload.os_version or device.os_version
        device.app_version = payload.app_version or device.app_version

    family_id = uuid.uuid4()
    refresh_token = await _issue_refresh_token(db, user, device, family_id)
    await db.commit()
    return _auth_response(user, device, refresh_token)


@auth_router.post(
    "/auth/refresh",
    response_model=AuthResponse,
    summary="Rotate a single-use refresh token and revoke a replayed token family",
)
async def refresh_tokens(
    payload: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(payload.refresh_token)
    token_result = await db.execute(
        select(RefreshTokenHistory)
        .where(RefreshTokenHistory.token_hash == token_hash)
        .with_for_update()
    )
    token_record = token_result.scalars().first()
    if token_record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    if token_record.consumed_at is not None or token_record.revoked_at is not None:
        await _revoke_family(db, token_record.family_id, token_record.user_id)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. TOKEN_REUSE_DETECTED",
        )

    if token_record.device_id != payload.device_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is not bound to this device.",
        )

    device_result = await db.execute(
        select(UserDevice)
        .where(
            UserDevice.device_id == payload.device_id,
            UserDevice.user_id == token_record.user_id,
        )
        .with_for_update()
    )
    device = device_result.scalars().first()
    if (
        device is None
        or device.revoked_at is not None
        or device.refresh_token_family_id != token_record.family_id
        or device.refresh_token_hash != token_hash
    ):
        await _revoke_family(db, token_record.family_id, token_record.user_id)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. TOKEN_REUSE_DETECTED",
        )

    if token_record.expires_at <= now:
        token_record.revoked_at = now
        device.revoked_at = now
        device.refresh_token_hash = None
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired.",
        )

    user_result = await db.execute(select(User).where(User.user_id == token_record.user_id))
    user = user_result.scalars().first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    token_record.consumed_at = now
    refresh_token = await _issue_refresh_token(
        db, user, device, token_record.family_id
    )
    await db.commit()
    return _auth_response(user, device, refresh_token)


@auth_router.post("/auth/logout", status_code=status.HTTP_200_OK)
async def logout(
    payload: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.device_id == payload.device_id,
            UserDevice.user_id == current_user.user_id,
        )
    )
    device = result.scalars().first()
    if device:
        if device.refresh_token_family_id:
            await _revoke_family(
                db, device.refresh_token_family_id, current_user.user_id
            )
        device.revoked_at = datetime.now(timezone.utc)
        device.refresh_token_hash = None
        await db.commit()
    return {"message": "Successfully logged out.", "status": "revoked"}


@auth_router.post(
    "/devices/register",
    response_model=DeviceOut,
    status_code=status.HTTP_200_OK,
    summary="Register or update the authenticated user's device profile",
)
async def register_device(
    payload: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserDevice)
        .where(UserDevice.device_id == payload.device_id)
        .with_for_update()
    )
    device = result.scalars().first()
    if device and device.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This device is registered to another user.",
        )
    if device is None:
        device = UserDevice(
            device_id=payload.device_id,
            user_id=current_user.user_id,
            device_name=payload.device_name,
            os_version=payload.os_version,
            app_version=payload.app_version,
            last_seen_at=datetime.now(timezone.utc),
        )
        db.add(device)
    else:
        device.device_name = payload.device_name
        device.os_version = payload.os_version
        device.app_version = payload.app_version
        device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(device)
    return device


@auth_router.delete("/devices/{device_id}", status_code=status.HTTP_200_OK)
async def revoke_device(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserDevice)
        .where(
            UserDevice.device_id == device_id,
            UserDevice.user_id == current_user.user_id,
        )
        .with_for_update()
    )
    device = result.scalars().first()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )
    if device.refresh_token_family_id:
        await _revoke_family(
            db, device.refresh_token_family_id, current_user.user_id
        )
    device.revoked_at = datetime.now(timezone.utc)
    device.refresh_token_hash = None
    await db.commit()
    return {"device_id": str(device_id), "status": "revoked"}

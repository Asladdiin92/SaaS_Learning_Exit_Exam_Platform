import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    get_current_user,
)
from backend.app.database.models import User, UserDevice
from backend.app.database.session import get_db
from backend.app.identity.schemas import (
    AuthResponse,
    LogoutRequest,
    TokenRefreshRequest,
    UserLoginRequest,
    UserOut,
    UserRegisterRequest,
)

auth_router = APIRouter(prefix="/auth", tags=["Identity & Auth"])


@auth_router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new global user account",
)
async def register(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email is already registered
    existing_user_stmt = select(User).where(User.email == payload.email)
    existing_res = await db.execute(existing_user_stmt)
    if existing_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    # Create new user with Argon2id password hash
    new_user = User(
        user_id=uuid.uuid4(),
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        is_email_verified=False,
    )
    db.add(new_user)
    await db.flush()

    # Device binding & token issuance
    device_id = payload.device_id or uuid.uuid4()
    family_id = uuid.uuid4()
    raw_refresh_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_refresh_token)

    device = UserDevice(
        device_id=device_id,
        user_id=new_user.user_id,
        device_name=payload.device_name or "Initial Registration Device",
        refresh_token_family_id=family_id,
        refresh_token_hash=token_hash,
        last_seen_at=datetime.now(timezone.utc),
    )
    db.add(device)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(
        user_id=new_user.user_id, email=new_user.email, device_id=device_id
    )

    return AuthResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        user=UserOut.model_validate(new_user),
    )


@auth_router.post(
    "/login",
    response_model=AuthResponse,
    summary="Authenticate and receive access + refresh token bound to device",
)
async def login(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Upsert or update device session
    device_stmt = select(UserDevice).where(UserDevice.device_id == payload.device_id)
    device_res = await db.execute(device_stmt)
    device = device_res.scalars().first()

    raw_refresh_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_refresh_token)
    family_id = uuid.uuid4()

    if device:
        device.user_id = user.user_id
        device.device_name = payload.device_name or device.device_name
        device.os_version = payload.os_version or device.os_version
        device.app_version = payload.app_version or device.app_version
        device.refresh_token_family_id = family_id
        device.refresh_token_hash = token_hash
        device.revoked_at = None
        device.last_seen_at = datetime.now(timezone.utc)
    else:
        device = UserDevice(
            device_id=payload.device_id,
            user_id=user.user_id,
            device_name=payload.device_name or "Mobile / Web Device",
            os_version=payload.os_version,
            app_version=payload.app_version,
            refresh_token_family_id=family_id,
            refresh_token_hash=token_hash,
            last_seen_at=datetime.now(timezone.utc),
        )
        db.add(device)

    await db.commit()

    access_token = create_access_token(
        user_id=user.user_id, email=user.email, device_id=payload.device_id
    )

    return AuthResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        user=UserOut.model_validate(user),
    )


@auth_router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Rotate single-use refresh token and invalidate family on reuse",
)
async def refresh_tokens(payload: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(UserDevice).where(UserDevice.device_id == payload.device_id)
    res = await db.execute(stmt)
    device = res.scalars().first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unrecognized device session.",
        )

    if device.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device session has been revoked. Please sign in again.",
        )

    # Verify submitted refresh token hash
    submitted_hash = hash_refresh_token(payload.refresh_token)
    if device.refresh_token_hash != submitted_hash:
        # Potential token reuse / replay attack detected!
        # Invalidate the entire token family immediately
        device.revoked_at = datetime.now(timezone.utc)
        device.refresh_token_hash = None
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. Device session revoked.",
        )

    # Fetch user
    user_stmt = select(User).where(User.user_id == device.user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    # Rotate token
    new_raw_refresh = generate_refresh_token()
    device.refresh_token_hash = hash_refresh_token(new_raw_refresh)
    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token(
        user_id=user.user_id, email=user.email, device_id=device.device_id
    )

    return AuthResponse(
        access_token=access_token,
        refresh_token=new_raw_refresh,
        user=UserOut.model_validate(user),
    )


@auth_router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke device session and refresh token",
)
async def logout(
    payload: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UserDevice).where(
        UserDevice.device_id == payload.device_id,
        UserDevice.user_id == current_user.user_id,
    )
    res = await db.execute(stmt)
    device = res.scalars().first()

    if device:
        device.revoked_at = datetime.now(timezone.utc)
        device.refresh_token_hash = None
        await db.commit()

    return {"message": "Successfully logged out.", "status": "revoked"}

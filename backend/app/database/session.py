from typing import AsyncGenerator, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import text
from fastapi import HTTPException, Request, status
from backend.app.core.config import settings

# Supabase Transaction Pooler (PgBouncer port 6543) does not support prepared statements.
# connect_args={"statement_cache_size": 0} is required to prevent "prepared statement does not exist" errors.
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG and settings.ENVIRONMENT == "development",
    future=True,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def set_rls_context(
    session: AsyncSession,
    user_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
) -> None:
    """Sets PostgreSQL session variables for Row-Level Security (RLS) policies.
    
    Uses transaction-scoped set_config(..., true) and SET LOCAL ROLE authenticated
    so settings and permissions are automatically isolated to the current transaction.
    """
    user_val = str(user_id) if user_id else ""
    tenant_val = str(tenant_id) if tenant_id else ""

    if user_id or tenant_id:
        await session.execute(text("SET LOCAL ROLE authenticated"))

    await session.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": user_val},
    )
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
        {"tenant_id": tenant_val},
    )


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session configured with RLS context."""
    async with AsyncSessionLocal() as session:
        try:
            user_id = getattr(request.state, "user_id", None)
            tenant_id = getattr(request.state, "tenant_id", None)

            # Fallback to header if state was not populated by auth middleware yet
            if tenant_id is None:
                header_tenant = request.headers.get("X-Tenant-ID")
                if header_tenant:
                    try:
                        tenant_id = UUID(header_tenant)
                    except ValueError:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid X-Tenant-ID header format.",
                        )

            await set_rls_context(session, user_id=user_id, tenant_id=tenant_id)
            yield session
        finally:
            await session.close()

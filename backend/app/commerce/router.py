import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database.session import get_db, set_rls_context
from backend.app.core.security import get_current_user
from backend.app.database.models import (
    User,
    Product,
    Order,
    PaymentEvent,
    FeatureEntitlement,
    grant_source_type_enum,
)
from backend.app.commerce.schemas import (
    ProductResponse,
    CreateOrderRequest,
    OrderResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    WebhookResponse,
)
from backend.app.commerce.adapters import get_payment_adapter, VerifiedPaymentEvent

commerce_router = APIRouter(prefix="", tags=["Commerce & Licensing"])


@commerce_router.get(
    "/products",
    response_model=List[ProductResponse],
    summary="List purchasable subscriptions and one-time exit exam bundles",
)
async def list_products(
    db: AsyncSession = Depends(get_db),
):
    """Returns active server-managed products with regional ETB pricing (ADR-003)."""
    result = await db.execute(
        select(Product)
        .where(Product.is_active == True)
        .order_by(Product.price_amount.asc())
    )
    products = result.scalars().all()
    return [
        ProductResponse(
            product_id=p.product_id,
            code=p.code,
            title=p.title,
            is_recurring=p.is_recurring,
            billing_interval_days=p.billing_interval_days,
            price_amount=float(p.price_amount),
            currency=p.currency,
            entitlement_spec=p.entitlement_spec or {},
            is_active=p.is_active,
        )
        for p in products
    ]


@commerce_router.post(
    "/orders",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an idempotent PENDING purchase order",
)
async def create_order(
    request: CreateOrderRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    tenant_id: Optional[UUID] = Header(None, alias="X-Tenant-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a server order in PENDING status.
    Idempotent on Idempotency-Key header or request body (ADR-008).
    """
    raw_key = idempotency_key_header or str(request.idempotency_key or "")
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An Idempotency-Key header or idempotency_key field is required.",
        )
    try:
        idempotency_uuid = UUID(raw_key)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key must be a valid RFC 4122 UUID.",
        )

    await set_rls_context(db, user_id=current_user.user_id, tenant_id=tenant_id)

    # 1. Idempotency Check: Existing Order
    existing = await db.execute(
        select(Order).where(Order.idempotency_key == idempotency_uuid)
    )
    existing_order = existing.scalars().first()
    if existing_order:
        p_res = await db.execute(
            select(Product).where(Product.product_id == existing_order.product_id)
        )
        prod = p_res.scalars().first()
        return OrderResponse(
            order_id=existing_order.order_id,
            idempotency_key=existing_order.idempotency_key,
            user_id=existing_order.user_id,
            tenant_id=existing_order.tenant_id,
            product_id=existing_order.product_id,
            product_code=prod.code if prod else "UNKNOWN",
            product_title=prod.title if prod else "Order",
            amount=float(existing_order.amount),
            currency=existing_order.currency,
            status=existing_order.status,
            payment_provider=existing_order.payment_provider,
            created_at=existing_order.created_at.isoformat(),
            updated_at=existing_order.updated_at.isoformat(),
        )

    # 2. Validate Product
    prod_res = await db.execute(
        select(Product).where(
            Product.product_id == request.product_id,
            Product.is_active == True,
        )
    )
    product = prod_res.scalars().first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active product '{request.product_id}' not found.",
        )

    # 3. Create Order
    new_order = Order(
        order_id=uuid.uuid4(),
        idempotency_key=idempotency_uuid,
        user_id=current_user.user_id,
        tenant_id=tenant_id,
        product_id=product.product_id,
        amount=product.price_amount,
        currency=product.currency,
        status="PENDING",
    )
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)

    return OrderResponse(
        order_id=new_order.order_id,
        idempotency_key=new_order.idempotency_key,
        user_id=new_order.user_id,
        tenant_id=new_order.tenant_id,
        product_id=new_order.product_id,
        product_code=product.code,
        product_title=product.title,
        amount=float(new_order.amount),
        currency=new_order.currency,
        status=new_order.status,
        payment_provider=new_order.payment_provider,
        created_at=new_order.created_at.isoformat(),
        updated_at=new_order.updated_at.isoformat(),
    )


@commerce_router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
    summary="Get order status for purchase polling",
)
async def get_order_status(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[UUID] = Header(None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
):
    await set_rls_context(db, user_id=current_user.user_id, tenant_id=tenant_id)
    order_res = await db.execute(
        select(Order).where(
            Order.order_id == order_id,
            Order.user_id == current_user.user_id,
        )
    )
    order = order_res.scalars().first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id}' not found.",
        )
    p_res = await db.execute(select(Product).where(Product.product_id == order.product_id))
    prod = p_res.scalars().first()
    return OrderResponse(
        order_id=order.order_id,
        idempotency_key=order.idempotency_key,
        user_id=order.user_id,
        tenant_id=order.tenant_id,
        product_id=order.product_id,
        product_code=prod.code if prod else "UNKNOWN",
        product_title=prod.title if prod else "Order",
        amount=float(order.amount),
        currency=order.currency,
        status=order.status,
        payment_provider=order.payment_provider,
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
    )


@commerce_router.post(
    "/checkout-sessions",
    response_model=CheckoutSessionResponse,
    summary="Initialize provider-abstracted payment session",
)
async def create_checkout_session(
    request: CheckoutSessionRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[UUID] = Header(None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
):
    await set_rls_context(db, user_id=current_user.user_id, tenant_id=tenant_id)

    order_res = await db.execute(
        select(Order).where(
            Order.order_id == request.order_id,
            Order.user_id == current_user.user_id,
        )
    )
    order = order_res.scalars().first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{request.order_id}' not found for user.",
        )
    if order.status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order is already PAID and activated.",
        )

    try:
        adapter = get_payment_adapter(request.provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    session_id, checkout_url = adapter.create_checkout_session(order, request.return_url)

    order.payment_provider = request.provider.lower()
    await db.commit()

    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    return CheckoutSessionResponse(
        session_id=session_id,
        order_id=order.order_id,
        provider=request.provider.lower(),
        checkout_url=checkout_url,
        expires_at=expires_at,
    )


@commerce_router.post(
    "/webhooks/{provider}",
    response_model=WebhookResponse,
    summary="Process signature-verified payment webhook and activate feature entitlements",
)
async def handle_payment_webhook(
    provider: str,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Idempotent webhook endpoint verifying cryptographic signatures from
    Telebirr, Chapa, Stripe, or Sandbox (ADR-003, ADR-008).
    Never unlocks entitlements without a verified payment event.
    """
    try:
        adapter = get_payment_adapter(provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    body_bytes = await raw_request.body()
    sig_header = (
        raw_request.headers.get("x-signature")
        or raw_request.headers.get("x-chapa-signature")
        or raw_request.headers.get("stripe-signature")
    )

    # 1. Cryptographic Signature Verification
    if not adapter.verify_webhook(body_bytes, sig_header):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid webhook signature for provider '{provider}'.",
        )

    try:
        body_dict = json.loads(body_bytes.decode("utf-8"))
        event: VerifiedPaymentEvent = adapter.parse_event(body_dict)
    except Exception as parse_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse webhook payload: {str(parse_err)}",
        )

    # 2. Idempotency Check on (provider, provider_event_id)
    existing_event = await db.execute(
        select(PaymentEvent).where(
            PaymentEvent.provider == event.provider,
            PaymentEvent.provider_event_id == event.provider_event_id,
        )
    )
    if existing_event.scalars().first():
        return WebhookResponse(
            status="ALREADY_PROCESSED",
            order_id=event.order_id,
            provider_event_id=event.provider_event_id,
            entitlement_activated=True,
        )

    # 3. Locate Order
    order_res = await db.execute(select(Order).where(Order.order_id == event.order_id))
    order = order_res.scalars().first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{event.order_id}' referenced in webhook does not exist.",
        )

    # 4. Record Payment Event & Mark Order PAID
    payment_event = PaymentEvent(
        payment_event_id=uuid.uuid4(),
        provider=event.provider,
        provider_event_id=event.provider_event_id,
        order_id=order.order_id,
        verified_amount=event.amount,
        verified_currency=event.currency,
        raw_payload=event.raw_payload,
    )
    db.add(payment_event)

    order.status = "PAID"
    order.payment_provider = event.provider

    # 5. Fetch Product Entitlement Spec & Activate Grant
    prod_res = await db.execute(select(Product).where(Product.product_id == order.product_id))
    product = prod_res.scalars().first()
    spec = product.entitlement_spec if product else {}

    now = datetime.now(timezone.utc)
    duration_days = product.billing_interval_days if (product and product.billing_interval_days) else 365
    valid_until = now + timedelta(days=duration_days)

    source_type_val = "PERSONAL_SUBSCRIPTION" if (product and product.is_recurring) else "ONE_TIME_PURCHASE"

    new_grant = FeatureEntitlement(
        entitlement_id=uuid.uuid4(),
        user_id=order.user_id,
        tenant_id=order.tenant_id,
        source_type=source_type_val,
        source_reference_id=order.order_id,
        scope_type=spec.get("scope_type", "GLOBAL"),
        scope_target_id=spec.get("scope_target_id"),
        offline_download_allowed=spec.get("offline_download_allowed", True),
        offline_grace_days=spec.get("offline_grace_days", 7),
        storage_quota_mb=spec.get("storage_quota_mb", 2048),
        ai_monthly_quota=spec.get("ai_monthly_quota", 50),
        valid_from=now,
        valid_until=valid_until,
    )
    db.add(new_grant)

    await db.commit()

    return WebhookResponse(
        status="PROCESSED",
        order_id=order.order_id,
        provider_event_id=event.provider_event_id,
        entitlement_activated=True,
    )

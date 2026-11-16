from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ProductResponse(BaseModel):
    product_id: UUID
    code: str
    title: str
    is_recurring: bool
    billing_interval_days: Optional[int] = None
    price_amount: float
    currency: str = "ETB"
    entitlement_spec: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class CreateOrderRequest(BaseModel):
    product_id: UUID
    currency: str = "ETB"
    idempotency_key: Optional[UUID] = None


class OrderResponse(BaseModel):
    order_id: UUID
    idempotency_key: UUID
    user_id: UUID
    tenant_id: Optional[UUID] = None
    product_id: UUID
    product_code: str
    product_title: str
    amount: float
    currency: str
    status: str
    payment_provider: Optional[str] = None
    created_at: str
    updated_at: str


class CheckoutSessionRequest(BaseModel):
    order_id: UUID
    provider: str = Field(..., description="telebirr, chapa, stripe, or sandbox")
    return_url: str


class CheckoutSessionResponse(BaseModel):
    session_id: str
    order_id: UUID
    provider: str
    checkout_url: str
    expires_at: str


class ManualTransferRequest(BaseModel):
    product_id: UUID
    payment_method: str = Field(..., description="'telebirr_manual' or 'cbe_manual'")
    transaction_reference: str = Field(..., min_length=3, max_length=128, description="SMS transaction code or reference ID (e.g., FT... or Telebirr trans ref)")
    sender_phone_or_name: Optional[str] = Field(None, max_length=128, description="Payer phone number or account name")
    notes: Optional[str] = Field(None, max_length=500, description="Additional transfer details")


class WebhookResponse(BaseModel):
    status: str
    order_id: UUID
    provider_event_id: str
    entitlement_activated: bool

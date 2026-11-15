import hmac
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from backend.app.core.config import settings
from backend.app.database.models import Order


@dataclass
class VerifiedPaymentEvent:
    provider: str
    provider_event_id: str
    order_id: UUID
    amount: float
    currency: str
    raw_payload: Dict[str, Any]


class PaymentAdapter:
    def create_checkout_session(
        self, order: Order, return_url: str
    ) -> Tuple[str, str]:
        """Returns (session_id, checkout_url)."""
        raise NotImplementedError

    def verify_webhook(
        self, body_bytes: bytes, signature_header: Optional[str]
    ) -> bool:
        """Cryptographically verifies the webhook signature header."""
        raise NotImplementedError

    def parse_event(self, body_dict: Dict[str, Any]) -> VerifiedPaymentEvent:
        """Parses verified payload into normalized event data."""
        raise NotImplementedError


class SandboxPaymentAdapter(PaymentAdapter):
    """Deterministic local sandbox payment adapter for development and testing."""

    SECRET = "sandbox_secret_test_key_384"

    def create_checkout_session(
        self, order: Order, return_url: str
    ) -> Tuple[str, str]:
        session_id = f"sandbox_sess_{order.order_id}"
        # Direct return URL for instant testing
        checkout_url = f"{return_url}?session_id={session_id}&order_id={order.order_id}&status=PAID"
        return session_id, checkout_url

    def verify_webhook(
        self, body_bytes: bytes, signature_header: Optional[str]
    ) -> bool:
        if not signature_header:
            return False
        expected = hmac.new(
            self.SECRET.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

    def parse_event(self, body_dict: Dict[str, Any]) -> VerifiedPaymentEvent:
        return VerifiedPaymentEvent(
            provider="sandbox",
            provider_event_id=body_dict["provider_event_id"],
            order_id=UUID(str(body_dict["order_id"])),
            amount=float(body_dict["amount"]),
            currency=str(body_dict.get("currency", "ETB")),
            raw_payload=body_dict,
        )


class TelebirrPaymentAdapter(PaymentAdapter):
    """Telebirr SuperApp / USSD Payment Adapter for Ethiopian Birr."""

    SECRET = getattr(settings, "TELEBIRR_APP_KEY", "telebirr_default_signing_key")

    def create_checkout_session(
        self, order: Order, return_url: str
    ) -> Tuple[str, str]:
        session_id = f"telebirr_pay_{order.order_id}"
        # Simulates Telebirr H5 payment portal URL
        checkout_url = f"https://app.telebirr.et/pay?orderId={order.order_id}&amt={order.amount}&returnUrl={return_url}"
        return session_id, checkout_url

    def verify_webhook(
        self, body_bytes: bytes, signature_header: Optional[str]
    ) -> bool:
        if not signature_header:
            return False
        expected = hmac.new(
            self.SECRET.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

    def parse_event(self, body_dict: Dict[str, Any]) -> VerifiedPaymentEvent:
        return VerifiedPaymentEvent(
            provider="telebirr",
            provider_event_id=str(body_dict.get("transactionNo") or body_dict.get("provider_event_id")),
            order_id=UUID(str(body_dict["order_id"])),
            amount=float(body_dict.get("totalAmount") or body_dict["amount"]),
            currency="ETB",
            raw_payload=body_dict,
        )


class ChapaPaymentAdapter(PaymentAdapter):
    """Chapa Payment Gateway Adapter (CBE Birr, Telebirr, Awash, Bank Cards)."""

    SECRET = getattr(settings, "CHAPA_WEBHOOK_SECRET", "chapa_default_secret_key")

    def create_checkout_session(
        self, order: Order, return_url: str
    ) -> Tuple[str, str]:
        session_id = f"chapa_checkout_{order.order_id}"
        checkout_url = f"https://checkout.chapa.co/checkout/web/payment/{session_id}"
        return session_id, checkout_url

    def verify_webhook(
        self, body_bytes: bytes, signature_header: Optional[str]
    ) -> bool:
        if not signature_header:
            return False
        expected = hmac.new(
            self.SECRET.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

    def parse_event(self, body_dict: Dict[str, Any]) -> VerifiedPaymentEvent:
        return VerifiedPaymentEvent(
            provider="chapa",
            provider_event_id=str(body_dict.get("tx_ref") or body_dict.get("provider_event_id")),
            order_id=UUID(str(body_dict["order_id"])),
            amount=float(body_dict.get("amount", 0)),
            currency=str(body_dict.get("currency", "ETB")),
            raw_payload=body_dict,
        )


class StripePaymentAdapter(PaymentAdapter):
    """Stripe International Credit/Debit Card Adapter."""

    SECRET = getattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_stripe_default_key")

    def create_checkout_session(
        self, order: Order, return_url: str
    ) -> Tuple[str, str]:
        session_id = f"cs_test_{order.order_id}"
        checkout_url = f"https://checkout.stripe.com/pay/{session_id}"
        return session_id, checkout_url

    def verify_webhook(
        self, body_bytes: bytes, signature_header: Optional[str]
    ) -> bool:
        if not signature_header:
            return False
        expected = hmac.new(
            self.SECRET.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

    def parse_event(self, body_dict: Dict[str, Any]) -> VerifiedPaymentEvent:
        return VerifiedPaymentEvent(
            provider="stripe",
            provider_event_id=str(body_dict.get("id") or body_dict.get("provider_event_id")),
            order_id=UUID(str(body_dict["order_id"])),
            amount=float(body_dict.get("amount", 0)),
            currency=str(body_dict.get("currency", "usd")).upper(),
            raw_payload=body_dict,
        )


def get_payment_adapter(provider: str) -> PaymentAdapter:
    normalized = provider.strip().lower()
    if normalized == "sandbox":
        return SandboxPaymentAdapter()
    elif normalized == "telebirr":
        return TelebirrPaymentAdapter()
    elif normalized == "chapa":
        return ChapaPaymentAdapter()
    elif normalized == "stripe":
        return StripePaymentAdapter()
    raise ValueError(f"Unsupported payment provider: '{provider}'")

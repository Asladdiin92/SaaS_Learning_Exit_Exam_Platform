import hmac
import hashlib
import json
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.commerce.adapters import SandboxPaymentAdapter


@pytest.mark.asyncio
async def test_commerce_products_and_order_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Query Products Catalog
        p_res = await client.get("/api/v1/products")
        assert p_res.status_code == 200, p_res.text
        products = p_res.json()
        assert len(products) >= 5
        product_codes = [p["code"] for p in products]
        assert "SUB-MONTHLY" in product_codes
        assert "BUNDLE-EXIT-2023" in product_codes

        chosen_product = next(p for p in products if p["code"] == "SUB-MONTHLY")
        assert chosen_product["price_amount"] == 250.00
        assert chosen_product["currency"] == "ETB"

        # 2. Register Student
        unique = uuid.uuid4().hex[:8]
        email = f"student_buyer_{unique}@aau.edu.et"
        device_id = str(uuid.uuid4())
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "SecurePassword123!",
                "full_name": f"Buyer {unique}",
                "device_id": device_id,
            },
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Order (Idempotent)
        idempotency_key = str(uuid.uuid4())
        order_res = await client.post(
            "/api/v1/orders",
            headers={**headers, "Idempotency-Key": idempotency_key},
            json={
                "product_id": chosen_product["product_id"],
                "currency": "ETB",
            },
        )
        assert order_res.status_code == 201, order_res.text
        order_data = order_res.json()
        order_id = order_data["order_id"]
        assert order_data["status"] == "PENDING"
        assert order_data["amount"] == 250.00

        # Repeating with same Idempotency-Key returns same order
        repeat_order = await client.post(
            "/api/v1/orders",
            headers={**headers, "Idempotency-Key": idempotency_key},
            json={
                "product_id": chosen_product["product_id"],
                "currency": "ETB",
            },
        )
        assert repeat_order.status_code == 200 or repeat_order.status_code == 201
        assert repeat_order.json()["order_id"] == order_id

        # 4. Create Checkout Session
        checkout_res = await client.post(
            "/api/v1/checkout-sessions",
            headers=headers,
            json={
                "order_id": order_id,
                "provider": "sandbox",
                "return_url": "https://myapp.edu.et/checkout-return",
            },
        )
        assert checkout_res.status_code == 200, checkout_res.text
        checkout_data = checkout_res.json()
        assert "checkout_url" in checkout_data
        assert checkout_data["provider"] == "sandbox"

        # 5. Test Webhook with Invalid Signature (Should Reject)
        payload = {
            "provider_event_id": f"evt_sandbox_{uuid.uuid4().hex[:8]}",
            "order_id": order_id,
            "amount": 250.00,
            "currency": "ETB",
        }
        body_bytes = json.dumps(payload).encode("utf-8")
        bad_sig_res = await client.post(
            "/api/v1/webhooks/sandbox",
            content=body_bytes,
            headers={"x-signature": "invalid_signature_hex", "Content-Type": "application/json"},
        )
        assert bad_sig_res.status_code == 400

        # 6. Test Webhook with Valid Cryptographic Signature
        valid_sig = hmac.new(
            SandboxPaymentAdapter.SECRET.encode("utf-8"),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()

        good_sig_res = await client.post(
            "/api/v1/webhooks/sandbox",
            content=body_bytes,
            headers={"x-signature": valid_sig, "Content-Type": "application/json"},
        )
        assert good_sig_res.status_code == 200, good_sig_res.text
        wh_data = good_sig_res.json()
        assert wh_data["status"] == "PROCESSED"
        assert wh_data["entitlement_activated"] is True

        # 7. Webhook Idempotency: Duplicate Event Re-send
        dup_res = await client.post(
            "/api/v1/webhooks/sandbox",
            content=body_bytes,
            headers={"x-signature": valid_sig, "Content-Type": "application/json"},
        )
        assert dup_res.status_code == 200
        assert dup_res.json()["status"] == "ALREADY_PROCESSED"

        # 8. Verify Order Status is now PAID
        check_order = await client.get(f"/api/v1/orders/{order_id}", headers=headers)
        assert check_order.status_code == 200
        assert check_order.json()["status"] == "PAID"

        # 9. Verify Entitlements Activated for Student
        ent_res = await client.get(
            f"/api/v1/me/entitlements?device_id={device_id}",
            headers=headers,
        )
        assert ent_res.status_code == 200, ent_res.text
        ent_data = ent_res.json()
        assert ent_data["offline_download_allowed"] is True
        assert ent_data["storage_quota_mb"] >= 2048
        assert ent_data["ai_monthly_quota"] >= 50
        assert "offline_grant" in ent_data

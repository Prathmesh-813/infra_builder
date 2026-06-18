"""
Stripe payment gateway integration.

POST /api/stripe/create-checkout-session   — create a Stripe Checkout Session
POST /api/stripe/webhook                   — handle Stripe webhook events
GET  /api/stripe/verify-session            — verify a completed checkout session
"""
import logging
import os

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stripe", tags=["stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Price IDs configured in your Stripe Dashboard
PRICE_IDS: dict[str, dict[str, str]] = {
    "pro": {
        "monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", ""),
        "annual": os.getenv("STRIPE_PRICE_PRO_ANNUAL", ""),
    },
    "enterprise": {
        "monthly": os.getenv("STRIPE_PRICE_ENTERPRISE_MONTHLY", ""),
        "annual": os.getenv("STRIPE_PRICE_ENTERPRISE_ANNUAL", ""),
    },
}

SUBSCRIPTION_TIERS: dict[str, str] = {
    "pro": "pro",
    "enterprise": "enterprise",
}

# ── Request / Response models ──────────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    plan_id: str  # "pro" | "enterprise"
    is_annual: bool = False
    success_url: str = ""
    cancel_url: str = ""


class CheckoutResponse(BaseModel):
    session_id: str
    url: str


class VerifyResponse(BaseModel):
    status: str  # "complete" | "incomplete" | "expired"
    tier: str | None = None
    customer_email: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_stripe_price(plan_id: str, is_annual: bool) -> str:
    period = "annual" if is_annual else "monthly"
    price_id = PRICE_IDS.get(plan_id, {}).get(period)
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"No Stripe price configured for plan '{plan_id}' ({period}). "
            f"Set STRIPE_PRICE_{plan_id.upper()}_{period.upper()} in your .env file.",
        )
    return price_id


# ── Routes ─────────────────────────────────────────────────────────────────────


def _is_dev_mode() -> bool:
    """Check if Stripe is using placeholder/dummy keys → enable dev/mock mode."""
    key = stripe.api_key or ""
    return key.startswith("sk_test_...") or key == "" or "..." in key


@router.post("/create-checkout-session", response_model=CheckoutResponse)
async def create_checkout_session(req: CheckoutRequest):
    tier = SUBSCRIPTION_TIERS.get(req.plan_id)
    if not tier:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {req.plan_id}")

    base_url = req.success_url or "http://localhost:8087/pricing"
    cancel_url = req.cancel_url or "http://localhost:8087/pricing"

    # ── Dev / mock mode ──────────────────────────────────────────────────────
    if _is_dev_mode():
        logger.info("Stripe dev mode — returning mock checkout session for plan=%s", req.plan_id)
        from uuid import uuid4
        mock_id = f"mock_cs_{uuid4().hex[:12]}"
        return CheckoutResponse(
            session_id=mock_id,
            url=base_url + f"?session_id={mock_id}&status=success",
        )

    # ── Real Stripe mode ─────────────────────────────────────────────────────
    price_id = _get_stripe_price(req.plan_id, req.is_annual)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=base_url + "?session_id={CHECKOUT_SESSION_ID}&status=success",
            cancel_url=cancel_url + "?status=cancelled",
            subscription_data={
                "metadata": {"tier": tier},
            },
        )
        return CheckoutResponse(session_id=session.id, url=session.url)
    except stripe.StripeError as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping webhook verification")
        return {"received": True}

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError) as e:
        logger.error("Stripe webhook error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event.get("type")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        tier = session.get("subscription_data", {}).get("metadata", {}).get("tier", "pro")
        customer_email = session.get("customer_details", {}).get("email", "unknown")
        logger.info("Stripe checkout completed — tier=%s email=%s session=%s", tier, customer_email, session.get("id"))

    elif event_type == "customer.subscription.updated":
        sub = event["data"]["object"]
        logger.info("Stripe subscription updated — id=%s status=%s", sub.get("id"), sub.get("status"))

    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        logger.info("Stripe subscription deleted — id=%s", sub.get("id"))

    return {"received": True}


@router.get("/verify-session", response_model=VerifyResponse)
async def verify_session(session_id: str):
    # ── Dev / mock mode ──────────────────────────────────────────────────────
    if _is_dev_mode() or session_id.startswith("mock_"):
        tier = "pro"
        if "enterprise" in session_id:
            tier = "enterprise"
        logger.info("Stripe dev mode — mock session verified: %s", session_id)
        return VerifyResponse(status="complete", tier=tier, customer_email="dev@infrastudio.dev")

    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
        status = session.get("status", "incomplete")
        tier = session.get("subscription_data", {}).get("metadata", {}).get("tier")
        customer_email = session.get("customer_details", {}).get("email")
        return VerifyResponse(status=status, tier=tier, customer_email=customer_email)
    except stripe.StripeError as e:
        logger.error("Stripe session verification error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

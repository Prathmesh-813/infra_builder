"""
InfraStudio — FastAPI backend.

Startup (from project root):
    uvicorn backend.main:app --reload --port 8001
"""
import logging
import os
import time

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.gcp_settings import router as gcp_settings_router
from backend.routes.pricing import azure_router, gcp_router, router as pricing_router
from backend.routes.settings import router as settings_router
from backend.routes.ai import router as ai_router
from backend.routes.stripe import router as stripe_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="InfraStudio — Pricing API",
    description="Live cloud pricing — AWS, Azure (public API), GCP (Billing Catalog API)",
    version="1.0.0",
)

# Allow the Vite dev server (port 8087) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8087", "http://127.0.0.1:8087", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router)
app.include_router(gcp_settings_router)
app.include_router(pricing_router)
app.include_router(azure_router)
app.include_router(gcp_router)
app.include_router(ai_router)
app.include_router(stripe_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "InfraStudio Pricing API"}


@app.get("/api/health/system")
async def system_health():
    """Coarse health of InfraStudio's own integrations (pricing, AI, billing)."""
    OK, DEGRADED, DOWN, UNCONFIGURED = "ok", "degraded", "down", "unconfigured"

    def comp(name, category, status, latency_ms=None, message=""):
        return {"name": name, "category": category, "status": status,
                "latency_ms": latency_ms, "message": message}

    components = [comp("InfraStudio API", "Core", OK, 0, "Operational")]

    # Azure public pricing API — a real reachability probe.
    start = time.perf_counter()
    try:
        url = "https://prices.azure.com/api/retail/prices?$top=1"
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url)
        ms = round((time.perf_counter() - start) * 1000)
        components.append(comp("Azure Retail Prices", "Cloud providers",
                               OK if r.status_code < 500 else DEGRADED, ms, f"HTTP {r.status_code}"))
    except Exception as e:  # noqa: BLE001
        components.append(comp("Azure Retail Prices", "Cloud providers", DOWN, None, str(e)[:120]))

    # Credential-configured checks (no external call / no secret values returned).
    try:
        from backend.services.settings import has_aws_credentials
        ok = has_aws_credentials()
    except Exception:  # noqa: BLE001
        ok = False
    components.append(comp("AWS pricing", "Cloud providers", OK if ok else UNCONFIGURED, None,
                           "Credentials configured" if ok else "No credentials"))

    try:
        from backend.services.gcp_settings import has_gcp_credentials
        ok = has_gcp_credentials()
    except Exception:  # noqa: BLE001
        ok = False
    components.append(comp("GCP pricing", "Cloud providers", OK if ok else UNCONFIGURED, None,
                           "Service account configured" if ok else "No service account"))

    components.append(comp("OpenAI (diagram AI)", "AI providers",
                           OK if os.environ.get("OPENAI_API_KEY") else UNCONFIGURED, None,
                           "API key set" if os.environ.get("OPENAI_API_KEY") else "Pattern-fallback mode"))
    components.append(comp("Stripe billing", "Billing",
                           OK if os.environ.get("STRIPE_SECRET_KEY") else UNCONFIGURED, None,
                           "Configured" if os.environ.get("STRIPE_SECRET_KEY") else "Dev mode"))

    return {"service": "infrastudio", "components": components}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8001, reload=True)

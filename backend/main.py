"""
InfraStudio — FastAPI backend.

Startup (from project root):
    uvicorn backend.main:app --reload --port 8001
"""
import logging

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8001, reload=True)

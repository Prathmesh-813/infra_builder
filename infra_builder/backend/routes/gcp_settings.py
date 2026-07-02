"""
GCP service-account credential management endpoints.

GET    /api/settings/gcp/credentials        — masked email + config status
POST   /api/settings/gcp/credentials/test   — validate JSON via Catalog API
POST   /api/settings/gcp/credentials        — save service-account JSON
DELETE /api/settings/gcp/credentials        — clear credentials
"""
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.providers.gcp import test_service_account_info
from backend.services.gcp_settings import (
    clear_gcp_credentials,
    get_masked_gcp_client_email,
    get_masked_gcp_project_id,
    has_gcp_credentials,
    save_gcp_credentials,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings/gcp", tags=["GCP Settings"])


class GCPCredentialsRequest(BaseModel):
    service_account_json: str
    skip_validation: bool = False


class TestResponse(BaseModel):
    valid: bool
    message: str
    project_id: str = ""
    client_email: str = ""
    error_code: str = ""


class CredentialsStatusResponse(BaseModel):
    configured: bool
    masked_email: str
    masked_project: str
    message: str


def _parse_sa_json(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}") from e

    if data.get("type") != "service_account":
        raise HTTPException(status_code=400, detail="JSON must be a service_account key file.")
    for field in ("project_id", "private_key", "client_email"):
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    return data


@router.get("/credentials", response_model=CredentialsStatusResponse)
def get_credentials_status():
    configured = has_gcp_credentials()
    return CredentialsStatusResponse(
        configured=configured,
        masked_email=get_masked_gcp_client_email(),
        masked_project=get_masked_gcp_project_id(),
        message="Service account configured" if configured else "No credentials stored",
    )


@router.post("/credentials/test", response_model=TestResponse)
def test_credentials(body: GCPCredentialsRequest):
    sa = _parse_sa_json(body.service_account_json.strip())
    result = test_service_account_info(sa)
    return TestResponse(
        valid=result.get("valid", False),
        message=result.get("message", ""),
        project_id=result.get("project_id", ""),
        client_email=result.get("client_email", ""),
        error_code=result.get("error_code", ""),
    )


@router.post("/credentials", response_model=CredentialsStatusResponse)
def save_credentials(body: GCPCredentialsRequest):
    sa = _parse_sa_json(body.service_account_json.strip())

    if not body.skip_validation:
        test = test_service_account_info(sa)
        if not test.get("valid"):
            raise HTTPException(status_code=400, detail=test.get("message", "Validation failed"))

    save_gcp_credentials(sa)
    return CredentialsStatusResponse(
        configured=True,
        masked_email=get_masked_gcp_client_email(),
        masked_project=get_masked_gcp_project_id(),
        message="Credentials saved" + (" (not validated)" if body.skip_validation else " and verified"),
    )


@router.delete("/credentials", response_model=CredentialsStatusResponse)
def delete_credentials():
    clear_gcp_credentials()
    return CredentialsStatusResponse(
        configured=False,
        masked_email="",
        masked_project="",
        message="Credentials removed",
    )

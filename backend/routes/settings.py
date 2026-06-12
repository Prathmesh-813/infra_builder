"""
AWS credential management endpoints.

GET    /api/settings/aws/credentials        — return masked key + config status
POST   /api/settings/aws/credentials/test   — validate creds via STS (no cost)
POST   /api/settings/aws/credentials        — save (optionally skipping validation)
DELETE /api/settings/aws/credentials        — clear credentials
"""
import logging
import socket

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.settings import (
    clear_aws_credentials,
    get_masked_aws_access_key,
    has_aws_credentials,
    save_aws_credentials,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings/aws", tags=["AWS Settings"])


# ── Models ────────────────────────────────────────────────────────────────────

class CredentialsRequest(BaseModel):
    access_key_id: str
    secret_access_key: str
    skip_validation: bool = False   # allow saving without STS check


class TestResponse(BaseModel):
    valid: bool
    message: str
    account_id: str = ""
    arn: str = ""
    error_code: str = ""


class CredentialsStatusResponse(BaseModel):
    configured: bool
    masked_key: str
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _can_reach_aws() -> bool:
    """Quick TCP probe to sts.amazonaws.com:443 (1-second timeout)."""
    try:
        socket.setdefaulttimeout(1)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("sts.amazonaws.com", 443))
        return True
    except Exception:
        return False
    finally:
        socket.setdefaulttimeout(None)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/credentials", response_model=CredentialsStatusResponse)
def get_credentials_status():
    configured = has_aws_credentials()
    return CredentialsStatusResponse(
        configured=configured,
        masked_key=get_masked_aws_access_key(),
        message="Credentials configured" if configured else "No credentials stored",
    )


@router.post("/credentials/test", response_model=TestResponse)
def test_credentials(body: CredentialsRequest):
    """
    Validate credentials via STS GetCallerIdentity (free call, no permissions needed).
    Returns detailed error so the UI can show exactly what went wrong.
    """
    key = body.access_key_id.strip()
    secret = body.secret_access_key.strip()

    if not key or not secret:
        return TestResponse(valid=False, message="Both Access Key ID and Secret Access Key are required.")

    # Basic format check
    if not key.startswith(("AKIA", "ASIA", "AROA", "AGPA", "AIDA", "ANPA", "ANVA", "AIPA")):
        return TestResponse(
            valid=False,
            message=f"Access Key ID format looks wrong. AWS keys start with AKIA… Got: '{key[:8]}…'",
            error_code="FORMAT_ERROR",
        )

    if len(key) < 16:
        return TestResponse(valid=False, message="Access Key ID is too short.", error_code="FORMAT_ERROR")

    if len(secret) < 20:
        return TestResponse(valid=False, message="Secret Access Key is too short.", error_code="FORMAT_ERROR")

    # Network reachability check
    if not _can_reach_aws():
        return TestResponse(
            valid=False,
            message="Cannot reach sts.amazonaws.com — check your internet/firewall. "
                    "You can still save the keys using 'Save without validating'.",
            error_code="NETWORK_ERROR",
        )

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError, EndpointResolutionError

        sts = boto3.client(
            "sts",
            aws_access_key_id=key,
            aws_secret_access_key=secret,
            region_name="us-east-1",
        )
        identity = sts.get_caller_identity()
        account_id = identity.get("Account", "")
        arn = identity.get("Arn", "")
        return TestResponse(
            valid=True,
            message=f"✓ Credentials valid — Account: {account_id}",
            account_id=account_id,
            arn=arn,
        )

    except ImportError:
        return TestResponse(
            valid=False,
            message="AWS SDK (boto3) is not installed on the backend server.",
            error_code="BOTO3_MISSING",
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg  = e.response["Error"].get("Message", "")
        logger.debug("STS ClientError %s: %s", code, msg)

        if code == "InvalidClientTokenId":
            return TestResponse(
                valid=False,
                message="Invalid Access Key ID — the key does not exist in AWS. "
                        "Make sure you copied the full key (20 characters starting with AKIA).",
                error_code=code,
            )
        if code == "SignatureDoesNotMatch":
            return TestResponse(
                valid=False,
                message="Secret Access Key is incorrect — signature mismatch. "
                        "Make sure there are no extra spaces or missing characters.",
                error_code=code,
            )
        if code in ("AuthFailure", "InvalidUserID"):
            return TestResponse(valid=False, message=f"Auth failure: {msg}", error_code=code)
        if code == "AccessDenied":
            return TestResponse(
                valid=True,
                message="Keys are valid (STS access denied by IAM policy, but keys work). "
                        "Pricing API calls may still succeed.",
                error_code=code,
            )
        if code == "ExpiredTokenException":
            return TestResponse(
                valid=False,
                message="Credentials have expired. If using temporary credentials (STS session), "
                        "please refresh them.",
                error_code=code,
            )
        return TestResponse(valid=False, message=f"AWS error [{code}]: {msg}", error_code=code)

    except (BotoCoreError, EndpointResolutionError) as e:
        logger.debug("BotoCoreError: %s", e)
        return TestResponse(
            valid=False,
            message=f"Connection error: {e}. You can save the keys anyway using 'Save without validating'.",
            error_code="CONNECTION_ERROR",
        )
    except Exception as e:
        logger.debug("Unexpected STS error: %s", e)
        return TestResponse(valid=False, message=f"Unexpected error: {e}", error_code="UNKNOWN")


@router.post("/credentials", response_model=CredentialsStatusResponse)
def save_credentials(body: CredentialsRequest):
    """Save credentials. Pass skip_validation=true to bypass the STS check."""
    key    = body.access_key_id.strip()
    secret = body.secret_access_key.strip()

    if not key or not secret:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Both fields are required.")

    if not body.skip_validation:
        test = test_credentials(body)
        if not test.valid:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=test.message)

    save_aws_credentials(key, secret)
    return CredentialsStatusResponse(
        configured=True,
        masked_key=get_masked_aws_access_key(),
        message="Credentials saved" + (" (not validated)" if body.skip_validation else " and verified"),
    )


@router.delete("/credentials", response_model=CredentialsStatusResponse)
def delete_credentials():
    clear_aws_credentials()
    return CredentialsStatusResponse(configured=False, masked_key="", message="Credentials removed")

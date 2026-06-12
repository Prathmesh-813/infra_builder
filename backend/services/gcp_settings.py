"""
GCP service-account credential management.
Credentials are stored in a local git-ignored JSON file.
The private_key is NEVER returned via any API response.
"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_CONFIG_DIR = Path(__file__).parent.parent / "config"
_CRED_FILE = _CONFIG_DIR / "gcp_settings.json"


def _ensure_config_dir() -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def get_gcp_credentials() -> Dict[str, Any]:
    """Return stored service-account JSON fields (including private_key)."""
    _ensure_config_dir()
    if not _CRED_FILE.exists():
        return {}
    try:
        with open(_CRED_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.debug("Failed to read GCP credentials: %s", e)
        return {}


def save_gcp_credentials(service_account: Dict[str, Any]) -> None:
    """Persist the full service-account JSON to the local config file."""
    _ensure_config_dir()
    with open(_CRED_FILE, "w") as f:
        json.dump(service_account, f, indent=2)
    logger.debug("GCP credentials saved for %s", get_masked_gcp_client_email())


def clear_gcp_credentials() -> None:
    if _CRED_FILE.exists():
        _CRED_FILE.unlink()


def get_masked_gcp_client_email() -> str:
    creds = get_gcp_credentials()
    email = creds.get("client_email", "")
    if not email or "@" not in email:
        return ""
    local, domain = email.split("@", 1)
    if len(local) <= 4:
        return f"{local[0]}***@{domain}"
    return f"{local[:3]}***@{domain}"


def get_masked_gcp_project_id() -> str:
    creds = get_gcp_credentials()
    pid = creds.get("project_id", "")
    if not pid or len(pid) < 6:
        return pid
    return pid[:4] + "****" + pid[-4:]


def has_gcp_credentials() -> bool:
    creds = get_gcp_credentials()
    return bool(
        creds.get("type") == "service_account"
        and creds.get("client_email")
        and creds.get("private_key")
        and creds.get("project_id")
    )

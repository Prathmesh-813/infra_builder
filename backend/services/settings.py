"""
AWS credential management.
Credentials are stored in a local git-ignored JSON file.
The secret_access_key is NEVER returned via any API response.
"""
import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path to the local credential store — always relative to this file
_CONFIG_DIR = Path(__file__).parent.parent / "config"
_CRED_FILE  = _CONFIG_DIR / "aws_settings.json"


def _ensure_config_dir() -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def get_aws_credentials() -> dict:
    """
    Return stored credentials.
    Keys: access_key_id, secret_access_key (may be empty strings).
    """
    _ensure_config_dir()
    if not _CRED_FILE.exists():
        return {"access_key_id": "", "secret_access_key": ""}
    try:
        with open(_CRED_FILE, "r") as f:
            data = json.load(f)
        return {
            "access_key_id":     data.get("access_key_id", ""),
            "secret_access_key": data.get("secret_access_key", ""),
        }
    except Exception as e:
        logger.debug("Failed to read AWS credentials: %s", e)
        return {"access_key_id": "", "secret_access_key": ""}


def save_aws_credentials(access_key_id: str, secret_access_key: str) -> None:
    """Persist credentials to the local config file."""
    _ensure_config_dir()
    with open(_CRED_FILE, "w") as f:
        json.dump({"access_key_id": access_key_id, "secret_access_key": secret_access_key}, f, indent=2)
    logger.debug("AWS credentials saved for key %s", get_masked_aws_access_key())


def clear_aws_credentials() -> None:
    """Remove stored credentials."""
    if _CRED_FILE.exists():
        _CRED_FILE.unlink()


def get_masked_aws_access_key() -> str:
    """Return masked key, e.g.  AKIA****5E6U  (never expose the secret)."""
    creds = get_aws_credentials()
    key = creds.get("access_key_id", "")
    if not key or len(key) < 8:
        return ""
    return key[:4] + "****" + key[-4:]


def has_aws_credentials() -> bool:
    creds = get_aws_credentials()
    return bool(creds.get("access_key_id") and creds.get("secret_access_key"))

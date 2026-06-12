"""
GCP Live Pricing Provider
=========================
Uses the Cloud Billing Catalog API with a service-account JSON.

Fallback chain:
  Tier 1 — Cloud Billing Catalog API  (live, service-account auth)
  Tier 2 — Hardcoded static data      (always available)

Docs: https://cloud.google.com/billing/docs/how-to/get-pricing-information-api
"""
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
import urllib3
from google.auth.transport.urllib3 import Request as UrlLib3Request
from google.oauth2 import service_account

from backend.services.gcp_settings import get_gcp_credentials, has_gcp_credentials

logger = logging.getLogger(__name__)

COMPUTE_SERVICE_ID = "6F81-5844-456A"
CATALOG_URL = f"https://cloudbilling.googleapis.com/v1/services/{COMPUTE_SERVICE_ID}/skus"
SCOPES = ["https://www.googleapis.com/auth/cloud-billing.readonly"]
REQUEST_TIMEOUT = 30.0

_cache: Dict[str, tuple] = {}
CACHE_TTL_SEC = 3600

# Region aliases (AWS-style → GCP region)
REGION_ALIASES: Dict[str, str] = {
    "us-east-1":      "us-central1",
    "us-east-2":      "us-east4",
    "us-west-1":      "us-west1",
    "us-west-2":      "us-west2",
    "eu-west-1":      "europe-west1",
    "eu-west-2":      "europe-west2",
    "eu-central-1":   "europe-west3",
    "ap-south-1":     "asia-south1",
    "ap-southeast-1": "asia-southeast1",
    "ap-northeast-1": "asia-northeast1",
}

# Location bucket used in SKU descriptions
_REGION_LOCATION: Dict[str, str] = {
    "us-central1": "Americas",
    "us-east1":    "Americas",
    "us-east4":    "Americas",
    "us-west1":    "Americas",
    "us-west2":    "Americas",
    "europe-west1": "EMEA",
    "europe-west2": "EMEA",
    "europe-west3": "EMEA",
    "asia-south1":  "APAC",
    "asia-southeast1": "APAC",
    "asia-northeast1": "APAC",
}

# Family-level core + RAM description patterns (location bucket substituted)
_FAMILY_PATTERNS: Dict[str, Tuple[str, str]] = {
    "e2": ("E2 Instance Core running in {loc}", "E2 Instance Ram running in {loc}"),
    "n2": ("N2 Instance Core running in {loc}", "N2 Instance Ram running in {loc}"),
    "c2": ("Compute optimized Core running in {loc}", "Compute optimized Ram running in {loc}"),
}

_SHARED_CORE_SKUS: Dict[str, str] = {
    "e2-micro":  "Micro Instance with burstable CPU running in {loc}",
    "e2-small":  "Small Instance with 1 VCPU running in {loc}",
    "e2-medium": "Medium Instance with 1 VCPU running in {loc}",
}

# Instance specs (vcpu, memory_gb)
_INSTANCE_SPECS: Dict[str, Tuple[int, int]] = {
    "e2-micro":       (2, 1),
    "e2-small":       (2, 2),
    "e2-medium":      (2, 4),
    "e2-standard-2":  (2, 8),
    "e2-standard-4":  (4, 16),
    "e2-standard-8":  (8, 32),
    "n2-standard-2":  (2, 8),
    "n2-standard-4":  (4, 16),
    "n2-standard-8":  (8, 32),
    "c2-standard-4":  (4, 16),
    "c2-standard-8":  (8, 32),
    "n2-highmem-2":   (2, 16),
    "n2-highmem-4":   (4, 32),
    "n2-highmem-8":   (8, 64),
}

_HARDCODED_MONTHLY: Dict[str, float] = {
    "e2-micro": 6.1, "e2-small": 12, "e2-medium": 24,
    "e2-standard-2": 48, "e2-standard-4": 97, "e2-standard-8": 194,
    "n2-standard-2": 58, "n2-standard-4": 116, "n2-standard-8": 232,
    "c2-standard-4": 147, "c2-standard-8": 295,
    "n2-highmem-2": 75, "n2-highmem-4": 150, "n2-highmem-8": 300,
}

_STORAGE_PER_GB = 0.04
_FAMILY_RE = re.compile(r"^(e2|n2|c2)-")


def _normalize_region(region: str) -> str:
    r = region.lower().strip()
    return REGION_ALIASES.get(r, r)


def _location_bucket(region: str) -> str:
    return _REGION_LOCATION.get(region, "Americas")


def _hourly_to_monthly(hourly: float) -> float:
    return round(hourly * 730, 4)


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    ts, val = entry
    if time.time() - ts > CACHE_TTL_SEC:
        del _cache[key]
        return None
    return val


def _cache_set(key: str, val: Any) -> None:
    _cache[key] = (time.time(), val)


def _get_access_token() -> Optional[str]:
    if not has_gcp_credentials():
        return None
    try:
        creds = service_account.Credentials.from_service_account_info(
            get_gcp_credentials(),
            scopes=SCOPES,
        )
        creds.refresh(UrlLib3Request(urllib3.PoolManager()))
        return creds.token
    except Exception as e:
        logger.debug("GCP auth error: %s", e)
        return None


def _unit_price_usd(sku: Dict[str, Any]) -> float:
    pricing_info = sku.get("pricingInfo") or []
    if not pricing_info:
        return 0.0
    pe = pricing_info[0].get("pricingExpression") or {}
    tiered = pe.get("tieredRates") or []
    best: Optional[float] = None
    for tier in tiered:
        unit_price = tier.get("unitPrice") or {}
        units = int(unit_price.get("units") or 0)
        nanos = int(unit_price.get("nanos") or 0)
        value = units + nanos / 1_000_000_000
        if value <= 0:
            continue
        if best is None or value < best:
            best = value
    return best if best is not None else 0.0


def _fetch_all_skus(token: str) -> List[Dict[str, Any]]:
    cache_key = "all_skus"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    items: List[Dict[str, Any]] = []
    page_token: Optional[str] = None
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            while True:
                params: Dict[str, Any] = {"pageSize": 5000, "currencyCode": "USD"}
                if page_token:
                    params["pageToken"] = page_token
                resp = client.get(
                    CATALOG_URL,
                    params=params,
                    headers={"Authorization": f"Bearer {token}"},
                )
                resp.raise_for_status()
                payload = resp.json()
                items.extend(payload.get("skus") or [])
                page_token = payload.get("nextPageToken")
                if not page_token:
                    break
    except Exception as e:
        logger.debug("GCP catalog API error: %s", e)
        return []

    _cache_set(cache_key, items)
    return items


def _sku_matches_region(sku: Dict[str, Any], region: str) -> bool:
    regions = sku.get("serviceRegions") or []
    return region in regions


def _is_on_demand_sku(description: str) -> bool:
    lowered = description.lower()
    skip = ("preemptible", "spot", "custom", "sole tenant", "commitment", "premium image")
    return not any(s in lowered for s in skip)


def _build_rate_index(
    items: List[Dict[str, Any]],
    region: str,
    location: str,
) -> Tuple[Dict[str, Tuple[float, float]], Dict[str, float], float]:
    """Return (family_rates, shared_core_prices, storage_per_gb)."""
    cache_key = f"rates:{region}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    family_rates: Dict[str, Tuple[Optional[float], Optional[float]]] = {
        f: (None, None) for f in _FAMILY_PATTERNS
    }
    shared: Dict[str, float] = {}
    storage_per_gb: Optional[float] = None

    for sku in items:
        description = sku.get("description") or ""
        if not _is_on_demand_sku(description):
            continue
        if not _sku_matches_region(sku, region):
            continue

        # Balanced persistent disk capacity ($/GB/month)
        if storage_per_gb is None and "balanced pd capacity" in description.lower():
            unit = (sku.get("pricingInfo") or [{}])[0].get("pricingExpression", {}).get("usageUnit", "")
            if "GiBy" in unit or "GB" in unit:
                storage_per_gb = _unit_price_usd(sku)

        for family, (core_pat, ram_pat) in _FAMILY_PATTERNS.items():
            core_pat = core_pat.format(loc=location)
            ram_pat = ram_pat.format(loc=location)
            core_rate, ram_rate = family_rates[family]
            if core_rate is None and core_pat in description:
                family_rates[family] = (_unit_price_usd(sku), ram_rate)
            elif ram_rate is None and ram_pat in description:
                family_rates[family] = (core_rate, _unit_price_usd(sku))

        for name, needle in _SHARED_CORE_SKUS.items():
            if name in shared:
                continue
            if needle.format(loc=location) in description:
                shared[name] = _unit_price_usd(sku)

    completed: Dict[str, Tuple[float, float]] = {}
    for family, (core, ram) in family_rates.items():
        if core is not None and ram is not None:
            completed[family] = (core, ram)

    result = (completed, shared, storage_per_gb or _STORAGE_PER_GB)
    _cache_set(cache_key, result)
    return result


def _fetch_vm_hourly(
    machine_type: str,
    region: str,
    os_label: str = "linux",
    committed: bool = False,
) -> Optional[float]:
    token = _get_access_token()
    if not token:
        return None

    region = _normalize_region(region)
    location = _location_bucket(region)
    items = _fetch_all_skus(token)
    if not items:
        return None

    family_rates, shared_prices, _ = _build_rate_index(items, region, location)
    hourly: Optional[float] = None

    if machine_type in _SHARED_CORE_SKUS:
        hourly = shared_prices.get(machine_type)
    else:
        m = _FAMILY_RE.match(machine_type)
        if m and m.group(1) in family_rates:
            family = m.group(1)
            vcpus, mem_gb = _INSTANCE_SPECS.get(machine_type, (2, 8))
            core_rate, ram_rate = family_rates[family]
            hourly = vcpus * core_rate + mem_gb * ram_rate

    if hourly is None or hourly <= 0:
        return None

    if os_label == "windows":
        hourly *= 1.3  # Windows license approximation when no dedicated SKU matched

    if committed:
        hourly *= 0.63

    return hourly


def _fetch_storage_cost(region: str, storage_gb: int) -> float:
    if storage_gb <= 0:
        return 0.0
    token = _get_access_token()
    if not token:
        return storage_gb * _STORAGE_PER_GB
    region = _normalize_region(region)
    location = _location_bucket(region)
    items = _fetch_all_skus(token)
    _, _, per_gb = _build_rate_index(items, region, location)
    return storage_gb * per_gb


def get_vm_monthly_price(
    machine_type: str,
    region: str = "us-central1",
    os: str = "linux",
    storage_gb: int = 0,
    committed: bool = False,
) -> Dict[str, Any]:
    """Return monthly price for a GCP Compute Engine VM."""
    region = _normalize_region(region)
    os_label = "windows" if os.lower() == "windows" else "linux"

    hourly = _fetch_vm_hourly(machine_type, region, os_label, committed)
    storage_cost = _fetch_storage_cost(region, storage_gb) if hourly is not None else storage_gb * _STORAGE_PER_GB

    if hourly is not None:
        return _build_response(hourly, machine_type, region, os_label, "live", storage_gb, storage_cost)

    # Fallback
    base = _HARDCODED_MONTHLY.get(machine_type, 24.0)
    if os_label == "windows":
        base *= 1.3
    if committed:
        base *= 0.63
    hourly_fb = base / 730
    return _build_response(hourly_fb, machine_type, region, os_label, "fallback", storage_gb, storage_cost)


def get_bulk_vm_prices(
    machine_types: list,
    region: str = "us-central1",
    os: str = "linux",
    storage_gb: int = 0,
    committed: bool = False,
) -> Dict[str, Dict[str, Any]]:
    return {
        mt: get_vm_monthly_price(mt, region, os, storage_gb, committed)
        for mt in machine_types
    }


def _build_response(
    hourly: float,
    machine_type: str,
    region: str,
    os_label: str,
    source: str,
    storage_gb: int,
    storage_cost: float,
) -> Dict[str, Any]:
    compute_monthly = _hourly_to_monthly(hourly)
    total = round(compute_monthly + storage_cost, 4)
    return {
        "price_per_hour":    round(hourly, 6),
        "price_per_month":   total,
        "compute_per_month": compute_monthly,
        "storage_per_month": round(storage_cost, 4),
        "machine_type":      machine_type,
        "region":            region,
        "os":                os_label,
        "storage_gb":        storage_gb,
        "price_source":      source,
        "is_fallback":       source == "fallback",
        "currency":          "USD",
    }


def test_service_account_info(sa_info: Dict[str, Any]) -> Dict[str, Any]:
    """Validate service account by fetching one catalog page."""
    try:
        creds = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=SCOPES,
        )
        creds.refresh(UrlLib3Request(urllib3.PoolManager()))
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            resp = client.get(
                CATALOG_URL,
                params={"pageSize": 1},
                headers={"Authorization": f"Bearer {creds.token}"},
            )
        if resp.status_code == 200:
            return {
                "valid": True,
                "message": f"✓ Service account valid — project: {sa_info.get('project_id', '')}",
                "project_id": sa_info.get("project_id", ""),
                "client_email": sa_info.get("client_email", ""),
            }
        data = resp.json()
        err = data.get("error", {})
        return {
            "valid": False,
            "message": err.get("message", f"HTTP {resp.status_code}"),
            "error_code": err.get("status", "API_ERROR"),
        }
    except Exception as e:
        return {"valid": False, "message": str(e), "error_code": "AUTH_ERROR"}

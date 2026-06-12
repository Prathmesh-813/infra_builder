"""
Azure Live Pricing Provider
===========================
Uses the public Azure Retail Prices API (no authentication required).
https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices

Fallback chain:
  Tier 1 — Azure Retail Prices API  (live, public)
  Tier 2 — Hardcoded static data    (always available)
"""
import logging
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

AZURE_RETAIL_API = "https://prices.azure.com/api/retail/prices"
REQUEST_TIMEOUT = 10.0

# Simple in-memory cache: key → (timestamp, value)
_cache: Dict[str, tuple] = {}
CACHE_TTL_SEC = 3600

# ---------------------------------------------------------------------------
# Region aliases (AWS-style code → Azure ARM region name)
# ---------------------------------------------------------------------------
REGION_ALIASES: Dict[str, str] = {
    "us-east-1":      "eastus",
    "us-east-2":      "eastus2",
    "us-west-1":      "westus",
    "us-west-2":      "westus2",
    "eu-west-1":      "westeurope",
    "eu-west-2":      "uksouth",
    "eu-central-1":   "germanywestcentral",
    "ap-south-1":     "centralindia",
    "ap-southeast-1": "southeastasia",
    "ap-northeast-1": "japaneast",
    "ca-central-1":   "canadacentral",
    "sa-east-1":      "brazilsouth",
}

# ---------------------------------------------------------------------------
# Tier 2 — Hardcoded fallback ($/mo on-demand Linux, approximate)
# ---------------------------------------------------------------------------
_HARDCODED_VM: Dict[str, float] = {
    "Standard_B1s":   7.6,
    "Standard_B1ms":  15.0,
    "Standard_B2s":   30.0,
    "Standard_B2ms":  60.0,
    "Standard_B4ms":  120.0,
    "Standard_B8ms":  240.0,
    "Standard_D2s_v3": 69.0,
    "Standard_D4s_v3": 138.0,
    "Standard_D8s_v3": 276.0,
    "Standard_D2s_v5": 67.0,
    "Standard_D4s_v5": 134.0,
    "Standard_D8s_v5": 268.0,
    "Standard_F2s_v2": 61.0,
    "Standard_F4s_v2": 122.0,
    "Standard_F8s_v2": 244.0,
    "Standard_E2s_v3": 100.0,
    "Standard_E4s_v3": 200.0,
    "Standard_E8s_v3": 400.0,
}

# Standard SSD LRS — $/GB/month fallback
_STORAGE_PER_GB = 0.075


def _normalize_region(region: str) -> str:
    r = region.lower().strip()
    return REGION_ALIASES.get(r, r)


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


def _query_retail_prices(odata_filter: str) -> List[Dict[str, Any]]:
    """Query Azure Retail Prices API with pagination."""
    cache_key = f"filter:{odata_filter}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    items: List[Dict[str, Any]] = []
    url: Optional[str] = AZURE_RETAIL_API
    params: Optional[Dict[str, str]] = {"$filter": odata_filter}

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            while url:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                items.extend(data.get("Items", []))
                url = data.get("NextPageLink")
                params = None  # NextPageLink includes all params
    except Exception as e:
        logger.debug("Azure retail API error: %s", e)
        return []

    _cache_set(cache_key, items)
    return items


def _pick_vm_item(items: List[Dict[str, Any]], os_label: str) -> Optional[Dict[str, Any]]:
    """Pick the correct Linux or Windows on-demand VM meter."""
    is_windows = os_label.lower() == "windows"
    for item in items:
        meter = item.get("meterName", "")
        product = item.get("productName", "")
        unit = item.get("unitOfMeasure", "")

        if unit != "1 Hour":
            continue
        if "Spot" in meter or "Low Priority" in meter or "Cloud Services" in product:
            continue
        if is_windows:
            if "Windows" in product:
                return item
        else:
            if "Windows" not in product:
                return item
    return items[0] if items else None


def _fetch_vm_hourly(
    vm_size: str,
    region: str,
    os_label: str = "Linux",
    reserved: bool = False,
) -> Optional[float]:
    """Return on-demand $/hr or reserved equivalent $/hr."""
    region = _normalize_region(region)
    os_label = "Windows" if os_label.lower() == "windows" else "Linux"

    if reserved:
        filt = (
            f"serviceName eq 'Virtual Machines' and armRegionName eq '{region}' "
            f"and armSkuName eq '{vm_size}' and priceType eq 'Reservation' "
            f"and reservationTerm eq '1 Year'"
        )
        items = _query_retail_prices(filt)
        if not items:
            return None
        item = _pick_vm_item(items, os_label)
        if not item:
            return None
        # Reservation retailPrice is total 1-year cost in USD
        annual = float(item.get("retailPrice", 0))
        if annual <= 0:
            return None
        return annual / 12 / 730

    filt = (
        f"serviceName eq 'Virtual Machines' and armRegionName eq '{region}' "
        f"and armSkuName eq '{vm_size}' and priceType eq 'Consumption'"
    )
    items = _query_retail_prices(filt)
    item = _pick_vm_item(items, os_label)
    if not item:
        return None
    price = float(item.get("retailPrice", 0))
    return price if price > 0 else None


def _fetch_storage_per_gb_month(region: str) -> float:
    """Fetch Standard SSD LRS per-GB monthly rate from E4 disk (32 GB)."""
    region = _normalize_region(region)
    cache_key = f"storage_gb:{region}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    filt = (
        f"serviceName eq 'Storage' and armRegionName eq '{region}' "
        f"and meterName eq 'E4 LRS Disk' and priceType eq 'Consumption'"
    )
    items = _query_retail_prices(filt)
    for item in items:
        if item.get("unitOfMeasure") == "1/Month":
            price = float(item.get("retailPrice", 0))
            if price > 0:
                per_gb = price / 32.0
                _cache_set(cache_key, per_gb)
                return per_gb

    _cache_set(cache_key, _STORAGE_PER_GB)
    return _STORAGE_PER_GB


def _build_response(
    hourly: float,
    vm_size: str,
    region: str,
    os_label: str,
    source: str,
    storage_gb: int = 0,
    storage_cost: float = 0,
) -> Dict[str, Any]:
    compute_monthly = _hourly_to_monthly(hourly)
    total_monthly = round(compute_monthly + storage_cost, 4)
    return {
        "price_per_hour":    round(hourly, 6),
        "price_per_month":   total_monthly,
        "compute_per_month": compute_monthly,
        "storage_per_month": round(storage_cost, 4),
        "vm_size":           vm_size,
        "region":            region,
        "os":                os_label,
        "storage_gb":        storage_gb,
        "price_source":      source,
        "is_fallback":       source == "fallback",
        "currency":          "USD",
    }


def get_vm_monthly_price(
    vm_size: str,
    region: str = "eastus",
    os: str = "linux",
    storage_gb: int = 0,
    reserved: bool = False,
) -> Dict[str, Any]:
    """
    Return monthly price for an Azure VM with source metadata.

    Uses the public Azure Retail Prices API — no credentials required.
    """
    region = _normalize_region(region)
    os_label = "windows" if os.lower() == "windows" else "linux"
    storage_cost = storage_gb * _fetch_storage_per_gb_month(region) if storage_gb > 0 else 0.0

    # Tier 1: Azure Retail API
    hourly = _fetch_vm_hourly(vm_size, region, os_label, reserved)
    if hourly is not None:
        return _build_response(hourly, vm_size, region, os_label, "live", storage_gb, storage_cost)

    # Tier 2: Hardcoded fallback
    base_monthly = _HARDCODED_VM.get(vm_size, 30.0)
    if os_label == "windows":
        base_monthly *= 1.5
    if reserved:
        base_monthly *= 0.63
    hourly_fb = base_monthly / 730
    return _build_response(hourly_fb, vm_size, region, os_label, "fallback", storage_gb, storage_cost)


# ---------------------------------------------------------------------------
# SQL Database pricing
# ---------------------------------------------------------------------------

# Hardcoded fallback for common SQL tiers ($/mo)
_HARDCODED_SQL: Dict[str, float] = {
    "S0": 15.0,
    "S1": 30.0,
    "S2": 75.0,
    "S3": 150.0,
}

def _fetch_sql_hourly(tier: str, region: str) -> Optional[float]:
    """Fetch SQL Database $/hr from Retail API."""
    region = _normalize_region(region)
    filt = (
        f"serviceName eq 'SQL Database' and armRegionName eq '{region}' "
        f"and armSkuName eq '{tier}' and priceType eq 'Consumption'"
    )
    items = _query_retail_prices(filt)
    for item in items:
        unit = item.get("unitOfMeasure", "")
        if "Hour" in unit:
            price = float(item.get("retailPrice", 0))
            if price > 0:
                return price
    return None


def get_sql_monthly_price(
    tier: str = "S2",
    region: str = "eastus",
    storage_gb: int = 50,
) -> Dict[str, Any]:
    """
    Return monthly price for Azure SQL Database.
    Uses public Retail Prices API – no credentials required.
    """
    region = _normalize_region(region)
    storage_cost = storage_gb * 0.117

    hourly = _fetch_sql_hourly(tier, region)
    if hourly is not None:
        compute_monthly = _hourly_to_monthly(hourly)
        total = round(compute_monthly + storage_cost, 4)
        return {
            "price_per_hour":    round(hourly, 6),
            "price_per_month":   total,
            "compute_per_month": compute_monthly,
            "storage_per_month": round(storage_cost, 4),
            "tier":              tier,
            "region":            region,
            "storage_gb":        storage_gb,
            "price_source":      "live",
            "is_fallback":       False,
            "currency":          "USD",
        }

    base = _HARDCODED_SQL.get(tier, 75.0)
    total = round(base + storage_cost, 4)
    return {
        "price_per_hour":    round(base / 730, 6),
        "price_per_month":   total,
        "compute_per_month": base,
        "storage_per_month": round(storage_cost, 4),
        "tier":              tier,
        "region":            region,
        "storage_gb":        storage_gb,
        "price_source":      "fallback",
        "is_fallback":       True,
        "currency":          "USD",
    }


# ---------------------------------------------------------------------------
# Blob Storage pricing
# ---------------------------------------------------------------------------

_HARDCODED_BLOB_PER_GB = 0.018  # Hot LRS


def _fetch_blob_per_gb(region: str) -> Optional[float]:
    """Fetch Blob Storage (Hot LRS) per-GB monthly rate."""
    region = _normalize_region(region)
    cache_key = f"blob_gb:{region}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    filt = (
        f"serviceName eq 'Storage' and armRegionName eq '{region}' "
        f"and meterName eq 'Hot LRS Data Stored' and priceType eq 'Consumption'"
    )
    items = _query_retail_prices(filt)
    for item in items:
        unit = item.get("unitOfMeasure", "")
        if "GB" in unit or "100MB" in unit:
            price = float(item.get("retailPrice", 0))
            if price > 0:
                _cache_set(cache_key, price)
                return price
    return None


def get_storage_monthly_price(
    storage_gb: int = 1000,
    region: str = "eastus",
) -> Dict[str, Any]:
    """
    Return monthly price for Azure Blob Storage (Hot, LRS).
    Uses public Retail Prices API – no credentials required.
    """
    region = _normalize_region(region)

    # Tier 1: Retail API
    per_gb = _fetch_blob_per_gb(region)
    if per_gb is not None:
        total = round(storage_gb * per_gb, 4)
        return {
            "price_per_month":   total,
            "storage_per_month": total,
            "storage_gb":        storage_gb,
            "region":            region,
            "tier":              "hot_lrs",
            "price_source":      "live",
            "is_fallback":       False,
            "currency":          "USD",
        }

    # Tier 2: Hardcoded
    total = round(storage_gb * _HARDCODED_BLOB_PER_GB, 4)
    return {
        "price_per_month":   total,
        "storage_per_month": total,
        "storage_gb":        storage_gb,
        "region":            region,
        "tier":              "hot_lrs",
        "price_source":      "fallback",
        "is_fallback":       True,
        "currency":          "USD",
    }


def get_bulk_vm_prices(
    vm_sizes: list,
    region: str = "eastus",
    os: str = "linux",
    storage_gb: int = 0,
    reserved: bool = False,
) -> Dict[str, Dict[str, Any]]:
    """Fetch prices for multiple VM sizes."""
    return {
        vm: get_vm_monthly_price(vm, region, os, storage_gb, reserved)
        for vm in vm_sizes
    }

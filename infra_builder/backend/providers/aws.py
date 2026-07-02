"""
AWS Live Pricing Provider
=========================
3-tier fallback chain:
  Tier 1 — boto3 AWS Pricing API  (live, region-specific)
  Tier 2 — Infracost Cloud Pricing API  (public, no key needed)
  Tier 3 — Hardcoded static data  (always available)

The application NEVER crashes due to pricing failures.
All boto3/httpx calls are wrapped in try/except.
"""
import json
import logging
from typing import Any, Dict, Optional

import boto3
import httpx
from botocore.exceptions import BotoCoreError, ClientError

from backend.services.settings import get_aws_credentials, has_aws_credentials

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Region name mapping  (AWS region code → display name used by Pricing API)
# ---------------------------------------------------------------------------
REGION_DISPLAY_NAMES: Dict[str, str] = {
    "us-east-1":      "US East (N. Virginia)",
    "us-east-2":      "US East (Ohio)",
    "us-west-1":      "US West (N. California)",
    "us-west-2":      "US West (Oregon)",
    "eu-west-1":      "Europe (Ireland)",
    "eu-west-2":      "Europe (London)",
    "eu-central-1":   "Europe (Frankfurt)",
    "ap-south-1":     "Asia Pacific (Mumbai)",
    "ap-southeast-1": "Asia Pacific (Singapore)",
    "ap-northeast-1": "Asia Pacific (Tokyo)",
    "ca-central-1":   "Canada (Central)",
    "sa-east-1":      "South America (São Paulo)",
}

# ---------------------------------------------------------------------------
# Tier 3 — Hardcoded fallback prices ($/hr, on-demand, Linux)
# ---------------------------------------------------------------------------
_HARDCODED: Dict[str, float] = {
    "t2.micro":    0.0116,
    "t2.small":    0.0230,
    "t2.medium":   0.0464,
    "t2.large":    0.0928,
    "t3.micro":    0.0104,
    "t3.small":    0.0208,
    "t3.medium":   0.0416,
    "t3.large":    0.0832,
    "t3.xlarge":   0.1664,
    "t3.2xlarge":  0.3328,
    "m5.large":    0.0960,
    "m5.xlarge":   0.1920,
    "m5.2xlarge":  0.3840,
    "m5.4xlarge":  0.7680,
    "m6i.large":   0.0960,
    "m6i.xlarge":  0.1920,
    "m6i.2xlarge": 0.3840,
    "c5.large":    0.0850,
    "c5.xlarge":   0.1700,
    "c5.2xlarge":  0.3400,
    "c6i.large":   0.0850,
    "c6i.xlarge":  0.1700,
    "r5.large":    0.1260,
    "r5.xlarge":   0.2520,
    "r5.2xlarge":  0.5040,
    "r6i.large":   0.1260,
    "r6i.xlarge":  0.2520,
    # RDS
    "db.t3.micro":  0.0170,
    "db.t3.small":  0.0340,
    "db.t3.medium": 0.0680,
    "db.t3.large":  0.1360,
    "db.m5.large":  0.1710,
    "db.m5.xlarge": 0.3420,
    "db.r5.large":  0.2400,
    "db.r5.xlarge": 0.4800,
    # ElastiCache
    "cache.t3.micro":   0.0170,
    "cache.t3.small":   0.0340,
    "cache.t3.medium":  0.0680,
    "cache.r6g.large":  0.1680,
    "cache.r6g.xlarge": 0.3360,
}


def _hourly_to_monthly(hourly: float) -> float:
    return round(hourly * 730, 4)


# ---------------------------------------------------------------------------
# Tier 1 — boto3 AWS Pricing API
# ---------------------------------------------------------------------------
def _fetch_ec2_price_boto3(instance_type: str, region: str, os: str = "Linux") -> Optional[float]:
    """
    Fetch on-demand hourly price via boto3.
    The Pricing API is only available in us-east-1 regardless of target region.
    Returns $/hr or None on any error.
    """
    if not has_aws_credentials():
        return None

    creds = get_aws_credentials()
    region_name_display = REGION_DISPLAY_NAMES.get(region, "US East (N. Virginia)")

    try:
        client = boto3.client(
            "pricing",
            region_name="us-east-1",
            aws_access_key_id=creds["access_key_id"],
            aws_secret_access_key=creds["secret_access_key"],
        )
        response = client.get_products(
            ServiceCode="AmazonEC2",
            Filters=[
                {"Type": "TERM_MATCH", "Field": "instanceType",    "Value": instance_type},
                {"Type": "TERM_MATCH", "Field": "location",        "Value": region_name_display},
                {"Type": "TERM_MATCH", "Field": "operatingSystem", "Value": os},
                {"Type": "TERM_MATCH", "Field": "tenancy",         "Value": "Shared"},
                {"Type": "TERM_MATCH", "Field": "preInstalledSw",  "Value": "NA"},
                {"Type": "TERM_MATCH", "Field": "capacitystatus",  "Value": "Used"},
            ],
            MaxResults=1,
        )

        price_list = response.get("PriceList", [])
        if not price_list:
            logger.debug("boto3: no price found for %s in %s", instance_type, region)
            return None

        product_json = json.loads(price_list[0])
        terms = product_json.get("terms", {}).get("OnDemand", {})
        for term in terms.values():
            for dim in term.get("priceDimensions", {}).values():
                price_str = dim.get("pricePerUnit", {}).get("USD", "")
                if price_str:
                    return float(price_str)

    except (BotoCoreError, ClientError) as e:
        logger.debug("boto3 pricing error for %s: %s", instance_type, e)
    except Exception as e:
        logger.debug("Unexpected boto3 error for %s: %s", instance_type, e)

    return None


def _fetch_rds_price_boto3(instance_type: str, region: str, engine: str = "MySQL") -> Optional[float]:
    """Fetch RDS on-demand hourly price."""
    if not has_aws_credentials():
        return None

    creds = get_aws_credentials()
    region_name_display = REGION_DISPLAY_NAMES.get(region, "US East (N. Virginia)")
    db_engine_map = {"mysql": "MySQL", "postgres": "PostgreSQL", "mariadb": "MariaDB",
                     "oracle": "Oracle", "sqlserver": "SQL Server"}
    db_engine = db_engine_map.get(engine.lower(), "MySQL")

    try:
        client = boto3.client(
            "pricing", region_name="us-east-1",
            aws_access_key_id=creds["access_key_id"],
            aws_secret_access_key=creds["secret_access_key"],
        )
        response = client.get_products(
            ServiceCode="AmazonRDS",
            Filters=[
                {"Type": "TERM_MATCH", "Field": "instanceType", "Value": instance_type},
                {"Type": "TERM_MATCH", "Field": "location",     "Value": region_name_display},
                {"Type": "TERM_MATCH", "Field": "databaseEngine","Value": db_engine},
                {"Type": "TERM_MATCH", "Field": "deploymentOption","Value": "Single-AZ"},
            ],
            MaxResults=1,
        )
        price_list = response.get("PriceList", [])
        if not price_list:
            return None
        product_json = json.loads(price_list[0])
        terms = product_json.get("terms", {}).get("OnDemand", {})
        for term in terms.values():
            for dim in term.get("priceDimensions", {}).values():
                price_str = dim.get("pricePerUnit", {}).get("USD", "")
                if price_str:
                    return float(price_str)
    except Exception as e:
        logger.debug("boto3 RDS pricing error for %s: %s", instance_type, e)

    return None


# ---------------------------------------------------------------------------
# Tier 2 — Infracost public pricing API
# ---------------------------------------------------------------------------
_INFRACOST_URL = "https://pricing.api.infracost.io/graphql"
_INFRACOST_QUERY = """
query($region: String!, $instanceType: String!) {
  products(
    filter: {
      vendorName: "aws",
      service: "AmazonEC2",
      region: $region,
      attributeFilters: [
        { key: "instanceType", value: $instanceType },
        { key: "operatingSystem", value: "Linux" },
        { key: "tenancy", value: "Shared" },
        { key: "capacitystatus", value: "Used" },
        { key: "preInstalledSw", value: "NA" }
      ]
    }
  ) {
    prices(filter: { purchaseOption: "on_demand" }) { USD }
  }
}
"""


def _fetch_ec2_price_infracost(instance_type: str, region: str) -> Optional[float]:
    """Query the Infracost public API (no key required for basic usage)."""
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                _INFRACOST_URL,
                json={"query": _INFRACOST_QUERY, "variables": {"region": region, "instanceType": instance_type}},
            )
        if resp.status_code == 200:
            data = resp.json()
            products = data.get("data", {}).get("products", [])
            if products:
                prices = products[0].get("prices", [])
                if prices:
                    usd = prices[0].get("USD")
                    if usd:
                        return float(usd)
    except Exception as e:
        logger.debug("Infracost API error for %s: %s", instance_type, e)

    return None


# ---------------------------------------------------------------------------
# Public API — get_ec2_monthly_price
# ---------------------------------------------------------------------------
def get_ec2_monthly_price(
    instance_type: str,
    region: str = "us-east-1",
    os: str = "linux",
) -> Dict[str, Any]:
    """
    Return monthly price for an EC2 instance with source metadata.

    Response shape:
        {
          "price_per_hour": float,
          "price_per_month": float,
          "instance_type": str,
          "region": str,
          "os": str,
          "price_source": "live" | "infracost" | "fallback",
          "is_fallback": bool,
          "currency": "USD"
        }
    """
    os_label = "Windows" if os.lower() == "windows" else "Linux"

    # ── Tier 1: boto3 ────────────────────────────────────────────────────────
    hourly = _fetch_ec2_price_boto3(instance_type, region, os_label)
    if hourly is not None:
        return _build_response(hourly, instance_type, region, os, "live")

    # ── Tier 2: Infracost ────────────────────────────────────────────────────
    if os_label == "Linux":  # Infracost only for Linux
        hourly = _fetch_ec2_price_infracost(instance_type, region)
        if hourly is not None:
            # Apply Windows multiplier if needed
            return _build_response(hourly, instance_type, region, os, "infracost")

    # ── Tier 3: Hardcoded static ─────────────────────────────────────────────
    hourly = _HARDCODED.get(instance_type)
    if hourly is not None:
        monthly = _hourly_to_monthly(hourly)
        if os_label == "Windows":
            monthly *= 1.4
        return _build_response(hourly, instance_type, region, os, "fallback")

    # Unknown instance — return zero price rather than crashing
    return _build_response(0.0, instance_type, region, os, "fallback")


def get_rds_monthly_price(
    instance_type: str,
    region: str = "us-east-1",
    engine: str = "mysql",
    multi_az: bool = False,
) -> Dict[str, Any]:
    """Return monthly price for an RDS instance."""
    # Tier 1
    hourly = _fetch_rds_price_boto3(instance_type, region, engine)
    if hourly is None:
        hourly = _HARDCODED.get(instance_type, 0.0)
        source = "fallback"
    else:
        source = "live"

    if multi_az:
        hourly *= 2

    return _build_response(hourly, instance_type, region, engine, source)


def get_elasticache_monthly_price(
    node_type: str,
    region: str = "us-east-1",
) -> Dict[str, Any]:
    """Return monthly price for an ElastiCache node (fallback only for now)."""
    hourly = _HARDCODED.get(node_type, 0.0)
    return _build_response(hourly, node_type, region, "redis", "fallback")


def _build_response(
    hourly: float,
    instance_type: str,
    region: str,
    os_or_engine: str,
    source: str,
) -> Dict[str, Any]:
    return {
        "price_per_hour":  round(hourly, 6),
        "price_per_month": _hourly_to_monthly(hourly),
        "instance_type":   instance_type,
        "region":          region,
        "os":              os_or_engine,
        "price_source":    source,
        "is_fallback":     source == "fallback",
        "currency":        "USD",
    }


# ---------------------------------------------------------------------------
# Bulk pricing helper — used by the comparison endpoint
# ---------------------------------------------------------------------------
def get_bulk_ec2_prices(
    instance_types: list,
    region: str = "us-east-1",
    os: str = "linux",
) -> Dict[str, Dict[str, Any]]:
    """Fetch prices for multiple instance types. Returns dict keyed by instance_type."""
    return {it: get_ec2_monthly_price(it, region, os) for it in instance_types}

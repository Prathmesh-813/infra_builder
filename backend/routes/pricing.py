"""
Cloud live pricing endpoints.

AWS:
  POST /api/pricing/aws/ec2         — single EC2 price
  POST /api/pricing/aws/rds         — single RDS price
  POST /api/pricing/aws/elasticache — single ElastiCache price
  POST /api/pricing/aws/bulk        — bulk EC2 prices

Azure (public API, no credentials):
  POST /api/pricing/azure/vm        — single VM price
  POST /api/pricing/azure/bulk      — bulk VM prices

GCP (service account):
  POST /api/pricing/gcp/vm          — single VM price
  POST /api/pricing/gcp/bulk        — bulk VM prices
"""
import logging
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

from backend.providers.azure import (
    get_bulk_vm_prices as get_bulk_azure_vm_prices,
    get_vm_monthly_price as get_azure_vm_monthly_price,
    get_sql_monthly_price as get_azure_sql_monthly_price,
    get_storage_monthly_price as get_azure_storage_monthly_price,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pricing/aws", tags=["AWS Pricing"])


# ── Request models ────────────────────────────────────────────────────────────

class EC2PriceRequest(BaseModel):
    instance_type: str = "t3.medium"
    region: str = "us-east-1"
    os: str = "linux"


class RDSPriceRequest(BaseModel):
    instance_type: str = "db.t3.medium"
    region: str = "us-east-1"
    engine: str = "mysql"
    multi_az: bool = False


class ElastiCachePriceRequest(BaseModel):
    node_type: str = "cache.t3.medium"
    region: str = "us-east-1"


class BulkEC2Request(BaseModel):
    instance_types: List[str]
    region: str = "us-east-1"
    os: str = "linux"


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _get_aws_provider():
    """Lazy-load AWS provider (boto3 may fail on some systems)."""
    from backend.providers.aws import (
        get_bulk_ec2_prices,
        get_ec2_monthly_price,
        get_elasticache_monthly_price,
        get_rds_monthly_price,
    )
    return get_ec2_monthly_price, get_rds_monthly_price, get_elasticache_monthly_price, get_bulk_ec2_prices


@router.post("/ec2")
def price_ec2(req: EC2PriceRequest) -> Dict[str, Any]:
    """Return monthly price for a single EC2 instance type."""
    fn, _, _, _ = _get_aws_provider()
    return fn(req.instance_type, req.region, req.os)


@router.post("/rds")
def price_rds(req: RDSPriceRequest) -> Dict[str, Any]:
    """Return monthly price for a single RDS instance."""
    _, fn, _, _ = _get_aws_provider()
    return fn(req.instance_type, req.region, req.engine, req.multi_az)


@router.post("/elasticache")
def price_elasticache(req: ElastiCachePriceRequest) -> Dict[str, Any]:
    """Return monthly price for a single ElastiCache node."""
    _, _, fn, _ = _get_aws_provider()
    return fn(req.node_type, req.region)


class AzureVMPriceRequest(BaseModel):
    vm_size: str = "Standard_B2s"
    region: str = "eastus"
    os: str = "linux"
    storage_gb: int = 0
    reserved: bool = False


class BulkAzureVMRequest(BaseModel):
    vm_sizes: List[str]
    region: str = "eastus"
    os: str = "linux"
    storage_gb: int = 0
    reserved: bool = False


@router.post("/bulk")
def price_bulk_ec2(req: BulkEC2Request) -> Dict[str, Any]:
    """
    Bulk-fetch EC2 prices for a list of instance types.

    Response:
    {
      "region": "us-east-1",
      "prices": {
        "t3.micro":   { "price_per_month": 7.6, "price_source": "live", ... },
        "m5.large":   { "price_per_month": 70.1, "price_source": "live", ... },
        ...
      }
    }
    """
    _, _, _, fn = _get_aws_provider()
    prices = fn(req.instance_types, req.region, req.os)
    return {"region": req.region, "prices": prices}


# ── Azure endpoints (public API — no credentials) ───────────────────────────

azure_router = APIRouter(prefix="/api/pricing/azure", tags=["Azure Pricing"])


@azure_router.post("/vm")
def price_azure_vm(req: AzureVMPriceRequest) -> Dict[str, Any]:
    """Return monthly price for a single Azure VM (public Retail Prices API)."""
    return get_azure_vm_monthly_price(
        req.vm_size, req.region, req.os, req.storage_gb, req.reserved,
    )


@azure_router.post("/bulk")
def price_bulk_azure_vm(req: BulkAzureVMRequest) -> Dict[str, Any]:
    """Bulk-fetch Azure VM prices for a list of VM sizes."""
    prices = get_bulk_azure_vm_prices(
        req.vm_sizes, req.region, req.os, req.storage_gb, req.reserved,
    )
    return {"region": req.region, "prices": prices}


class AzureSQLPriceRequest(BaseModel):
    tier: str = "S2"
    region: str = "eastus"
    storage_gb: int = 50


class AzureStoragePriceRequest(BaseModel):
    storage_gb: int = 1000
    region: str = "eastus"


@azure_router.post("/sql")
def price_azure_sql(req: AzureSQLPriceRequest) -> Dict[str, Any]:
    """Return monthly price for Azure SQL Database (public Retail Prices API)."""
    return get_azure_sql_monthly_price(req.tier, req.region, req.storage_gb)


@azure_router.post("/storage")
def price_azure_storage(req: AzureStoragePriceRequest) -> Dict[str, Any]:
    """Return monthly price for Azure Blob Storage (public Retail Prices API)."""
    return get_azure_storage_monthly_price(req.storage_gb, req.region)


# ── GCP endpoints (service account required) ────────────────────────────────

class GCPVMPriceRequest(BaseModel):
    machine_type: str = "e2-medium"
    region: str = "us-central1"
    os: str = "linux"
    storage_gb: int = 0
    committed: bool = False


class BulkGCPVMRequest(BaseModel):
    machine_types: List[str]
    region: str = "us-central1"
    os: str = "linux"
    storage_gb: int = 0
    committed: bool = False


gcp_router = APIRouter(prefix="/api/pricing/gcp", tags=["GCP Pricing"])


@gcp_router.post("/vm")
def price_gcp_vm(req: GCPVMPriceRequest) -> Dict[str, Any]:
    """Return monthly price for a single GCP Compute Engine VM."""
    return get_gcp_vm_monthly_price(
        req.machine_type, req.region, req.os, req.storage_gb, req.committed,
    )


@gcp_router.post("/bulk")
def price_bulk_gcp_vm(req: BulkGCPVMRequest) -> Dict[str, Any]:
    """Bulk-fetch GCP VM prices for a list of machine types."""
    prices = get_bulk_gcp_vm_prices(
        req.machine_types, req.region, req.os, req.storage_gb, req.committed,
    )
    return {"region": req.region, "prices": prices}

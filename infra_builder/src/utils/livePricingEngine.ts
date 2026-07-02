/**
 * livePricingEngine.ts
 * --------------------
 * Fetches REAL cloud prices from the FastAPI backend and merges them
 * into comparison results, replacing hardcoded estimates.
 *
 * AWS — requires IAM credentials (boto3 → Infracost → fallback)
 * Azure — public Retail Prices API (no credentials)
 * GCP  — service account + Cloud Billing Catalog API
 */

import { fetchBulkEC2Prices, fetchRDSPrice } from './awsPricingClient';
import { fetchBulkAzureVMPrices, fetchAzureSQLPrice, fetchAzureStoragePrice } from './azurePricingClient';
import { fetchBulkGCPVMPrices } from './gcpPricingClient';
import type { ComparisonResult } from './costComparisonEngine';

export type PriceSource = 'live' | 'infracost' | 'fallback' | 'static';

export interface LivePrice {
  monthlyMin: number;
  monthlyMax: number;
  basis: string;
  source: PriceSource;
}

export interface ProviderLivePrices {
  aws?: LivePrice | null;
  azure?: LivePrice | null;
  gcp?: LivePrice | null;
}

const _cache = new Map<string, LivePrice>();

function cacheKey(...parts: string[]): string {
  return parts.join('|');
}

function toLivePrice(
  monthly: number,
  basis: string,
  source: PriceSource,
  buffer = 0,
): LivePrice {
  const rounded = Math.round(monthly * 100) / 100;
  const isExact = source === 'live' || source === 'infracost';
  return {
    monthlyMin: rounded,
    monthlyMax: isExact ? rounded : Math.round((monthly + buffer) * 100) / 100,
    basis,
    source,
  };
}

// ─── AWS: EC2 live price ─────────────────────────────────────────────────────

export async function fetchLiveEC2Price(
  instanceType: string,
  region = 'us-east-1',
  os = 'linux',
  storageGb = 0,
): Promise<LivePrice | null> {
  const key = cacheKey('aws-ec2', instanceType, region, os, String(storageGb));
  if (_cache.has(key)) return _cache.get(key)!;

  const bulk = await fetchBulkEC2Prices([instanceType], region, os);
  if (!bulk) return null;

  const result = bulk.prices[instanceType];
  if (!result) return null;

  const storageCost = storageGb * 0.08;
  const monthly = result.price_per_month + storageCost;
  const price = toLivePrice(
    monthly,
    `${instanceType} (${result.price_per_hour.toFixed(4)}/hr)${storageGb > 0 ? ` + ${storageGb}GB EBS` : ''} [${result.price_source}]`,
    result.price_source as PriceSource,
    2,
  );

  _cache.set(key, price);
  return price;
}

// ─── AWS: RDS live price ─────────────────────────────────────────────────────

export async function fetchLiveRDSPrice(
  instanceClass: string,
  region = 'us-east-1',
  engine = 'mysql',
  multiAz = false,
  storageCost = 0,
): Promise<LivePrice | null> {
  const key = cacheKey('aws-rds', instanceClass, region, engine, String(multiAz));
  if (_cache.has(key)) return _cache.get(key)!;

  const result = await fetchRDSPrice(instanceClass, region, engine, multiAz);
  if (!result) return null;

  const monthly = result.price_per_month + storageCost;
  const price = toLivePrice(
    monthly,
    `${instanceClass}${multiAz ? ' Multi-AZ' : ''} @ $${result.price_per_hour.toFixed(4)}/hr${storageCost > 0 ? ` + $${storageCost.toFixed(0)} storage` : ''} [${result.price_source}]`,
    result.price_source as PriceSource,
    15,
  );

  _cache.set(key, price);
  return price;
}

// ─── Azure: VM live price ────────────────────────────────────────────────────

export async function fetchLiveAzureVMPrice(
  vmSize: string,
  region = 'eastus',
  os = 'linux',
  storageGb = 0,
  reserved = false,
): Promise<LivePrice | null> {
  const key = cacheKey('azure-vm', vmSize, region, os, String(storageGb), String(reserved));
  if (_cache.has(key)) return _cache.get(key)!;

  const bulk = await fetchBulkAzureVMPrices([vmSize], region, os, storageGb, reserved);
  if (!bulk) return null;

  const result = bulk.prices[vmSize];
  if (!result) return null;

  const price = toLivePrice(
    result.price_per_month,
    `${vmSize} (${result.price_per_hour.toFixed(4)}/hr)${storageGb > 0 ? ` + ${storageGb}GB disk` : ''} [${result.price_source}]`,
    result.price_source as PriceSource,
    2,
  );

  _cache.set(key, price);
  return price;
}

// ─── GCP: VM live price ──────────────────────────────────────────────────────

export async function fetchLiveGCPVMPrice(
  machineType: string,
  region = 'us-central1',
  os = 'linux',
  storageGb = 0,
  committed = false,
): Promise<LivePrice | null> {
  const key = cacheKey('gcp-vm', machineType, region, os, String(storageGb), String(committed));
  if (_cache.has(key)) return _cache.get(key)!;

  const bulk = await fetchBulkGCPVMPrices([machineType], region, os, storageGb, committed);
  if (!bulk) return null;

  const result = bulk.prices[machineType];
  if (!result) return null;

  const price = toLivePrice(
    result.price_per_month,
    `${machineType} (${result.price_per_hour.toFixed(4)}/hr)${storageGb > 0 ? ` + ${storageGb}GB pd-balanced` : ''} [${result.price_source}]`,
    result.price_source as PriceSource,
    2,
  );

  _cache.set(key, price);
  return price;
}

// ─── AWS: resolve live price for a service ───────────────────────────────────

export async function resolveLiveAWSPrice(
  serviceId: string,
  configs: Record<string, string | number | boolean>,
  region = 'us-east-1',
): Promise<LivePrice | null> {
  const os = String(configs.os || 'linux');
  const storageGb = Number(configs.storage_gb ?? 0);

  switch (serviceId) {
    case 'virtual-machine': {
      const it = String(configs.instance_type || 't3.medium');
      const isReserved = !!configs.reserved;
      const price = await fetchLiveEC2Price(it, region, os, storageGb);
      if (price && isReserved) {
        const reserved = Math.round(price.monthlyMin * 0.62 * 100) / 100;
        return { ...price, monthlyMin: reserved, monthlyMax: reserved, basis: price.basis + ' [Reserved -38%]' };
      }
      return price;
    }

    case 'managed-database': {
      const ic = String(configs.instance_class || 'db.t3.medium');
      const engine = String(configs.engine || 'mysql');
      const multiAz = !!configs.multi_az;
      const storage = Number(configs.storage_gb || 100) * 0.115;
      return fetchLiveRDSPrice(ic, region, engine, multiAz, storage);
    }

    case 'managed-kubernetes': {
      const nodeIt = String(configs.node_instance || 't3.medium');
      const nodeCount = Number(configs.node_count || 3);
      const nodePrice = await fetchLiveEC2Price(nodeIt, region, 'linux');
      if (!nodePrice) return null;
      const monthly = 73 + nodePrice.monthlyMin * nodeCount;
      return toLivePrice(
        monthly,
        `$73 cluster fee + ${nodeCount}x ${nodeIt} @ $${nodePrice.monthlyMin.toFixed(0)}/mo each [live]`,
        nodePrice.source,
        nodeCount * 5,
      );
    }

    default:
      return null;
  }
}

// ─── Azure: SQL Database live price ──────────────────────────────────────────

export async function fetchLiveAzureSQLPrice(
  tier = 'S2',
  region = 'eastus',
  storageGb = 50,
): Promise<LivePrice | null> {
  const key = cacheKey('azure-sql', tier, region, String(storageGb));
  if (_cache.has(key)) return _cache.get(key)!;

  const result = await fetchAzureSQLPrice(tier, region, storageGb);
  if (!result) return null;

  const price = toLivePrice(
    result.price_per_month,
    `${result.tier} (${result.price_per_hour.toFixed(4)}/hr)${storageGb > 0 ? ` + ${storageGb}GB storage` : ''} [${result.price_source}]`,
    result.price_source as PriceSource,
    5,
  );
  _cache.set(key, price);
  return price;
}

// ─── Azure: Blob Storage live price ──────────────────────────────────────────

export async function fetchLiveAzureStoragePrice(
  storageGb = 1000,
  region = 'eastus',
): Promise<LivePrice | null> {
  const key = cacheKey('azure-storage', String(storageGb), region);
  if (_cache.has(key)) return _cache.get(key)!;

  const result = await fetchAzureStoragePrice(storageGb, region);
  if (!result) return null;

  const price = toLivePrice(
    result.price_per_month,
    `${storageGb}GB Blob Storage (Hot LRS) @ $${(result.price_per_month / storageGb).toFixed(3)}/GB [${result.price_source}]`,
    result.price_source as PriceSource,
    5,
  );
  _cache.set(key, price);
  return price;
}

// ─── Azure: resolve live price for a service ─────────────────────────────────

export async function resolveLiveAzurePrice(
  serviceId: string,
  configs: Record<string, string | number | boolean>,
  region = 'eastus',
): Promise<LivePrice | null> {
  const os = String(configs.os || 'linux');
  const storageGb = Number(configs.storage_gb ?? 0);

  switch (serviceId) {
    case 'virtual-machine': {
      const vmSize = String(configs.vm_size || 'Standard_B2s');
      const isReserved = !!configs.reserved;
      return fetchLiveAzureVMPrice(vmSize, region, os, storageGb, isReserved);
    }

    case 'managed-kubernetes': {
      const nodeVm = String(configs.node_vm || 'Standard_D2s_v3');
      const nodeCount = Number(configs.node_count || 3);
      const nodePrice = await fetchLiveAzureVMPrice(nodeVm, region, 'linux');
      if (!nodePrice) return null;
      const monthly = nodePrice.monthlyMin * nodeCount;
      return toLivePrice(
        monthly,
        `Free control plane + ${nodeCount}x ${nodeVm} @ $${nodePrice.monthlyMin.toFixed(0)}/mo each [live]`,
        nodePrice.source,
        nodeCount * 5,
      );
    }

    case 'managed-database': {
      const tier = String(configs.tier || 'S2');
      return fetchLiveAzureSQLPrice(tier, region, storageGb);
    }

    case 'object-storage': {
      const st = Number(configs.storage_gb ?? 1000);
      return fetchLiveAzureStoragePrice(st, region);
    }

    default:
      return null;
  }
}

// ─── GCP: resolve live price for a service ─────────────────────────────────

export async function resolveLiveGCPPrice(
  serviceId: string,
  configs: Record<string, string | number | boolean>,
  region = 'us-central1',
): Promise<LivePrice | null> {
  const os = String(configs.os || 'linux');
  const storageGb = Number(configs.storage_gb ?? 0);

  switch (serviceId) {
    case 'virtual-machine': {
      const mt = String(configs.machine_type || 'e2-medium');
      const isCommitted = !!configs.committed;
      return fetchLiveGCPVMPrice(mt, region, os, storageGb, isCommitted);
    }

    case 'managed-kubernetes': {
      const nodeMachine = String(configs.node_machine || 'e2-standard-2');
      const nodeCount = Number(configs.node_count || 3);
      const nodePrice = await fetchLiveGCPVMPrice(nodeMachine, region, 'linux');
      if (!nodePrice) return null;
      const monthly = nodePrice.monthlyMin * nodeCount;
      return toLivePrice(
        monthly,
        `Free control plane + ${nodeCount}x ${nodeMachine} @ $${nodePrice.monthlyMin.toFixed(0)}/mo each [live]`,
        nodePrice.source,
        nodeCount * 5,
      );
    }

    default:
      return null;
  }
}

// ─── Resolve all live prices for a service ───────────────────────────────────

export async function resolveAllLivePrices(
  serviceId: string,
  configs: Record<string, Record<string, string | number | boolean>>,
  opts: { aws?: boolean; azure?: boolean; gcp?: boolean; awsRegion?: string; azureRegion?: string; gcpRegion?: string } = {},
): Promise<ProviderLivePrices> {
  const [aws, azure, gcp] = await Promise.all([
    opts.aws
      ? resolveLiveAWSPrice(serviceId, configs.aws ?? {}, opts.awsRegion ?? 'us-east-1')
      : Promise.resolve(null),
    opts.azure
      ? resolveLiveAzurePrice(serviceId, configs.azure ?? {}, opts.azureRegion ?? 'eastus')
      : Promise.resolve(null),
    opts.gcp
      ? resolveLiveGCPPrice(serviceId, configs.gcp ?? {}, opts.gcpRegion ?? 'us-central1')
      : Promise.resolve(null),
  ]);
  return { aws, azure, gcp };
}

export function clearLivePriceCache(): void {
  _cache.clear();
}

/** Merge live prices from one or more providers into a comparison result. */
export function applyLivePrices(
  result: ComparisonResult,
  overrides: ProviderLivePrices,
): ComparisonResult {
  const map: Partial<Record<'aws' | 'azure' | 'gcp', LivePrice | null | undefined>> = {
    aws: overrides.aws,
    azure: overrides.azure,
    gcp: overrides.gcp,
  };

  let changed = false;
  const providers = result.providers.map(p => {
    const live = map[p.provider as 'aws' | 'azure' | 'gcp'];
    if (!live) return p;
    changed = true;
    return {
      ...p,
      monthlyMin: live.monthlyMin,
      monthlyMax: live.monthlyMax,
      basis: live.basis,
    };
  });

  return changed ? { ...result, providers } : result;
}

/** @deprecated Use applyLivePrices instead */
export function applyLiveAwsPrice(
  result: ComparisonResult,
  livePrice: LivePrice | null | undefined,
): ComparisonResult {
  return applyLivePrices(result, { aws: livePrice });
}

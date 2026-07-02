/**
 * azurePricingClient.ts
 * ---------------------
 * Calls the FastAPI backend to get live Azure prices from the
 * public Azure Retail Prices API (no credentials required).
 */

import { API_BASE } from '../config/api';

export type AzurePriceSource = 'live' | 'fallback';

export interface AzurePriceResult {
  price_per_hour: number;
  price_per_month: number;
  compute_per_month: number;
  storage_per_month: number;
  vm_size: string;
  region: string;
  os: string;
  storage_gb: number;
  price_source: AzurePriceSource;
  is_fallback: boolean;
  currency: string;
}

export interface BulkAzurePriceResult {
  region: string;
  prices: Record<string, AzurePriceResult>;
}

const BASE = API_BASE;
const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAzureVMPrice(
  vmSize: string,
  region = 'eastus',
  os = 'linux',
  storageGb = 0,
  reserved = false,
): Promise<AzurePriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/azure/vm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vm_size: vmSize,
        region,
        os,
        storage_gb: storageGb,
        reserved,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchBulkAzureVMPrices(
  vmSizes: string[],
  region = 'eastus',
  os = 'linux',
  storageGb = 0,
  reserved = false,
): Promise<BulkAzurePriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/azure/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vm_sizes: vmSizes,
        region,
        os,
        storage_gb: storageGb,
        reserved,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface AzureSQLPriceResult {
  price_per_hour: number;
  price_per_month: number;
  compute_per_month: number;
  storage_per_month: number;
  tier: string;
  region: string;
  storage_gb: number;
  price_source: AzurePriceSource;
  is_fallback: boolean;
  currency: string;
}

export interface AzureStoragePriceResult {
  price_per_month: number;
  storage_per_month: number;
  storage_gb: number;
  region: string;
  tier: string;
  price_source: AzurePriceSource;
  is_fallback: boolean;
  currency: string;
}

export async function fetchAzureSQLPrice(
  tier = 'S2',
  region = 'eastus',
  storageGb = 50,
): Promise<AzureSQLPriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/azure/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, region, storage_gb: storageGb }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchAzureStoragePrice(
  storageGb = 1000,
  region = 'eastus',
): Promise<AzureStoragePriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/azure/storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_gb: storageGb, region }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Check if Azure pricing backend is reachable. */
export async function isAzurePricingAvailable(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

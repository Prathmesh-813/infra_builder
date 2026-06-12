/**
 * gcpPricingClient.ts
 * -------------------
 * Calls the FastAPI backend for live GCP prices via Cloud Billing Catalog API.
 * Requires a service-account JSON saved in settings.
 */

export type GCPPriceSource = 'live' | 'fallback';

export interface GCPPriceResult {
  price_per_hour: number;
  price_per_month: number;
  compute_per_month: number;
  storage_per_month: number;
  machine_type: string;
  region: string;
  os: string;
  storage_gb: number;
  price_source: GCPPriceSource;
  is_fallback: boolean;
  currency: string;
}

export interface BulkGCPPriceResult {
  region: string;
  prices: Record<string, GCPPriceResult>;
}

export interface GCPCredentialsStatus {
  configured: boolean;
  masked_email: string;
  masked_project: string;
  message: string;
}

export interface GCPTestResult {
  valid: boolean;
  message: string;
  project_id?: string;
  client_email?: string;
  error_code?: string;
}

const BASE = '/api';
const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getGCPCredentialsStatus(): Promise<GCPCredentialsStatus> {
  try {
    const res = await fetchWithTimeout(`${BASE}/settings/gcp/credentials`);
    if (!res.ok) throw new Error('not ok');
    return res.json();
  } catch {
    return { configured: false, masked_email: '', masked_project: '', message: 'Backend unreachable' };
  }
}

export async function testGCPCredentials(serviceAccountJson: string): Promise<GCPTestResult> {
  const res = await fetchWithTimeout(`${BASE}/settings/gcp/credentials/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_account_json: serviceAccountJson }),
  });
  return res.json();
}

export async function saveGCPCredentials(
  serviceAccountJson: string,
  skipValidation = false,
): Promise<GCPCredentialsStatus> {
  const res = await fetchWithTimeout(`${BASE}/settings/gcp/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_account_json: serviceAccountJson, skip_validation: skipValidation }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? 'Failed to save credentials');
  }
  return res.json();
}

export async function deleteGCPCredentials(): Promise<GCPCredentialsStatus> {
  const res = await fetchWithTimeout(`${BASE}/settings/gcp/credentials`, { method: 'DELETE' });
  return res.json();
}

export async function fetchGCPVMPrice(
  machineType: string,
  region = 'us-central1',
  os = 'linux',
  storageGb = 0,
  committed = false,
): Promise<GCPPriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/gcp/vm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_type: machineType,
        region,
        os,
        storage_gb: storageGb,
        committed,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchBulkGCPVMPrices(
  machineTypes: string[],
  region = 'us-central1',
  os = 'linux',
  storageGb = 0,
  committed = false,
): Promise<BulkGCPPriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/gcp/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_types: machineTypes,
        region,
        os,
        storage_gb: storageGb,
        committed,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

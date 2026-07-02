/**
 * awsPricingClient.ts
 * -------------------
 * Calls the FastAPI backend to get live AWS prices.
 * Falls back to static data if backend is unreachable.
 */

import { API_BASE } from '../config/api';

export type PriceSource = 'live' | 'infracost' | 'fallback';

export interface PriceResult {
  price_per_hour: number;
  price_per_month: number;
  instance_type: string;
  region: string;
  os: string;
  price_source: PriceSource;
  is_fallback: boolean;
  currency: string;
}

export interface BulkPriceResult {
  region: string;
  prices: Record<string, PriceResult>;
}

export interface CredentialsStatus {
  configured: boolean;
  masked_key: string;
  message: string;
}

export interface TestResult {
  valid: boolean;
  message: string;
  account_id?: string;
  arn?: string;
}

const BASE = API_BASE;
const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Credential management ────────────────────────────────────────────────────

export async function getCredentialsStatus(): Promise<CredentialsStatus> {
  try {
    const res = await fetchWithTimeout(`${BASE}/settings/aws/credentials`);
    if (!res.ok) throw new Error('not ok');
    return res.json();
  } catch {
    return { configured: false, masked_key: '', message: 'Backend unreachable' };
  }
}

export async function testCredentials(
  accessKeyId: string,
  secretAccessKey: string,
): Promise<TestResult & { error_code?: string }> {
  const res = await fetchWithTimeout(`${BASE}/settings/aws/credentials/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_key_id: accessKeyId, secret_access_key: secretAccessKey }),
  });
  return res.json();
}

export async function saveCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  skipValidation = false,
): Promise<CredentialsStatus> {
  const res = await fetchWithTimeout(`${BASE}/settings/aws/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_key_id: accessKeyId, secret_access_key: secretAccessKey, skip_validation: skipValidation }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? 'Failed to save credentials');
  }
  return res.json();
}

export async function deleteCredentials(): Promise<CredentialsStatus> {
  const res = await fetchWithTimeout(`${BASE}/settings/aws/credentials`, { method: 'DELETE' });
  return res.json();
}

// ── Pricing ──────────────────────────────────────────────────────────────────

export async function fetchEC2Price(
  instanceType: string,
  region = 'us-east-1',
  os = 'linux',
): Promise<PriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/aws/ec2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_type: instanceType, region, os }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchBulkEC2Prices(
  instanceTypes: string[],
  region = 'us-east-1',
  os = 'linux',
): Promise<BulkPriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/aws/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_types: instanceTypes, region, os }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchRDSPrice(
  instanceType: string,
  region = 'us-east-1',
  engine = 'mysql',
  multiAz = false,
): Promise<PriceResult | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/pricing/aws/rds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_type: instanceType, region, engine, multi_az: multiAz }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

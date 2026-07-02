// Aggregates system health from both backends (Oz + InfraStudio) into one list.
// Each backend checks its own integrations; the UI merges and summarises them.
import { OZ_API_BASE, API_BASE } from '../config/api';

export type CompStatus = 'ok' | 'degraded' | 'down' | 'unconfigured';

export interface HealthComponent {
  name: string;
  category: string;
  status: CompStatus;
  latency_ms: number | null;
  message: string;
}

async function fetchComponents(url: string): Promise<HealthComponent[]> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data.components || []) as HealthComponent[];
}

export async function getSystemHealth(): Promise<HealthComponent[]> {
  const [oz, studio] = await Promise.allSettled([
    fetchComponents(`${OZ_API_BASE}/health/system`),
    fetchComponents(`${API_BASE}/health/system`),
  ]);
  const comps: HealthComponent[] = [];
  if (oz.status === 'fulfilled') comps.push(...oz.value);
  else comps.push({ name: 'Oz API', category: 'Core', status: 'down', latency_ms: null, message: 'Unreachable' });
  if (studio.status === 'fulfilled') comps.push(...studio.value);
  else comps.push({ name: 'InfraStudio API', category: 'Core', status: 'down', latency_ms: null, message: 'Unreachable' });
  return comps;
}

// Unconfigured components are not failures — only down/degraded count.
export function overallStatus(comps: HealthComponent[]): 'ok' | 'degraded' | 'down' {
  if (comps.some((c) => c.status === 'down')) return 'down';
  if (comps.some((c) => c.status === 'degraded')) return 'degraded';
  return 'ok';
}

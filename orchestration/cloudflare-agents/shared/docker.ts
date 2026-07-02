// Shared Docker Engine API helpers used by the docker + server-health agents.
// All HTTP goes through fetchWithTimeout so a hung daemon can't stall the Worker.

import { fetchWithTimeout } from './agent-core'

export async function dockerGet(base: string, path: string): Promise<unknown> {
  const res = await fetchWithTimeout(`${base}${path}`)
  if (!res.ok) throw new Error(`Docker API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function dockerPost(base: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetchWithTimeout(`${base}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok && res.status !== 204) throw new Error(`Docker API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  if (!text) return { ok: true }
  try { return JSON.parse(text) } catch { return { raw: text.slice(0, 500) } }
}

export async function dockerDelete(base: string, path: string): Promise<void> {
  const res = await fetchWithTimeout(`${base}${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`Docker API ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/**
 * Decode a Docker log/exec stream (fix #10).
 * Multiplexed streams frame each chunk as [stream(1)][000][size(4 BE)][payload].
 * TTY-enabled containers send raw bytes with NO header — detect that and pass
 * the buffer through verbatim instead of misreading text bytes as frame sizes.
 */
export function parseDockerStream(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder()
  if (!looksMultiplexed(bytes)) return decoder.decode(buffer)

  const view = new DataView(buffer)
  const lines: string[] = []
  let offset = 0
  while (offset + 8 <= bytes.byteLength) {
    const streamType = bytes[offset]
    const size = view.getUint32(offset + 4, false)
    offset += 8
    // A malformed frame means this wasn't really multiplexed — fall back to raw.
    if (streamType > 2 || offset + size > bytes.byteLength) return decoder.decode(buffer)
    if (size === 0) continue
    lines.push(decoder.decode(buffer.slice(offset, offset + size)))
    offset += size
  }
  return lines.join('') || decoder.decode(buffer)
}

/** A valid multiplexed header starts with stream type 0/1/2 then three zero bytes. */
function looksMultiplexed(b: Uint8Array): boolean {
  return b.byteLength >= 8 && b[0] <= 2 && b[1] === 0 && b[2] === 0 && b[3] === 0
}

// ── CPU / memory stats (fix #8) ──────────────────────────────────────────────
type Stats = Record<string, any>

/**
 * Fetch a container's stats with a usable CPU baseline. A single `stream=false`
 * snapshot often has an empty `precpu_stats`, which yields a bogus CPU%. When the
 * baseline is missing we take a second sample ~1s later and diff the two.
 */
export async function sampleStats(base: string, id: string): Promise<Stats> {
  const s1 = await dockerGet(base, `/containers/${encodeURIComponent(id)}/stats?stream=false`) as Stats
  const baseline = s1?.precpu_stats?.cpu_usage?.total_usage
  if (typeof baseline === 'number' && baseline > 0) return s1
  await new Promise((r) => setTimeout(r, 1000))
  const s2 = await dockerGet(base, `/containers/${encodeURIComponent(id)}/stats?stream=false`) as Stats
  return { ...s2, precpu_stats: s1?.cpu_stats ?? {} }
}

/** Docker's CPU% formula, guarded against missing/zero fields. */
export function cpuPercent(s: Stats): string {
  const cpu = s?.cpu_stats ?? {}
  const precpu = s?.precpu_stats ?? {}
  const cpuDelta = (cpu?.cpu_usage?.total_usage ?? 0) - (precpu?.cpu_usage?.total_usage ?? 0)
  const sysDelta = (cpu?.system_cpu_usage ?? 0) - (precpu?.system_cpu_usage ?? 0)
  const numCpus = cpu?.online_cpus || cpu?.cpu_usage?.percpu_usage?.length || 1
  return sysDelta > 0 && cpuDelta >= 0 ? ((cpuDelta / sysDelta) * numCpus * 100).toFixed(2) : '0.00'
}

/** Working-set memory (usage minus page cache), guarded. */
export function memInfo(s: Stats): { usage: number; limit: number; pct: string } {
  const mem = s?.memory_stats ?? {}
  const usage = (mem.usage ?? 0) - (mem?.stats?.cache ?? 0)
  const limit = mem.limit ?? 0
  const pct = limit > 0 ? ((usage / limit) * 100).toFixed(1) : '0.0'
  return { usage: Math.max(usage, 0), limit, pct }
}

export function toHuman(bytes: number): string {
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

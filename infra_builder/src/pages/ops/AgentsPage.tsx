// Agents — list, launch, observe (logs), cancel/retry. Native React over the Oz API.
import { useEffect, useRef, useState } from 'react';
import { Bot, Plus, X, Loader2, Rocket, Ban, RotateCcw, ScrollText } from 'lucide-react';
import {
  listAgents, launchAgent, cancelAgent, retryAgent, getAgentLogs, listServers,
  AGENT_TYPES, type AgentSummary, type AgentLogLine, type Server,
} from '../../utils/ozClient';
import { OZ_API_BASE } from '../../config/api';
import { toast } from '../../store/toastStore';
import { PageShell, StatusBadge, StatCard, relTime, Spinner, ErrorState, EmptyState, RefreshButton, useAsync, inputStyle } from './OpsCommon';

const ACTIVE = (s: string) => s === 'running' || s === 'pending';

export default function AgentsPage() {
  const { data: agents, loading, error, reload } = useAsync<AgentSummary[]>(() => listAgents(undefined, 100), []);
  const [showLaunch, setShowLaunch] = useState(false);
  const [logsFor, setLogsFor] = useState<number | null>(null);

  // Auto-refresh the list while any agent is active.
  useEffect(() => {
    if (!agents?.some((a) => ACTIVE(a.status))) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [agents, reload]);

  return (
    <PageShell
      title="Agents"
      subtitle="Launch and observe AI agents against your infrastructure"
      actions={<>
        <RefreshButton onClick={reload} busy={loading} />
        <button onClick={() => setShowLaunch(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Plus size={13} /> Launch agent
        </button>
      </>}
    >
      {agents && agents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total runs" value={agents.length} color="var(--text-primary)" />
          <StatCard label="Active" value={agents.filter((a) => ACTIVE(a.status)).length} color="#38bdf8" />
          <StatCard label="Completed" value={agents.filter((a) => a.status === 'completed').length} color="#34d399" />
          <StatCard label="Failed" value={agents.filter((a) => a.status === 'failed').length} color="#f87171" />
        </div>
      )}
      {loading && !agents ? <Spinner />
        : error ? <ErrorState message={error} onRetry={reload} />
        : !agents?.length ? <EmptyState message="No agent runs yet. Launch one to get started." />
        : (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  {['ID', 'Type', 'Status', 'Created', 'Finished', ''].map((h) => (
                    <th key={h} className="text-left font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-secondary)' }}>#{a.id}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{a.agent_type}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{relTime(a.created_at)}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{relTime(a.finished_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => setLogsFor(a.id)} title="Logs" aria-label={`View logs for agent ${a.id}`}
                          className="p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-input)' }}>
                          <ScrollText size={13} />
                        </button>
                        {ACTIVE(a.status) && (
                          <button title="Cancel" aria-label={`Cancel agent ${a.id}`}
                            onClick={() => cancelAgent(a.id).then(() => { toast.info(`Agent #${a.id} cancelled`); reload(); }).catch((e) => toast.error(e.message))}
                            className="p-1.5 rounded-lg text-orange-400" style={{ border: '1px solid rgba(251,146,60,0.3)' }}>
                            <Ban size={13} />
                          </button>
                        )}
                        {(a.status === 'failed' || a.status === 'cancelled') && (
                          <button title="Retry" aria-label={`Retry agent ${a.id}`}
                            onClick={() => retryAgent(a.id).then(() => { toast.success(`Agent #${a.id} retried`); reload(); }).catch((e) => toast.error(e.message))}
                            className="p-1.5 rounded-lg text-indigo-400" style={{ border: '1px solid rgba(129,140,248,0.3)' }}>
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {showLaunch && <LaunchModal onClose={() => setShowLaunch(false)} onLaunched={() => { setShowLaunch(false); reload(); }} />}
      {logsFor != null && <LogsModal agentId={logsFor} onClose={() => setLogsFor(null)} />}
    </PageShell>
  );
}

function LaunchModal({ onClose, onLaunched }: { onClose: () => void; onLaunched: () => void }) {
  const [agentType, setAgentType] = useState('opencode');
  const [prompt, setPrompt] = useState('');
  const [serverId, setServerId] = useState<string>('');
  const [maxRuntime, setMaxRuntime] = useState('1800');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);

  useEffect(() => { listServers().then(setServers).catch(() => setServers([])); }, []);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await launchAgent({
        agent_type: agentType,
        prompt: prompt || undefined,
        server_id: serverId ? Number(serverId) : null,
        max_runtime: Number(maxRuntime) || 1800,
      });
      toast.success(`Launched ${agentType} agent (run #${res.id})`);
      onLaunched();
    } catch (e) { setBusy(false); setErr(e instanceof Error ? e.message : 'Launch failed'); }
  };

  return (
    <Modal title="Launch agent" icon={<Rocket size={16} className="text-indigo-400" />} onClose={onClose}>
      <Field label="Agent type">
        <select value={agentType} onChange={(e) => setAgentType(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle}>
          {AGENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Target server (optional)">
        <select value={serverId} onChange={(e) => setServerId(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle}>
          <option value="">— none —</option>
          {servers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
        </select>
      </Field>
      <Field label="Prompt / task">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5}
          placeholder="Describe what the agent should do…" className="w-full text-sm px-3 py-2 rounded-lg resize-y" style={inputStyle} />
      </Field>
      <Field label="Max runtime (seconds)">
        <input value={maxRuntime} onChange={(e) => setMaxRuntime(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} />
      </Field>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Launch
        </button>
      </ModalActions>
    </Modal>
  );
}

// Streams agent logs live over the Oz WebSocket (/api/agents/ws/{id}), seeded
// with the historical lines from the REST endpoint. Falls back gracefully if
// the socket can't connect.
function useLiveLogs(agentId: number) {
  const [logs, setLogs] = useState<AgentLogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLogs([]); setErr(null);

    // 1) Seed with history.
    getAgentLogs(agentId).then((h) => { if (alive) setLogs(h); }).catch((e) => alive && setErr(e.message));

    // 2) Live tail via WebSocket (same gateway origin; OZ_API_BASE is a path).
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}${OZ_API_BASE}/agents/ws/${agentId}`;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        if (!alive) return;
        setConnected(true);
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 25000);
      };
      ws.onmessage = (e) => {
        if (!alive || e.data === 'pong') return;
        try {
          const d = JSON.parse(e.data);
          if (d && typeof d.content === 'string') setLogs((l) => [...l, d as AgentLogLine]);
        } catch { /* ignore non-JSON keepalive frames */ }
      };
      ws.onclose = () => alive && setConnected(false);
      ws.onerror = () => alive && setConnected(false);
    } catch { /* WS unsupported — history still shows */ }

    return () => { alive = false; if (ping) clearInterval(ping); ws?.close(); };
  }, [agentId]);

  return { logs, connected, err };
}

function LogsModal({ agentId, onClose }: { agentId: number; onClose: () => void }) {
  const { logs, connected, err } = useLiveLogs(agentId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [logs]);

  const liveBadge = (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ml-2 px-2 py-0.5 rounded-full"
      style={connected
        ? { background: 'rgba(52,211,153,0.14)', color: '#34d399', border: '1px solid rgba(52,211,153,0.35)' }
        : { background: 'rgba(148,163,184,0.14)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? '#34d399' : '#94a3b8', boxShadow: connected ? '0 0 6px #34d399' : 'none' }} />
      {connected ? 'live' : 'offline'}
    </span>
  );

  return (
    <Modal title={`Agent #${agentId} logs`} icon={<ScrollText size={16} className="text-sky-400" />} onClose={onClose} wide titleExtra={liveBadge}>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      {/* Console stays dark in both themes by design (terminal aesthetic). */}
      <div className="font-mono text-[11px] leading-relaxed rounded-lg p-3 h-[55vh] overflow-y-auto"
        style={{ background: '#0a0e17', color: '#cbd5e1', border: '1px solid var(--border)' }}>
        {logs.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Waiting for output…</span>
          : logs.map((l, i) => (
            <div key={i} className={l.stream === 'stderr' ? 'text-red-300' : ''}>
              <span className="text-slate-600">{new Date(l.timestamp).toLocaleTimeString()} </span>{l.content}
            </div>
          ))}
        <div ref={endRef} />
      </div>
    </Modal>
  );
}

// ── small modal primitives (local to ops) ───────────────────────────────────
export function Modal({ title, icon, onClose, children, wide, titleExtra }: {
  title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean; titleExtra?: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'var(--bg-overlay)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl overflow-hidden shadow-2xl`}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">{icon}<h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>{titleExtra}</div>
          <button onClick={onClose} aria-label="Close dialog" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}
export function ModalActions({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-input)' }}>Cancel</button>
      {children}
    </div>
  );
}

// Re-export for sibling pages.
export { Bot };

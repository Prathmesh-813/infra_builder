// Global system-health indicator + dropdown, mounted in the nav rail next to
// Sign Out. Reads from the shared health store (a single poll started in App)
// and shows a summary plus a per-integration breakdown (DB, Redis, Docker, Leon,
// Cloudflare, AI providers, cloud pricing, billing…).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { overallStatus, type HealthComponent, type CompStatus } from '../utils/healthClient';
import { useHealthStore } from '../store/healthStore';

const DOT: Record<CompStatus, string> = {
  ok: '#34d399', degraded: '#fbbf24', down: '#f87171', unconfigured: '#64748b',
};

const OVERALL = {
  ok:       { color: '#34d399', label: 'All systems operational', Icon: CheckCircle2 },
  degraded: { color: '#fbbf24', label: 'Partial degradation',     Icon: AlertTriangle },
  down:     { color: '#f87171', label: 'Issues detected',          Icon: XCircle },
} as const;

export default function SystemHealthMenu({ expanded = false }: { expanded?: boolean }) {
  const components = useHealthStore((s) => s.components);
  const loading = useHealthStore((s) => s.loading);
  const refresh = useHealthStore((s) => s.refresh);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The nav rail is a scroll container with `overflow-x-hidden`, which would clip
  // an in-flow `absolute` flyout. Render the panel in a portal with fixed coords
  // (anchored to the right of the button) so it escapes that clipping entirely.
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.right + 12, bottom: window.innerHeight - r.bottom });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const status = components && components.length ? overallStatus(components) : 'ok';
  const o = OVERALL[status];
  const issues = components?.filter((c) => c.status === 'down' || c.status === 'degraded').length ?? 0;

  const groups = useMemo(() => {
    const g: Record<string, HealthComponent[]> = {};
    (components || []).forEach((c) => { (g[c.category] ||= []).push(c); });
    return g;
  }, [components]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => { setOpen((v) => !v); if (!open) refresh(); }}
        title="System health" aria-label={`System health: ${o.label}`}
        className={`relative flex items-center rounded-xl h-11 transition-all duration-200 ${expanded ? 'w-[200px] px-3 gap-3 justify-start' : 'w-11 justify-center hover:scale-110'}`}
        style={{ color: o.color, border: '1px solid transparent' }}
      >
        <Activity size={17} className="shrink-0" />
        {expanded && (
          <span className="text-xs font-semibold flex-1 text-left truncate" style={{ color: 'var(--text-secondary)' }}>
            System health
          </span>
        )}
        <span
          className={expanded ? 'w-2 h-2 rounded-full shrink-0' : 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full'}
          style={{ background: o.color, boxShadow: `0 0 6px ${o.color}` }} />
      </button>

      {open && pos && createPortal(
        <div ref={menuRef} className="fixed w-[340px] rounded-2xl overflow-hidden z-[9999] shadow-2xl"
          style={{ left: pos.left, bottom: pos.bottom, background: 'var(--bg-surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
          {/* Summary header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <o.Icon size={18} style={{ color: o.color }} />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{o.label}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {issues > 0 ? `${issues} component${issues > 1 ? 's' : ''} need attention` : 'Live status across all services'}
                </p>
              </div>
            </div>
            <button onClick={() => refresh()} aria-label="Refresh" className="shrink-0 p-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)' }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Per-integration breakdown */}
          <div className="max-h-[58vh] overflow-y-auto py-1.5">
            {!components ? (
              <p className="text-xs px-4 py-6 text-center" style={{ color: 'var(--text-muted)' }}>Checking services…</p>
            ) : (
              Object.entries(groups).map(([cat, items]) => (
                <div key={cat} className="px-2 py-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--text-faint)' }}>{cat}</p>
                  {items.map((c) => (
                    <div key={c.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: DOT[c.status], boxShadow: `0 0 5px ${DOT[c.status]}66` }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{c.message}</p>
                      </div>
                      <span className="text-[9px] font-bold uppercase shrink-0 text-right" style={{ color: DOT[c.status] }}>
                        {c.status === 'unconfigured' ? 'n/a' : c.status}
                        {c.status === 'ok' && c.latency_ms != null ? ` · ${c.latency_ms}ms` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

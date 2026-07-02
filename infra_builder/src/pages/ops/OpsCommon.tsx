// Shared building blocks for the Operations (Oz) pages so they share one look,
// one loading/error pattern, and one set of formatting helpers.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import type { AgentStatus } from '../../utils/ozClient';
import { useTheme } from '../../context/ThemeContext';

export function PageShell({
  title, subtitle, actions, children,
}: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
  );
}

// Each status has an RGB tint plus a dark- and light-theme foreground so the
// badge stays legible in both themes (saturated-light text is unreadable on the
// light-mode near-white background).
type ColorSpec = { tint: string; dark: string; light: string };
const STATUS_COLORS: Record<string, ColorSpec> = {
  pending:   { tint: '148,163,184', dark: '#cbd5e1', light: '#475569' },
  running:   { tint: '56,189,248',  dark: '#7dd3fc', light: '#0369a1' },
  completed: { tint: '52,211,153',  dark: '#6ee7b7', light: '#047857' },
  failed:    { tint: '248,113,113', dark: '#fca5a5', light: '#b91c1c' },
  cancelled: { tint: '251,146,60',  dark: '#fdba74', light: '#c2410c' },
  paused:    { tint: '167,139,250', dark: '#c4b5fd', light: '#6d28d9' },
};

function pill(spec: ColorSpec, isDark: boolean) {
  return {
    background: `rgba(${spec.tint},${isDark ? 0.14 : 0.12})`,
    color: isDark ? spec.dark : spec.light,
    border: `1px solid rgba(${spec.tint},${isDark ? 0.35 : 0.3})`,
  };
}

export function StatusBadge({ status }: { status: AgentStatus | string }) {
  const { isDark } = useTheme();
  const spec = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={pill(spec, isDark)}>
      {status === 'running' && <Loader2 size={9} className="animate-spin" />}
      {status}
    </span>
  );
}

// Theme-aware colored tag (for server tags, schedule active/paused, etc.).
const TAG_TINTS: Record<string, ColorSpec> = {
  gray:   STATUS_COLORS.pending,
  green:  STATUS_COLORS.completed,
  cyan:   STATUS_COLORS.running,
  amber:  { tint: '245,158,11', dark: '#fcd34d', light: '#b45309' },
  violet: STATUS_COLORS.paused,
};
export function Tag({ color = 'gray', children }: { color?: keyof typeof TAG_TINTS; children: ReactNode }) {
  const { isDark } = useTheme();
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full" style={pill(TAG_TINTS[color], isDark)}>
      {children}
    </span>
  );
}

// Compact metric card for the Operations overview.
export function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl px-4 py-3 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-extrabold mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}

export function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--text-muted)' }}>
      <Loader2 size={18} className="animate-spin" /> <span className="text-sm">{label || 'Loading…'}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertCircle size={28} className="text-red-400" />
      <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}>
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center" style={{ color: 'var(--text-muted)' }}>
      <Inbox size={26} /> <p className="text-sm">{message}</p>
    </div>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={onClick} title="Refresh"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{ border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}>
      <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Refresh
    </button>
  );
}

// Minimal data-loading hook with manual reload.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, reload: run, setData };
}

// Shared input styling.
export const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  color: 'var(--text-primary)',
} as const;

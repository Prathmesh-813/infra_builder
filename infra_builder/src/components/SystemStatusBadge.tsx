// Inline live status badge for the canvas header — reflects the same aggregated
// system health as the nav dropdown (shared store). Replaces the old static
// "All systems ready" pill.
import { overallStatus } from '../utils/healthClient';
import { useHealthStore } from '../store/healthStore';

const MAP = {
  ok:       { color: '#10b981', label: 'All systems operational' },
  degraded: { color: '#f59e0b', label: 'Partial degradation' },
  down:     { color: '#ef4444', label: 'Issues detected' },
} as const;

export default function SystemStatusBadge() {
  const components = useHealthStore((s) => s.components);
  const status = components && components.length ? overallStatus(components) : 'ok';
  const m = MAP[status];
  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      title={m.label}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color, animation: 'pulse-soft 2s ease-in-out infinite' }} />
      {components ? m.label : 'Checking systems…'}
    </div>
  );
}

import { Loader, Zap, AlertCircle, Database } from 'lucide-react';
import type { PriceSource } from '../utils/awsPricingClient';

interface LivePriceBadgeProps {
  source: PriceSource | 'static';
  loading?: boolean;
  price?: number;
  compact?: boolean;
}

const SOURCE_META: Record<PriceSource | 'static', { label: string; color: string; bg: string; border: string }> = {
  live:       { label: 'Live',       color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  infracost:  { label: 'Infracost',  color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  fallback:   { label: 'Estimated',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  static:     { label: 'Static',     color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.2)' },
};

export default function LivePriceBadge({ source, loading, price, compact }: LivePriceBadgeProps) {
  const meta = SOURCE_META[source] ?? SOURCE_META.static;

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Loader size={8} className="animate-spin" />
        {!compact && 'Fetching…'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
      {source === 'live'      && <Zap size={8} />}
      {source === 'infracost' && <Database size={8} />}
      {source === 'fallback'  && <AlertCircle size={8} />}
      {!compact && meta.label}
      {compact && price !== undefined && `$${price.toFixed(0)}/mo`}
    </span>
  );
}

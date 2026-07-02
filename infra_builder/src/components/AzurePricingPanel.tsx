import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader, Cloud, Zap } from 'lucide-react';
import { isAzurePricingAvailable } from '../utils/azurePricingClient';

interface AzurePricingPanelProps {
  onAvailabilityChange?: (available: boolean) => void;
}

export default function AzurePricingPanel({ onAvailabilityChange }: AzurePricingPanelProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      const ok = await isAzurePricingAvailable();
      if (!cancelled) {
        setAvailable(ok);
        setChecking(false);
        onAvailabilityChange?.(ok);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{
        background: available ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)',
        borderColor: available ? 'rgba(59,130,246,0.3)' : 'var(--border)',
        marginBottom: 8,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: available ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${available ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
          }}
        >
          <Cloud size={15} style={{ color: available ? '#60a5fa' : 'var(--text-muted)' }} />
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: available ? '#60a5fa' : 'var(--text-secondary)' }}>
              Azure Live Pricing
            </span>
            {checking && <Loader size={11} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
            {!checking && available && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                CONNECTED
              </span>
            )}
            {!checking && !available && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                OFFLINE
              </span>
            )}
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {checking ? 'Checking Azure Retail Prices API...' :
             available ? 'Public API connected — no credentials required' :
             'Backend unavailable — using estimated pricing'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!checking && available && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
              <Zap size={9} /> LIVE
            </span>
          )}
          {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> :
                   <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="space-y-3">
            {/* Status details */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {available ? (
                <CheckCircle size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-[10px] font-semibold" style={{ color: available ? '#60a5fa' : '#ef4444' }}>
                  Azure Retail Prices API
                </p>
                <p className="text-[9px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {available
                    ? 'Azure provides a public, free Retail Prices API. No credentials or Azure subscription needed. Live pricing is available for Virtual Machines and Managed Kubernetes.'
                    : 'The backend server is not reachable. Start the backend with `uvicorn backend.main:app --reload --port 8001` to enable live Azure pricing.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

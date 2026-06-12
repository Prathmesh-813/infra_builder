import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Trash2, Trophy } from 'lucide-react';
import { CostCompareNodeData } from '../types/resources';
import { useStore } from '../store/useStore';
import { getServiceById } from '../utils/costComparisonEngine';
import ProviderIcon from './ProviderIcon';

function CostCompareNode({ data, id, selected }: NodeProps<CostCompareNodeData>) {
  const { deleteNode, setSelectedNode } = useStore();
  const service = getServiceById(data.serviceId);

  if (!service) return null;

  const providerLabels: Record<string, { icon: string; color: string }> = {
    aws:    { icon: 'aws', color: '#fb923c' },
    azure:  { icon: 'azure', color: '#60a5fa' },
    gcp:    { icon: 'gcp', color: '#f87171' },
    onprem: { icon: 'onprem', color: '#a78bfa' },
  };

  const estimates = service.providers.map(p => {
    const cfg = data.providerConfigs?.[p.provider] || {};
    const est = p.estimate(cfg);
    return { ...p, ...est };
  });

  const bestAvg = Math.min(...estimates.map(e => (e.min + e.max) / 2));
  const worstAvg = Math.max(...estimates.map(e => (e.min + e.max) / 2));
  const savings = worstAvg > 0 ? Math.round((1 - bestAvg / worstAvg) * 100) : 0;

  return (
    <div
      className="relative rounded-2xl cursor-pointer select-none transition-all duration-200"
      style={{
        minWidth: 280,
        background: '#0f172a',
        border: selected
          ? '2px solid rgba(168,85,247,0.9)'
          : '1px solid rgba(255,255,255,0.1)',
        boxShadow: selected
          ? '0 0 0 3px rgba(168,85,247,0.2), 0 8px 32px rgba(0,0,0,0.5)'
          : '0 4px 20px rgba(0,0,0,0.4)',
      }}
      onClick={() => setSelectedNode(id)}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-purple-500 to-violet-500" />

      <div className="px-4 pt-4 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl leading-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {data.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] leading-tight text-purple-300 truncate">
                {data.serviceName}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 truncate capitalize">
                {data.category} · Cost Comparison
              </div>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 flex-shrink-0"
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Provider pricing grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {estimates.map(e => {
            const meta = providerLabels[e.provider] || { icon: '?', color: '#888' };
            const avg = (e.min + e.max) / 2;
            const isBest = avg === bestAvg;
            return (
              <div
                key={e.provider}
                className="rounded-lg px-2.5 py-2 border"
                style={{
                  background: isBest ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  borderColor: isBest ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <ProviderIcon provider={meta.icon as any} size={14} />
                  <span className="text-[9px] font-semibold text-gray-300">{e.providerLabel}</span>
                  {isBest && <Trophy size={8} className="text-emerald-400" />}
                </div>
                <div className="text-[11px] font-bold text-white">
                  ${e.min === e.max ? e.min.toFixed(0) : `${e.min.toFixed(0)}-${e.max.toFixed(0)}`}
                  <span className="text-[8px] text-gray-500 font-normal">/mo</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Savings bar */}
        <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-emerald-300 font-semibold">
              Save ~{savings}% vs most expensive
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${Math.min(100, savings)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(CostCompareNode);
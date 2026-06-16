import { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Zap, Info, ChevronDown, ChevronUp,
  ArrowRight, BarChart3, Cpu, MemoryStick as Memory, Activity, RefreshCw,
  CheckCircle2, DollarSign, Sparkles,
} from 'lucide-react';
import {
  OPTIMIZATION_SERVICES,
  getInstanceByType,
} from '../data/optimizationData';
import {
  generateRecommendation,
  Recommendation,
  ResourceMetrics,
  getAllOptimizationServices,
} from '../utils/optimizationEngine';
import ProviderIcon from './ProviderIcon';

interface AddedResource {
  uid: string;
  serviceId: string;
  instanceType: string;
  metrics: ResourceMetrics;
}

const DEMO_SCENARIOS: AddedResource[] = [
  // 1. Upgrade: high CPU on AWS EC2 t3.medium → t3.large
  { uid: 'demo_1', serviceId: 'aws-ec2', instanceType: 't3.medium', metrics: { cpu: 95, memory: 62, network: 45 } },
  // 2. Downgrade: over-provisioned AWS EC2 t3.xlarge with low CPU → t3.large (saves $90/mo)
  { uid: 'demo_2', serviceId: 'aws-ec2', instanceType: 't3.xlarge', metrics: { cpu: 4, memory: 8, network: 3 } },
  // 3. Optimized: AWS EC2 m5.large with moderate utilization — no change needed
  { uid: 'demo_3', serviceId: 'aws-ec2', instanceType: 'm5.large', metrics: { cpu: 45, memory: 55, network: 30 } },
  // 4. Upgrade: high memory on Azure B4ms → B8ms
  { uid: 'demo_4', serviceId: 'azure-vm', instanceType: 'Standard_B4ms', metrics: { cpu: 35, memory: 93, network: 20 } },
  // 5. Downgrade: GCP e2-standard-8 with very low utilization → e2-standard-4 (saves $97/mo)
  { uid: 'demo_5', serviceId: 'gcp-vm', instanceType: 'e2-standard-8', metrics: { cpu: 5, memory: 7, network: 2 } },
  // 6. Upgrade: high CPU on Azure D8s_v3 → D16s_v3
  { uid: 'demo_6', serviceId: 'azure-vm', instanceType: 'Standard_D8s_v3', metrics: { cpu: 92, memory: 40, network: 60 } },
  // 7. Downgrade: over-provisioned RDS db.t3.large → db.t3.medium (saves $60/mo)
  { uid: 'demo_7', serviceId: 'aws-rds', instanceType: 'db.t3.large', metrics: { cpu: 6, memory: 12, io: 4 } },
  // 8. Optimized: GCP n2-standard-4 with balanced utilization
  { uid: 'demo_8', serviceId: 'gcp-vm', instanceType: 'n2-standard-4', metrics: { cpu: 48, memory: 52, network: 35 } },
];

const sliderTrackStyle = `
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.06);
    outline: none;
    transition: background 0.2s;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid;
    background: var(--bg-app);
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid;
    background: var(--bg-app);
  }
  input[type="range"].slider-cpu::-webkit-slider-thumb { border-color: #f97316; box-shadow: 0 0 12px rgba(249,115,22,0.3); }
  input[type="range"].slider-memory::-webkit-slider-thumb { border-color: #3b82f6; box-shadow: 0 0 12px rgba(59,130,246,0.3); }
  input[type="range"].slider-network::-webkit-slider-thumb { border-color: #a855f7; box-shadow: 0 0 12px rgba(168,85,247,0.3); }
`;

function PresetUtilization({ metrics, onChange }: {
  metrics: ResourceMetrics;
  onChange: (m: ResourceMetrics) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <style>{sliderTrackStyle}</style>
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
        <label className="text-[10px] font-semibold flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-secondary)' }}>
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)' }}>
            <Cpu size={10} style={{ color: '#f97316' }} />
          </div>
          CPU Utilization
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={metrics.cpu}
            onChange={e => onChange({ ...metrics, cpu: Number(e.target.value) })}
            className="flex-1 slider-cpu" />
          <span className="text-xs font-bold w-10 text-right px-1.5 py-0.5 rounded-md"
            style={{
              background: metrics.cpu >= 90 ? 'rgba(239,68,68,0.12)' : metrics.cpu <= 10 ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
              color: metrics.cpu >= 90 ? '#ef4444' : metrics.cpu <= 10 ? '#34d399' : 'var(--text-primary)',
            }}>
            {metrics.cpu}%
          </span>
        </div>
      </div>
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
        <label className="text-[10px] font-semibold flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-secondary)' }}>
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <Memory size={10} style={{ color: '#3b82f6' }} />
          </div>
          Memory Utilization
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={metrics.memory}
            onChange={e => onChange({ ...metrics, memory: Number(e.target.value) })}
            className="flex-1 slider-memory" />
          <span className="text-xs font-bold w-10 text-right px-1.5 py-0.5 rounded-md"
            style={{
              background: metrics.memory >= 90 ? 'rgba(239,68,68,0.12)' : metrics.memory <= 10 ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
              color: metrics.memory >= 90 ? '#ef4444' : metrics.memory <= 10 ? '#34d399' : 'var(--text-primary)',
            }}>
            {metrics.memory}%
          </span>
        </div>
      </div>
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
        <label className="text-[10px] font-semibold flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-secondary)' }}>
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <Activity size={10} style={{ color: '#a855f7' }} />
          </div>
          Network Utilization
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={metrics.network ?? 50}
            onChange={e => onChange({ ...metrics, network: Number(e.target.value) })}
            className="flex-1 slider-network" />
          <span className="text-xs font-bold w-10 text-right px-1.5 py-0.5 rounded-md"
            style={{
              background: (metrics.network ?? 50) >= 90 ? 'rgba(239,68,68,0.12)' : (metrics.network ?? 50) <= 5 ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
              color: (metrics.network ?? 50) >= 90 ? '#ef4444' : (metrics.network ?? 50) <= 5 ? '#34d399' : 'var(--text-primary)',
            }}>
            {metrics.network ?? 50}%
          </span>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec, onRemove }: { rec: Recommendation; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const isUpgrade = rec.action === 'upgrade';
  const isDowngrade = rec.action === 'downgrade';
  const isNone = rec.action === 'none';

  const actionColor = isUpgrade ? '#ef4444' : isDowngrade ? '#34d399' : '#94a3b8';
  const ActionIcon = isUpgrade ? TrendingUp : isDowngrade ? TrendingDown : Minus;
  const actionLabel = isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Optimized';
  const annualSavings = rec.savings * 12;
  const performanceChange = isUpgrade
    ? `+${Math.round((rec.vcpuRecommended / rec.vcpuCurrent - 1) * 100)}%`
    : isDowngrade
      ? `-${Math.round((1 - rec.vcpuRecommended / rec.vcpuCurrent) * 100)}%`
      : null;

  return (
    <div className="rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.005]"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderColor: isNone ? 'var(--border)' : actionColor + '35',
        boxShadow: isNone
          ? '0 4px 24px rgba(0,0,0,0.15)'
          : `0 4px 24px rgba(0,0,0,0.15), 0 0 40px ${actionColor}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
      {/* Top gradient accent line */}
      {!isNone && (
        <div className="h-[2px] w-full" style={{
          background: isUpgrade
            ? 'linear-gradient(90deg, #ef4444, #f97316, #f59e0b)'
            : 'linear-gradient(90deg, #34d399, #10b981, #059669)',
        }} />
      )}
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${rec.bgColor}, rgba(255,255,255,0.02))`,
            border: '1px solid ' + rec.color + '40',
            boxShadow: `0 0 16px ${rec.color}15`,
          }}>
          <div className="absolute inset-0 opacity-20"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
              animation: 'shimmer-sweep 4s ease-in-out infinite',
            }} />
          <span className="relative z-10">{rec.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{rec.serviceName}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: rec.bgColor, color: rec.color, border: '1px solid ' + rec.color + '30' }}>
              {rec.providerLabel}
            </span>
            {!isNone && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5"
                style={{
                  background: actionColor + '18',
                  color: actionColor,
                  border: '1px solid ' + actionColor + '30',
                  boxShadow: `0 0 8px ${actionColor}10`,
                }}>
                <ActionIcon size={10} />
                {actionLabel}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {rec.currentInstance} <span className="text-[10px] mx-1 opacity-50">in</span> {rec.currentFamily} family
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDowngrade && rec.savings > 0 && (
            <div className="text-right px-2 py-1 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
              <p className="text-xs font-extrabold" style={{ color: '#34d399' }}>${rec.savings.toFixed(0)}<span className="text-[9px] font-normal">/mo</span></p>
              <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>-{rec.savingsPct}%</p>
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-red-500/15 hover:scale-110">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</span>
          </button>
          <div className="w-6 flex items-center justify-center">
            {expanded
              ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-4 space-y-4">
          {/* Current vs Recommended comparison */}
          <div className="grid grid-cols-12 gap-4 items-center">
            {/* Current */}
            <div className="col-span-5 rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: '1px solid var(--border-subtle)',
                backdropFilter: 'blur(4px)',
              }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
                <Minus size={10} />
                Current Configuration
              </p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{rec.currentInstance}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{rec.vcpuCurrent} vCPU &middot; {rec.memoryCurrent} GB RAM</p>
              <p className="text-lg font-bold mt-2" style={{ color: isUpgrade ? '#ef4444' : 'var(--text-primary)' }}>
                ${rec.currentCost.toFixed(0)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
              </p>
            </div>

            {/* Arrow */}
            <div className="col-span-2 flex flex-col items-center gap-1.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${actionColor}20, ${actionColor}08)`,
                  border: '1px solid ' + actionColor + '30',
                  boxShadow: `0 0 16px ${actionColor}10`,
                }}>
                <ArrowRight size={16} className={isNone ? 'opacity-30' : ''} style={{ color: actionColor }} />
              </div>
              {isDowngrade && rec.savings > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                  -${rec.savings.toFixed(0)}/mo
                </span>
              )}
              {isUpgrade && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                  +${rec.savings.toFixed(0)}/mo
                </span>
              )}
            </div>

            {/* Recommended */}
            <div className="col-span-5 rounded-xl p-4 relative overflow-hidden"
              style={{
                background: isUpgrade
                  ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))'
                  : isDowngrade
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: `1px solid ${isNone ? 'var(--border-subtle)' : actionColor + '35'}`,
                boxShadow: isNone ? 'none' : `0 0 24px ${actionColor}08`,
                backdropFilter: 'blur(4px)',
              }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: actionColor }}>
                <CheckCircle2 size={10} />
                Recommended Configuration
              </p>
              <p className="text-lg font-bold" style={{ color: isNone ? 'var(--text-primary)' : actionColor }}>{rec.recommendedInstance}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{rec.vcpuRecommended} vCPU &middot; {rec.memoryRecommended} GB RAM</p>
              <p className="text-lg font-bold mt-2" style={{ color: isUpgrade ? '#f59e0b' : isDowngrade ? '#34d399' : 'var(--text-primary)' }}>
                ${rec.recommendedCost.toFixed(0)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
              </p>
            </div>
          </div>

          {/* Specs comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-3" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              border: '1px solid var(--border-subtle)',
            }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                  <Cpu size={10} /> vCPUs
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{rec.vcpuCurrent} → {rec.vcpuRecommended}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${Math.min(100, (Math.max(rec.vcpuRecommended, rec.vcpuCurrent) / Math.max(rec.vcpuCurrent, rec.vcpuRecommended, 1)) * 100)}%`,
                  background: isUpgrade
                    ? 'linear-gradient(90deg, #ef4444, #f97316, #f59e0b)'
                    : 'linear-gradient(90deg, #34d399, #10b981)',
                  boxShadow: isUpgrade ? '0 0 8px rgba(249,115,22,0.3)' : '0 0 8px rgba(52,211,153,0.3)',
                }} />
              </div>
            </div>
            <div className="rounded-xl p-3" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              border: '1px solid var(--border-subtle)',
            }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                  <Memory size={10} /> Memory (GB)
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{rec.memoryCurrent} → {rec.memoryRecommended}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${Math.min(100, (Math.max(rec.memoryRecommended, rec.memoryCurrent) / Math.max(rec.memoryCurrent, rec.memoryRecommended, 1)) * 100)}%`,
                  background: isUpgrade
                    ? 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)'
                    : 'linear-gradient(90deg, #34d399, #10b981)',
                  boxShadow: isUpgrade ? '0 0 8px rgba(99,102,241,0.3)' : '0 0 8px rgba(52,211,153,0.3)',
                }} />
              </div>
            </div>
          </div>

          {/* Performance & Cost Impact */}
          <div className="grid grid-cols-2 gap-3">
            {performanceChange && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${actionColor}10, ${actionColor}04)`,
                  border: `1px solid ${actionColor}20`,
                  backdropFilter: 'blur(4px)',
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${actionColor}15`, border: `1px solid ${actionColor}25` }}>
                  <Zap size={14} style={{ color: actionColor }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold" style={{ color: actionColor }}>Performance Impact</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {isUpgrade ? `Boost capacity by ` : `Reduce capacity by `}
                    <span className="font-bold" style={{ color: actionColor }}>{performanceChange}</span>
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{
                background: isDowngrade
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.03))'
                  : isUpgrade
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))'
                    : 'linear-gradient(135deg, rgba(148,163,184,0.08), rgba(148,163,184,0.02))',
                border: `1px solid ${isNone ? 'var(--border-subtle)' : (isDowngrade ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)')}`,
                backdropFilter: 'blur(4px)',
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isDowngrade ? 'rgba(16,185,129,0.15)' : isUpgrade ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                  border: `1px solid ${isNone ? 'var(--border-subtle)' : (isDowngrade ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)')}`,
                }}>
                <DollarSign size={14} className={isDowngrade ? 'text-emerald-400' : isUpgrade ? 'text-amber-400' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-[10px] font-bold" style={{ color: isDowngrade ? '#34d399' : isUpgrade ? '#f59e0b' : '#94a3b8' }}>
                  {isDowngrade ? 'Cost Savings' : isUpgrade ? 'Additional Cost' : 'Cost Impact'}
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {isDowngrade
                    ? <>Save <span className="font-bold text-emerald-400">${rec.savings.toFixed(0)}/mo</span> · ${annualSavings.toFixed(0)}/year</>
                    : isUpgrade
                      ? <><span className="font-bold text-amber-400">${rec.savings.toFixed(0)}/mo</span> additional for improved performance</>
                      : 'Current configuration is optimal'}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${actionColor}08, ${actionColor}02)`,
              border: `1px solid ${isNone ? 'var(--border-subtle)' : actionColor + '15'}`,
              backdropFilter: 'blur(4px)',
            }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${actionColor}12`, border: `1px solid ${actionColor}20` }}>
              <Info size={14} style={{ color: actionColor }} />
            </div>
            <div className="flex-1">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{rec.reason}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${actionColor}12`, color: actionColor }}>
                  Trigger: {rec.metric === 'cpu' ? 'CPU' : rec.metric === 'memory' ? 'Memory' : rec.metric} at {rec.metricValue}%
                </span>
              </div>
            </div>
          </div>

          {/* Apply button */}
          {!isNone && (
            <button
              className="w-full flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] relative overflow-hidden group"
              style={{
                background: isDowngrade
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.06))'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.06))',
                color: isDowngrade ? '#34d399' : '#f59e0b',
                border: `1px solid ${isDowngrade ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: isDowngrade
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.1), transparent)'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.1), transparent)',
                }} />
              <CheckCircle2 size={13} className="relative z-10" />
              <span className="relative z-10">Apply {actionLabel} Recommendation</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function OptimizationPanel() {
  const [addedResources, setAddedResources] = useState<AddedResource[]>([]);
  const [selectedService, setSelectedService] = useState<string>('aws-ec2');
  const [selectedInstance, setSelectedInstance] = useState<string>('t3.medium');
  const [metrics, setMetrics] = useState<ResourceMetrics>({ cpu: 75, memory: 45, network: 30 });

  const service = OPTIMIZATION_SERVICES.find(s => s.id === selectedService);
  const families = service?.families ?? [];
  const instances = families.flatMap(f => f.instances.map(i => i.current));

  const handleAddResource = useCallback(() => {
    setAddedResources(prev => [...prev, {
      uid: `opt_${Date.now()}`,
      serviceId: selectedService,
      instanceType: selectedInstance,
      metrics: { ...metrics },
    }]);
  }, [selectedService, selectedInstance, metrics]);

  const handleRemove = useCallback((uid: string) => {
    setAddedResources(prev => prev.filter(r => r.uid !== uid));
  }, []);

  const recommendations: Recommendation[] = addedResources.map(r =>
    generateRecommendation(r.uid, r.serviceId, r.instanceType, r.metrics)
  ).filter((r): r is Recommendation => r !== null);

  const totalSavings = useMemo(() =>
    recommendations
      .filter(r => r.action === 'downgrade')
      .reduce((sum, r) => sum + r.savings, 0),
    [recommendations]
  );

  const upgradeCosts = useMemo(() =>
    recommendations
      .filter(r => r.action === 'upgrade')
      .reduce((sum, r) => sum + r.savings, 0),
    [recommendations]
  );

  const annualSavings = totalSavings * 12;
  const downgradeCount = recommendations.filter(r => r.action === 'downgrade').length;
  const upgradeCount = recommendations.filter(r => r.action === 'upgrade').length;
  const optimizedCount = recommendations.filter(r => r.action === 'none').length;

  return (
    <div style={{ background: 'var(--bg-app)' }}>
      {/* Config bar with glass effect */}
      <div className="px-4 pt-3 pb-3 space-y-3"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Service selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--text-faint)' }}>Cloud Service</label>
            <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer appearance-none"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
                backdropFilter: 'blur(4px)',
              }}>
              {getAllOptimizationServices().map(s => (
                <option key={s.id} value={s.id}>{s.providerLabel} — {s.serviceName}</option>
              ))}
            </select>
          </div>

          {/* Instance selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--text-faint)' }}>Current Instance</label>
            <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer appearance-none"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
                backdropFilter: 'blur(4px)',
              }}>
              {instances.map(inst => {
                const info = service ? getInstanceByType(service, inst) : null;
                return (
                  <option key={inst} value={inst}>
                    {inst} {info ? `(${info.instance.vcpu}vCPU, ${info.instance.memory}GB, $${info.instance.price}/mo)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button onClick={handleAddResource}
              className="px-5 py-2 text-xs font-semibold text-white rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
              }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                }} />
              <Sparkles size={12} className="inline mr-1.5 relative z-10" />
              <span className="relative z-10">Analyze Resource</span>
            </button>
            <button onClick={() => setAddedResources(DEMO_SCENARIOS)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                color: '#f97316',
                border: '1px solid rgba(249,115,22,0.3)',
                background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(245,158,11,0.05))',
                backdropFilter: 'blur(4px)',
              }}>
              <Zap size={11} /> Load Demo
            </button>
            {addedResources.length > 0 && (
              <button onClick={() => setAddedResources([])}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] hover:bg-red-500/5"
                style={{
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                <RefreshCw size={11} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Utilization sliders */}
        <div className="px-0.5">
          <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--text-faint)' }}>
            Simulated Utilization Metrics
          </p>
          <PresetUtilization metrics={metrics} onChange={setMetrics} />
        </div>
      </div>

      {/* Summary bar */}
      {recommendations.length > 0 && (
        <div className="px-5 py-3 border-b relative" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
          borderColor: 'var(--border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.04))', border: '1px solid rgba(239,68,68,0.2)' }}>
              <TrendingUp size={14} className="mx-auto mb-1" style={{ color: '#f87171' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>Upgrade</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: '#ef4444' }}>{upgradeCount}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>need more capacity</p>
            </div>
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))', border: '1px solid rgba(16,185,129,0.2)' }}>
              <TrendingDown size={14} className="mx-auto mb-1" style={{ color: '#34d399' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>Downgrade</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: '#34d399' }}>{downgradeCount}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>over-provisioned</p>
            </div>
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(148,163,184,0.1), rgba(148,163,184,0.04))', border: '1px solid rgba(148,163,184,0.2)' }}>
              <CheckCircle2 size={14} className="mx-auto mb-1" style={{ color: '#94a3b8' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Optimized</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: '#94a3b8' }}>{optimizedCount}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>right-sized</p>
            </div>
            <div className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{
                background: totalSavings > 0
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
                border: `1px solid ${totalSavings > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
              }}>
              <DollarSign size={14} className="mx-auto mb-1" style={{ color: totalSavings > 0 ? '#34d399' : '#f59e0b' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: totalSavings > 0 ? '#34d399' : '#f59e0b' }}>
                {totalSavings > 0 ? 'Savings' : 'Cost Impact'}
              </p>
              <p className="text-xl font-bold mt-0.5" style={{ color: totalSavings > 0 ? '#34d399' : '#f59e0b' }}>
                {totalSavings > 0 ? `$${totalSavings.toFixed(0)}` : `+$${upgradeCosts.toFixed(0)}`}
                <span className="text-xs font-normal opacity-70">/mo</span>
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                {totalSavings > 0 ? `$${annualSavings.toFixed(0)}/yr projected` : 'additional spend'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div>
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 300px)' }}>
            <div className="text-center px-8 max-w-md">

              {/* Animated gradient ring icon */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-3xl animate-pulse" style={{
                  background: 'conic-gradient(from 0deg, #f97316, #f59e0b, #a855f7, #6366f1, #f97316)',
                  animation: 'spin 4s linear infinite',
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))',
                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))',
                }} />
                <div className="absolute inset-2 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(168,85,247,0.08))',
                    border: '1px solid rgba(249,115,22,0.2)',
                    boxShadow: '0 0 40px rgba(249,115,22,0.12)',
                  }}>
                  <TrendingUp size={32} style={{ color: '#f97316' }} />
                </div>
              </div>

              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Compute <span className="gradient-text">Optimizer</span>
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Right-size your cloud resources across <strong style={{ color: 'var(--text-secondary)' }}>AWS, Azure, and GCP</strong>.
                Simulate utilization metrics to get intelligent upgrade/downgrade recommendations with cost impact analysis.
              </p>

              {/* Quick-start steps */}
              <div className="mt-6 space-y-2.5 text-left">
                {[
                  { step: 1, label: 'Select a cloud service and instance type' },
                  { step: 2, label: 'Adjust CPU, memory, and network sliders to simulate workload' },
                  { step: 3, label: 'Click "Analyze Resource" to generate recommendations' },
                ].map((s, idx) => (
                  <div key={s.step} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all hover:scale-[1.01]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                      border: '1px solid var(--border-subtle)',
                      animation: `fade-in 0.3s ease ${idx * 0.1}s forwards`,
                      opacity: 0,
                    }}>
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(245,158,11,0.1))',
                        color: '#f97316',
                        border: '1px solid rgba(249,115,22,0.25)',
                        boxShadow: '0 0 12px rgba(249,115,22,0.1)',
                      }}>
                      {s.step}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 mt-6">
                {[['AWS','aws'], ['Azure','azure'], ['GCP','gcp']].map(([label, provider], i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      animation: `fade-in 0.3s ease ${0.3 + i * 0.1}s forwards`,
                      opacity: 0,
                    }}>
                    <ProviderIcon provider={provider as any} size={18} /> {label}
                  </div>
                ))}
              </div>

              <button onClick={() => setAddedResources(DEMO_SCENARIOS)}
                className="mt-6 w-full px-4 py-3 text-xs font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(245,158,11,0.1))',
                  color: '#f97316',
                  border: '1px solid rgba(249,115,22,0.3)',
                  boxShadow: '0 4px 20px rgba(249,115,22,0.1)',
                }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(245,158,11,0.05))' }} />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
                    animation: 'shimmer-sweep 2s ease-in-out infinite',
                  }} />
                <Zap size={13} className="inline mr-1.5 relative z-10" />
                <span className="relative z-10">Load Demo Scenarios — See Optimizer in Action</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Savings callout */}
            {(totalSavings > 0 || upgradeCosts > 0) && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: totalSavings > 0
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.03))'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))',
                  border: `1px solid ${totalSavings > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}>
                {totalSavings > 0 ? (
                  <>
                    <DollarSign size={16} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#34d399' }}>
                        ${totalSavings.toFixed(0)}/mo potential savings found
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Downgrade {downgradeCount} over-provisioned resource{downgradeCount !== 1 ? 's' : ''} to save ${annualSavings.toFixed(0)} annually
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <BarChart3 size={16} className="text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                        +${upgradeCosts.toFixed(0)}/mo for improved performance
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {upgradeCount} resource{upgradeCount !== 1 ? 's' : ''} need{upgradeCount === 1 ? 's' : ''} more capacity — upgrade to prevent throttling
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Recommendation cards */}
            {recommendations.map((rec, idx) => (
              <div key={rec.uid}
                style={{
                  animation: `fade-in 0.4s ease ${idx * 0.08}s forwards`,
                  opacity: 0,
                }}>
                <RecommendationCard
                  rec={rec}
                  onRemove={() => handleRemove(rec.uid)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

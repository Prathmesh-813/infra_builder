import { useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Zap, Info, ChevronDown, ChevronUp,
  ArrowRight, BarChart3, Cpu, MemoryStick as Memory, Activity, RefreshCw,
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

function PresetUtilization({ metrics, onChange }: {
  metrics: ResourceMetrics;
  onChange: (m: ResourceMetrics) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div>
        <label className="text-[10px] font-semibold flex items-center gap-1 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Cpu size={10} /> CPU %
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={metrics.cpu}
            onChange={e => onChange({ ...metrics, cpu: Number(e.target.value) })}
            className="flex-1 accent-orange-500" />
          <span className="text-xs font-bold w-10 text-right"
            style={{ color: metrics.cpu >= 90 ? '#ef4444' : metrics.cpu <= 10 ? '#34d399' : 'var(--text-primary)' }}>
            {metrics.cpu}%
          </span>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold flex items-center gap-1 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Memory size={10} /> Memory %
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={metrics.memory}
            onChange={e => onChange({ ...metrics, memory: Number(e.target.value) })}
            className="flex-1 accent-blue-500" />
          <span className="text-xs font-bold w-10 text-right"
            style={{ color: metrics.memory >= 90 ? '#ef4444' : metrics.memory <= 10 ? '#34d399' : 'var(--text-primary)' }}>
            {metrics.memory}%
          </span>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold flex items-center gap-1 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Activity size={10} /> Network %
        </label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={metrics.network ?? 50}
            onChange={e => onChange({ ...metrics, network: Number(e.target.value) })}
            className="flex-1 accent-purple-500" />
          <span className="text-xs font-bold w-10 text-right"
            style={{ color: (metrics.network ?? 50) >= 90 ? '#ef4444' : (metrics.network ?? 50) <= 5 ? '#34d399' : 'var(--text-primary)' }}>
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
  const actionLabel = isUpgrade ? 'Upgrade Recommended' : isDowngrade ? 'Downgrade Recommended' : 'Optimized';

  return (
    <div className="rounded-2xl overflow-hidden border transition-all"
      style={{
        background: 'var(--bg-surface)',
        borderColor: isNone ? 'var(--border)' : actionColor + '40',
        boxShadow: isNone ? 'none' : `0 0 30px ${actionColor}08`,
      }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: rec.bgColor, border: '1px solid ' + rec.color + '40' }}>
          {rec.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{rec.serviceName}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: rec.bgColor, color: rec.color, border: '1px solid ' + rec.color + '30' }}>
              {rec.providerLabel}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {rec.currentInstance} <span className="text-[10px] mx-1 opacity-50">in</span> {rec.currentFamily} family
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: actionColor + '15', color: actionColor, border: '1px solid ' + actionColor + '30' }}>
            <ActionIcon size={12} /> {actionLabel}
          </span>
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/15">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</span>
          </button>
          <div className="w-6 flex items-center justify-center">
            {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-4 space-y-4">
          {/* Current vs Recommended comparison */}
          <div className="grid grid-cols-12 gap-4 items-center">
            {/* Current */}
            <div className="col-span-5 rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Current</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{rec.currentInstance}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{rec.vcpuCurrent} vCPU · {rec.memoryCurrent} GB RAM</p>
              <p className="text-lg font-bold mt-2" style={{ color: isUpgrade ? '#ef4444' : 'var(--text-primary)' }}>
                ${rec.currentCost.toFixed(0)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
              </p>
            </div>

            {/* Arrow */}
            <div className="col-span-2 flex flex-col items-center gap-1">
              <ArrowRight size={20} className={isNone ? 'opacity-30' : ''} style={{ color: actionColor }} />
              {isDowngrade && rec.savings > 0 && (
                <span className="text-[10px] font-bold text-emerald-400">Save ${rec.savings.toFixed(0)}/mo</span>
              )}
              {isUpgrade && (
                <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>+${rec.savings.toFixed(0)}/mo</span>
              )}
            </div>

            {/* Recommended */}
            <div className="col-span-5 rounded-xl p-4"
              style={{
                background: isUpgrade ? 'rgba(239,68,68,0.06)' : isDowngrade ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isNone ? 'var(--border-subtle)' : actionColor + '35'}`,
                boxShadow: isNone ? 'none' : `0 0 20px ${actionColor}08`,
              }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: actionColor }}>Recommended</p>
              <p className="text-lg font-bold" style={{ color: isNone ? 'var(--text-primary)' : actionColor }}>{rec.recommendedInstance}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{rec.vcpuRecommended} vCPU · {rec.memoryRecommended} GB RAM</p>
              <p className="text-lg font-bold mt-2" style={{ color: isUpgrade ? '#f59e0b' : isDowngrade ? '#34d399' : 'var(--text-primary)' }}>
                ${rec.recommendedCost.toFixed(0)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
              </p>
            </div>
          </div>

          {/* Specs comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>vCPUs</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{rec.vcpuCurrent} → {rec.vcpuRecommended}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, (rec.vcpuRecommended / Math.max(rec.vcpuRecommended, 1)) * 100)}%`,
                  background: isUpgrade ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #34d399, #10b981)',
                }} />
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>Memory (GB)</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{rec.memoryCurrent} → {rec.memoryRecommended}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, (rec.memoryRecommended / Math.max(rec.memoryRecommended, 1)) * 100)}%`,
                  background: isUpgrade ? 'linear-gradient(90deg, #3b82f6, #6366f1)' : 'linear-gradient(90deg, #34d399, #10b981)',
                }} />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{
              background: isUpgrade ? 'rgba(239,68,68,0.06)' : isDowngrade ? 'rgba(16,185,129,0.06)' : 'rgba(148,163,184,0.06)',
              border: `1px solid ${isNone ? 'var(--border-subtle)' : actionColor + '20'}`,
            }}>
            <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: actionColor }} />
            <div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{rec.reason}</p>
              <p className="text-[10px] mt-1.5 font-semibold" style={{ color: actionColor }}>
                {rec.metric === 'cpu' ? 'CPU' : rec.metric === 'memory' ? 'Memory' : rec.metric} utilization: {rec.metricValue}%
              </p>
            </div>
          </div>

          {/* Cost impact */}
          {!isNone && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: isDowngrade ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${isDowngrade ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              <Zap size={14} className={isDowngrade ? 'text-emerald-400' : 'text-amber-400'} />
              <p className="text-xs" style={{ color: isDowngrade ? '#34d399' : '#f59e0b' }}>
                {isDowngrade
                  ? <><span className="font-bold">Cost savings:</span> ${rec.savings.toFixed(0)}/month ({rec.savingsPct}% less than current)</>
                  : <><span className="font-bold">Cost increase:</span> ${rec.savings.toFixed(0)}/month additional for improved performance</>
                }
              </p>
            </div>
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
  const [metrics, setMetrics] = useState<ResourceMetrics>({ cpu: 95, memory: 45, network: 30 });

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
    generateRecommendation(r.serviceId, r.instanceType, r.metrics)
  ).filter((r): r is Recommendation => r !== null);

  const totalSavings = recommendations
    .filter(r => r.action === 'downgrade')
    .reduce((sum, r) => sum + r.savings, 0);

  const upgradeCosts = recommendations
    .filter(r => r.action === 'upgrade')
    .reduce((sum, r) => sum + r.savings, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-app)' }}>
      {/* Config bar */}
      <div className="px-4 pt-3 pb-3 flex-shrink-0 space-y-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Service selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--text-faint)' }}>Cloud Service</label>
            <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
              {getAllOptimizationServices().map(s => (
                <option key={s.id} value={s.id}>{s.providerLabel} — {s.serviceName}</option>
              ))}
            </select>
          </div>

          {/* Instance selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--text-faint)' }}>Current Instance</label>
            <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
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
              className="px-4 py-2 text-xs font-semibold text-white rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 16px rgba(109,40,217,0.4)' }}>
              + Analyze Resource
            </button>
            {addedResources.length > 0 && (
              <button onClick={() => setAddedResources([])}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
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
        <div className="px-5 py-3 border-b flex-shrink-0 grid grid-cols-3 gap-3"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>Upgrade</p>
            <p className="text-lg font-bold mt-1" style={{ color: '#ef4444' }}>{recommendations.filter(r => r.action === 'upgrade').length}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>resources</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>Downgrade</p>
            <p className="text-lg font-bold mt-1" style={{ color: '#34d399' }}>{recommendations.filter(r => r.action === 'downgrade').length}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>resources</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Optimized</p>
            <p className="text-lg font-bold mt-1" style={{ color: '#94a3b8' }}>{recommendations.filter(r => r.action === 'none').length}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>resources</p>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: 400 }}>
            <div className="text-center px-8">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                style={{
                  background: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.2)',
                  boxShadow: '0 0 40px rgba(249,115,22,0.08)',
                }}>
                <TrendingUp size={32} style={{ color: '#f97316' }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Compute Optimizer
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Select a cloud service and instance type above, set your utilization metrics,
                then click <span className="font-semibold" style={{ color: '#a78bfa' }}>"Analyze Resource"</span> to get right-sizing recommendations.
              </p>
              <div className="flex items-center justify-center gap-4 mt-6">
                {[['AWS','aws'], ['Azure','azure'], ['GCP','gcp']].map(([label, provider], i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <ProviderIcon provider={provider as any} size={18} /> {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Savings callout */}
            {(totalSavings > 0 || upgradeCosts > 0) && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: totalSavings > 0 ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${totalSavings > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                <BarChart3 size={14} className={totalSavings > 0 ? 'text-emerald-400' : 'text-amber-400'} />
                <p className="text-xs" style={{ color: totalSavings > 0 ? '#34d399' : '#f59e0b' }}>
                  {totalSavings > 0
                    ? <><span className="font-bold">Potential monthly savings:</span> ${totalSavings.toFixed(0)}/mo by downgrading {recommendations.filter(r => r.action === 'downgrade').length} underutilized resource(s)</>
                    : <><span className="font-bold">Cost impact:</span> ${upgradeCosts.toFixed(0)}/mo additional if upgrading {recommendations.filter(r => r.action === 'upgrade').length} resource(s) for better performance</>
                  }
                </p>
              </div>
            )}

            {/* Recommendation cards */}
            {recommendations.map(rec => (
              <RecommendationCard key={rec.currentInstance + rec.serviceId + rec.metricValue}
                rec={rec}
                onRemove={() => handleRemove(addedResources.find(r =>
                  r.serviceId === rec.serviceId && r.instanceType === rec.currentInstance
                )?.uid ?? '')} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Activity, AlertTriangle, DollarSign, RefreshCw,
  Shield, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Loader, BarChart3, Cpu, HardDrive, MemoryStick as Memory,
  Wifi, Clock, ArrowUpRight, ArrowDownRight, GitCompare,
  Info,
} from 'lucide-react';
import ProviderIcon from '../components/ProviderIcon';
import {
  generateHealthMetrics, generateDriftAlerts, generateCostAnomalies,
  generateMonitoringSummary,
} from '../utils/monitoringEngine';
import type { HealthMetric, DriftAlert, CostAnomaly } from '../types/monitoring';

type Tab = 'health' | 'drift' | 'cost';

const PROVIDER_META: Record<string, { label: string; icon: string; color: string; bg: string; gradient: string }> = {
  aws:   { label: 'AWS',   icon: 'aws', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', gradient: 'linear-gradient(135deg, #f97316, #fb923c)' },
  azure: { label: 'Azure', icon: 'azure', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
  gcp:   { label: 'GCP',   icon: 'gcp', color: '#f87171', bg: 'rgba(239,68,68,0.12)', gradient: 'linear-gradient(135deg, #ef4444, #f87171)' },
};

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: '#34d399', warning: '#fbbf24', critical: '#ef4444', unknown: '#6b7280',
  };
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: colors[status] ?? colors.unknown }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: colors[status] ?? colors.unknown }} />
    </span>
  );
}

function UtilBar({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const color = value >= 85 ? '#ef4444' : value >= 65 ? '#fbbf24' : '#34d399';
  return (
    <div className="flex items-center gap-2.5 group">
      <div className="w-4 flex justify-center flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <span className="text-[10px] font-bold" style={{ color }}>{value}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-125"
            style={{
              width: `${value}%`,
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              boxShadow: `0 0 6px ${color}40`,
            }} />
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 800;
    const step = Math.max(1, Math.floor(end / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { start = end; clearInterval(timer); }
      setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{prefix}{display}{suffix}</>;
}

function SummaryCard({ icon, label, value, color, bg, subtitle }: {
  icon: React.ReactNode; label: string; value: number | string; color: string;
  bg: string; subtitle?: string;
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${color}08, transparent)` }} />
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{label}</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg, border: `1px solid ${color}30` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        </div>
        <p className="text-2xl font-extrabold tracking-tight" style={{ color }}>
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        {subtitle && <p className="text-[9px] mt-1" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>}
      </div>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
    </div>
  );
}

function HealthCard({ metric }: { metric: HealthMetric }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PROVIDER_META[metric.provider] ?? PROVIDER_META.aws;
  const statusColor = metric.status === 'healthy' ? '#34d399' : metric.status === 'warning' ? '#fbbf24' : '#ef4444';

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{
        background: 'var(--bg-surface)',
        borderColor: expanded ? `${statusColor}30` : 'var(--border)',
      }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: meta.bg, border: '1px solid ' + meta.color + '30' }}>
          <ProviderIcon provider={meta.icon as any} size={22} />
          <div className="absolute -top-1 -right-1">
            <StatusDot status={metric.status} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{metric.resourceName}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: statusColor + '15', color: statusColor, border: '1px solid ' + statusColor + '25' }}>
              {metric.status === 'healthy' ? 'Operational' : metric.status === 'warning' ? 'Degraded' : 'Down'}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {metric.resourceType.replace(/_/g, ' ')} · {meta.label} · {metric.resourceId}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
            <Clock size={10} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>{metric.uptime}h</span>
          </div>
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
            {expanded
              ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-2.5">
            <UtilBar value={metric.cpu} label="CPU" icon={<Cpu size={11} />} />
            <UtilBar value={metric.memory} label="Memory" icon={<Memory size={11} />} />
            <UtilBar value={metric.disk} label="Disk" icon={<HardDrive size={11} />} />
            <UtilBar value={metric.network} label="Network" icon={<Wifi size={11} />} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>
              Last checked: {new Date(metric.lastChecked).toLocaleTimeString()}
            </span>
            <span className="text-[9px] font-medium" style={{ color: statusColor }}>
              Max utilization: {Math.max(metric.cpu, metric.memory, metric.disk, metric.network)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DriftCard({ alert }: { alert: DriftAlert }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PROVIDER_META[alert.provider] ?? PROVIDER_META.aws;
  const sevColor = alert.severity === 'critical' ? '#ef4444' : alert.severity === 'high' ? '#f97316' : alert.severity === 'medium' ? '#eab308' : '#6b7280';

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{
        background: 'var(--bg-surface)',
        borderColor: expanded ? `${sevColor}30` : 'var(--border)',
      }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: meta.bg, border: '1px solid ' + meta.color + '30' }}>
          <GitCompare size={20} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{alert.resourceName}</p>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: sevColor + '15', color: sevColor, border: '1px solid ' + sevColor + '25' }}>
              {alert.severity}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {alert.resourceType.replace(/_/g, ' ')} · {meta.label} · {alert.changedFields.length} field{alert.changedFields.length !== 1 ? 's' : ''} drifted
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
            <Clock size={10} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>
              {Math.floor((Date.now() - new Date(alert.detectedAt).getTime()) / 3600000)}h ago
            </span>
          </div>
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
            {expanded
              ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Changed Fields</p>
            <div className="flex flex-wrap gap-2">
              {alert.changedFields.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                  style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <ArrowUpRight size={10} />
                  {f}
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mt-2"
              style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <Shield size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold" style={{ color: '#fbbf24' }}>Drift Detected</p>
                <p className="text-[9px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Manual changes were made outside of Terraform. Re-import or update your IaC to reconcile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostCard({ anomaly }: { anomaly: CostAnomaly }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PROVIDER_META[anomaly.provider] ?? PROVIDER_META.aws;
  const isOver = anomaly.deviation > 0;
  const maxCost = Math.max(anomaly.estimatedCost, anomaly.actualCost);

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{
        background: 'var(--bg-surface)',
        borderColor: expanded ? `${isOver ? '#ef4444' : '#34d399'}30` : 'var(--border)',
      }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: meta.bg, border: '1px solid ' + meta.color + '30' }}>
          {isOver ? <TrendingUp size={20} style={{ color: '#ef4444' }} /> : <TrendingDown size={20} style={{ color: '#34d399' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{anomaly.serviceName}</p>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: anomaly.severity === 'critical' ? 'rgba(239,68,68,0.15)' : anomaly.severity === 'high' ? 'rgba(249,115,22,0.15)' : 'rgba(234,179,8,0.15)', color: anomaly.severity === 'critical' ? '#ef4444' : anomaly.severity === 'high' ? '#f97316' : '#eab308', border: '1px solid ' + (anomaly.severity === 'critical' ? 'rgba(239,68,68,0.25)' : anomaly.severity === 'high' ? 'rgba(249,115,22,0.25)' : 'rgba(234,179,8,0.25)') }}>
              {anomaly.severity}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta.label} · {anomaly.period}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold" style={{ color: isOver ? '#ef4444' : '#34d399' }}>
              {isOver ? '+' : ''}{anomaly.deviationPct}%
            </p>
            <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>vs estimate</p>
          </div>
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
            {expanded
              ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold" style={{ color: 'var(--text-faint)' }}>Estimated</span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>${anomaly.estimatedCost.toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${(anomaly.estimatedCost / maxCost) * 100}%`,
                    background: 'linear-gradient(90deg, #64748b, #94a3b8)',
                  }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold flex items-center gap-1" style={{ color: isOver ? '#f87171' : '#34d399' }}>
                    {isOver ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                    Actual
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: isOver ? '#ef4444' : '#34d399' }}>${anomaly.actualCost.toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${(anomaly.actualCost / maxCost) * 100}%`,
                    background: isOver
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : 'linear-gradient(90deg, #34d399, #10b981)',
                    boxShadow: '0 0 8px ' + (isOver ? '#ef4444' : '#34d399') + '40',
                  }} />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
              style={{ background: isOver ? 'rgba(239,68,68,0.05)' : 'rgba(52,211,153,0.05)', border: '1px solid ' + (isOver ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)') }}>
              {isOver ? <Info size={13} className="text-red-400 flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="text-[10px] font-semibold" style={{ color: isOver ? '#f87171' : '#34d399' }}>
                  {isOver ? 'Cost Anomaly Detected' : 'Under Budget'}
                </p>
                <p className="text-[9px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {isOver
                    ? `$${anomaly.deviation.toFixed(0)}/mo (${anomaly.deviationPct}%) above the design-time estimate of $${anomaly.estimatedCost.toFixed(0)}`
                    : `$${Math.abs(anomaly.deviation).toFixed(0)}/mo (${Math.abs(anomaly.deviationPct)}%) below the design-time estimate of $${anomaly.estimatedCost.toFixed(0)}`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MonitoringDashboard() {
  const [tab, setTab] = useState<Tab>('health');
  const [refreshing, setRefreshing] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [costAnomalies, setCostAnomalies] = useState<CostAnomaly[]>([]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setHealthMetrics(generateHealthMetrics());
      setDriftAlerts(generateDriftAlerts());
      setCostAnomalies(generateCostAnomalies());
      setRefreshing(false);
    }, 600);
  }, []);

  useEffect(() => { refresh(); }, []);

  const summary = useMemo(
    () => generateMonitoringSummary(healthMetrics, driftAlerts, costAnomalies),
    [healthMetrics, driftAlerts, costAnomalies],
  );

  const totalCostAnomalyOverpay = costAnomalies
    .filter(a => a.deviation > 0)
    .reduce((s, a) => s + a.deviation, 0);

  const tabs: Array<{ id: Tab; icon: React.ReactNode; label: string; count: number; color: string }> = [
    { id: 'health', icon: <Activity size={13} />, label: 'Health Metrics', count: healthMetrics.length, color: '#34d399' },
    { id: 'drift',  icon: <AlertTriangle size={13} />, label: 'Drift Alerts',  count: driftAlerts.length, color: '#fbbf24' },
    { id: 'cost',   icon: <DollarSign size={13} />, label: 'Cost Anomalies', count: costAnomalies.length, color: '#f97316' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden page-enter" style={{ background: 'var(--bg-app)' }}>
      {/* Decorative background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)', animation: 'float-slower 12s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full opacity-[0.02]"
          style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 70%)', animation: 'float-slow 10s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <div className="relative flex-shrink-0 z-10" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 via-emerald-500 to-orange-500 opacity-80" />
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(52,211,153,0.1))',
                border: '1px solid rgba(56,189,248,0.35)',
                boxShadow: '0 0 16px rgba(56,189,248,0.2)',
              }}
            >
              <Activity size={20} className="text-sky-400" />
            </div>
            <div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Infrastructure <span className="gradient-text">Monitoring</span>
              </h1>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Health · Drift Detection · Cost Anomaly Tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-soft 2s ease-in-out infinite' }} />
              {refreshing ? 'Collecting...' : 'Live'}
            </div>
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent-light)' }}>
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {healthMetrics.length > 0 && (
        <div className="relative z-10 px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={<CheckCircle2 size={14} />} label="Healthy" color="#34d399"
              bg="rgba(52,211,153,0.1)"
              value={summary.healthyResources} subtitle="resources operational" />
            <SummaryCard icon={<AlertTriangle size={14} />} label="Warning" color="#fbbf24"
              bg="rgba(251,191,36,0.1)"
              value={summary.warningResources} subtitle="resources degraded" />
            <SummaryCard icon={<XCircle size={14} />} label="Critical" color="#ef4444"
              bg="rgba(239,68,68,0.1)"
              value={summary.criticalResources + summary.driftCount} subtitle="require attention" />
            <SummaryCard icon={<DollarSign size={14} />} label="Potential Savings" color="#f97316"
              bg="rgba(249,115,22,0.1)"
              value={`$${summary.potentialSavings.toFixed(0)}`} subtitle="/month recoverable" />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="relative z-10 flex items-center gap-1 px-6 pt-0 flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 transition-all relative"
              style={{ color: active ? t.color : 'var(--text-muted)' }}>
              {t.icon}
              {t.label}
              <span className="text-[9px] ml-1 px-1.5 py-0.5 rounded-full" style={{ background: active ? `${t.color}15` : 'rgba(255,255,255,0.05)', color: active ? t.color : 'var(--text-faint)' }}>
                {t.count}
              </span>
              {active && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        {tab === 'cost' && totalCostAnomalyOverpay > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <TrendingUp size={10} />
            ${totalCostAnomalyOverpay.toFixed(0)} over budget
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto" style={{ background: 'var(--bg-app)' }}>
        {refreshing && healthMetrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
                <Loader size={28} className="animate-spin text-sky-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Collecting Monitoring Data</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Connecting to cloud providers...</p>
              </div>
            </div>
          </div>
        ) : tab === 'health' ? (
          <div className="p-5 space-y-3">
            {healthMetrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <Activity size={36} style={{ color: '#34d399', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No health metrics yet</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Connect cloud accounts to start monitoring</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                    {healthMetrics.length} resource{healthMetrics.length !== 1 ? 's' : ''} monitored
                  </p>
                  <div className="flex items-center gap-2">
                    {['aws', 'azure', 'gcp'].map(p => {
                      const count = healthMetrics.filter(m => m.provider === p).length;
                      if (count === 0) return null;
                      const m = PROVIDER_META[p];
                      return (
                        <span key={p} className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: m.bg, color: m.color }}>
                          <ProviderIcon provider={p as any} size={10} /> {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {healthMetrics.map(m => <HealthCard key={m.resourceId} metric={m} />)}
              </>
            )}
          </div>
        ) : tab === 'drift' ? (
          <div className="p-5 space-y-3">
            {driftAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <Shield size={36} style={{ color: '#fbbf24', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No drift detected</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All resources match their Terraform state</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-2"
                  style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold text-amber-400">{driftAlerts.length} drift alert{driftAlerts.length !== 1 ? 's' : ''}</span> detected across your infrastructure. Manual changes outside IaC can lead to configuration drift.
                  </p>
                </div>
                {driftAlerts.map(a => <DriftCard key={a.id} alert={a} />)}
              </>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {costAnomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
                  <BarChart3 size={36} style={{ color: '#f97316', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No cost anomalies</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Actual spend aligns with design-time estimates</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-2"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <DollarSign size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold text-red-400">${totalCostAnomalyOverpay.toFixed(0)}/mo</span> in detected over-spend across {costAnomalies.filter(a => a.deviation > 0).length} service{costAnomalies.filter(a => a.deviation > 0).length !== 1 ? 's' : ''}. Real costs deviate from design-time estimates.
                  </p>
                </div>
                {costAnomalies.map(a => <CostCard key={a.id} anomaly={a} />)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

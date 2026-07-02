import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Activity, AlertTriangle, RefreshCw,
  Shield,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Loader, Cpu, HardDrive, MemoryStick as Memory,
  Wifi, Clock, ArrowUpRight, GitCompare,
  Gauge, FileCheck, History, Bell, Settings, Play,
  Pause, Calendar, UserCheck, Timer,
  UserPlus,
} from 'lucide-react';
import ProviderIcon from '../components/ProviderIcon';
import {
  generateHealthMetrics, generateDriftAlerts,
  generateComplianceChecks, generateComplianceSummary,
  generateResourceTrends, generateIncidents, generateIncidentSummary,
  evaluateAlertRules, DEFAULT_ALERT_RULES,
  generateMonitoringSummary,
  generateTickets, generateTicketSummary, TEAM_MEMBERS,
} from '../utils/monitoringEngine';
import type {
  HealthMetric, DriftAlert,
  ComplianceCheck, ResourceTrend,
  Incident, AlertRule, Ticket, TeamMember,
} from '../types/monitoring';

type Tab = 'health' | 'drift' | 'compliance' | 'trends' | 'incidents' | 'tickets';

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



function ComplianceCard({ check }: { check: ComplianceCheck }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PROVIDER_META[check.provider] ?? PROVIDER_META.aws;
  const statusColor = check.status === 'pass' ? '#34d399' : check.status === 'fail' ? '#ef4444' : check.status === 'na' ? '#6b7280' : '#fbbf24';
  const statusLabel = check.status === 'pass' ? 'Passed' : check.status === 'fail' ? 'Failed' : check.status === 'na' ? 'N/A' : 'Error';

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{ background: 'var(--bg-surface)', borderColor: expanded ? `${statusColor}30` : 'var(--border)' }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: meta.bg, border: '1px solid ' + meta.color + '30' }}>
          <ProviderIcon provider={meta.icon as any} size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{check.resourceName}</p>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: statusColor + '15', color: statusColor, border: '1px solid ' + statusColor + '25' }}>
              {statusLabel}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
              {check.severity}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {check.standard} · {check.control}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
            <Clock size={10} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>{Math.floor((Date.now() - new Date(check.checkedAt).getTime()) / 60000)}m ago</span>
          </div>
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
            {expanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-2.5">
            <div className="px-3.5 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Description</p>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{check.description}</p>
            </div>
            {check.status === 'fail' && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <Shield size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold" style={{ color: '#f87171' }}>Remediation</p>
                  <p className="text-[9px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{check.remediation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  const width = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

function TrendCard({ trend }: { trend: ResourceTrend }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PROVIDER_META[trend.provider] ?? PROVIDER_META.aws;
  const latest = trend.dataPoints[trend.dataPoints.length - 1];
  const cpuData = trend.dataPoints.map(d => d.cpu);
  const memData = trend.dataPoints.map(d => d.memory);
  const diskData = trend.dataPoints.map(d => d.disk);
  const netData = trend.dataPoints.map(d => d.network);

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{ background: 'var(--bg-surface)', borderColor: expanded ? `${meta.color}30` : 'var(--border)' }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: meta.bg, border: '1px solid ' + meta.color + '30' }}>
          <Gauge size={20} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{trend.resourceName}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {trend.resourceType.replace(/_/g, ' ')} · {meta.label} · 24h trend
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          {latest && (
            <div className="flex items-center gap-2.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>CPU {latest.cpu}%</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>MEM {latest.memory}%</span>
            </div>
          )}
        </div>
        <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
          {expanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-faint)' }}>Last 24 Hours</span>
              <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>
                {new Date(trend.dataPoints[0]?.timestamp ?? '').toLocaleTimeString()} - {new Date(trend.dataPoints[trend.dataPoints.length - 1]?.timestamp ?? '').toLocaleTimeString()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#34d399' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>CPU</span>
                <Sparkline data={cpuData} color="#34d399" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Memory</span>
                <Sparkline data={memData} color="#60a5fa" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Disk</span>
                <Sparkline data={diskData} color="#fbbf24" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#a78bfa' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Network</span>
                <Sparkline data={netData} color="#a78bfa" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'CPU Avg', value: Math.round(cpuData.reduce((a, b) => a + b, 0) / cpuData.length), color: '#34d399' },
                { label: 'Mem Avg', value: Math.round(memData.reduce((a, b) => a + b, 0) / memData.length), color: '#60a5fa' },
                { label: 'Disk Avg', value: Math.round(diskData.reduce((a, b) => a + b, 0) / diskData.length), color: '#fbbf24' },
                { label: 'Net Avg', value: Math.round(netData.reduce((a, b) => a + b, 0) / netData.length), color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-[8px] font-semibold uppercase" style={{ color: 'var(--text-faint)' }}>{s.label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentCard({ incident, onAcknowledge }: { incident: Incident; onAcknowledge?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PROVIDER_META[incident.provider] ?? PROVIDER_META.aws;
  const sevColor = incident.severity === 'critical' ? '#ef4444' : incident.severity === 'high' ? '#f97316' : incident.severity === 'medium' ? '#eab308' : '#6b7280';
  const statusColor = incident.status === 'open' ? '#ef4444' : incident.status === 'acknowledged' ? '#fbbf24' : '#34d399';
  const statusLabel = incident.status === 'open' ? 'Open' : incident.status === 'acknowledged' ? 'Acknowledged' : 'Resolved';

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{ background: 'var(--bg-surface)', borderColor: expanded ? `${sevColor}30` : 'var(--border)' }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: sevColor + '15', border: '1px solid ' + sevColor + '30' }}>
          <Bell size={20} style={{ color: sevColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{incident.title}</p>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: sevColor + '15', color: sevColor, border: '1px solid ' + sevColor + '25' }}>
              {incident.severity}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: statusColor + '15', color: statusColor, border: '1px solid ' + statusColor + '25' }}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {incident.resourceName} · {meta.label}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
            <Clock size={10} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>
              {Math.floor((Date.now() - new Date(incident.detectedAt).getTime()) / 60000)}m ago
            </span>
          </div>
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
            {expanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-2.5">
            <div className="px-3.5 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Description</p>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{incident.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Calendar size={10} />
                Detected: {new Date(incident.detectedAt).toLocaleString()}
              </div>
              {incident.resolvedAt && (
                <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <CheckCircle2 size={10} />
                  Resolved: {new Date(incident.resolvedAt).toLocaleString()}
                </div>
              )}
              {incident.duration && (
                <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <Timer size={10} />
                  Duration: {Math.round(incident.duration / 60000)}m
                </div>
              )}
              {incident.acknowledgedBy && (
                <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <UserCheck size={10} />
                  {incident.acknowledgedBy}
                </div>
              )}
            </div>
            {incident.status === 'open' && onAcknowledge && (
              <button onClick={(e) => { e.stopPropagation(); onAcknowledge(incident.id); }}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                <UserCheck size={11} />
                Acknowledge Incident
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  teamMembers,
  onAssign,
  onStatusChange,
  onUnassign,
}: {
  ticket: Ticket;
  teamMembers: TeamMember[];
  onAssign: (ticketId: string, member: TeamMember) => void;
  onStatusChange: (ticketId: string, status: Ticket['status'], resolution?: string) => void;
  onUnassign: (ticketId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [resolution, setResolution] = useState('');
  const sevColor = ticket.severity === 'critical' ? '#ef4444' : ticket.severity === 'high' ? '#f97316' : ticket.severity === 'medium' ? '#eab308' : '#6b7280';
  const statusColor = ticket.status === 'open' ? '#ef4444' : ticket.status === 'in_progress' ? '#fbbf24' : ticket.status === 'resolved' ? '#34d399' : '#6b7280';
  const statusLabel = ticket.status === 'open' ? 'Open' : ticket.status === 'in_progress' ? 'In Progress' : ticket.status === 'resolved' ? 'Resolved' : 'Closed';
  const actionable = ticket.status === 'open' || ticket.status === 'in_progress';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowAssignDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      style={{ background: 'var(--bg-surface)', borderColor: expanded ? `${sevColor}30` : 'var(--border)' }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: sevColor + '15', border: '1px solid ' + sevColor + '30' }}>
          <Bell size={20} style={{ color: sevColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ticket.title}</p>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: sevColor + '15', color: sevColor, border: '1px solid ' + sevColor + '25' }}>
              {ticket.severity}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: statusColor + '15', color: statusColor, border: '1px solid ' + statusColor + '25' }}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {ticket.resourceName} · {ticket.resourceType} · {ticket.source}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {ticket.assignee ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: ticket.assignee.color + '12', border: '1px solid ' + ticket.assignee.color + '20' }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold"
                style={{ background: ticket.assignee.color, color: '#0a0a0f' }}>
                {ticket.assignee.initials}
              </div>
              <span className="text-[9px] font-medium" style={{ color: ticket.assignee.color }}>{ticket.assignee.name.split(' ')[0]}</span>
            </div>
          ) : (
            <span className="text-[9px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--text-faint)' }}>
              Unassigned
            </span>
          )}
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:bg-white/5">
            {expanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      <div className={`transition-all duration-300 overflow-visible ${expanded ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mt-3 space-y-2.5">
            <div className="px-3.5 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Description</p>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ticket.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Calendar size={10} />
                Created: {new Date(ticket.createdAt).toLocaleString()}
              </div>
              {ticket.assignedAt && (
                <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <UserCheck size={10} />
                  Assigned: {new Date(ticket.assignedAt).toLocaleString()}
                </div>
              )}
              {ticket.resolvedAt && (
                <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <CheckCircle2 size={10} />
                  Resolved: {new Date(ticket.resolvedAt).toLocaleString()}
                </div>
              )}
              {ticket.resolution && (
                <div className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <CheckCircle2 size={10} />
                  Resolution: {ticket.resolution}
                </div>
              )}
            </div>
            {actionable && (
              <div className="flex items-center gap-2 flex-wrap" ref={ref}>
                {/* Assign / Change Assignment */}
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setShowAssignDropdown(d => !d); }}
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: ticket.assignee ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <UserPlus size={11} />
                    {ticket.assignee ? 'Reassign' : 'Assign'}
                  </button>
                  {showAssignDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-52 rounded-xl overflow-hidden z-50"
                      style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}>
                      {teamMembers.map(m => (
                        <button key={m.id} onClick={(e) => { e.stopPropagation(); onAssign(ticket.id, m); setShowAssignDropdown(false); }}
                          className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left transition-all hover:bg-white/[0.04]">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ background: m.color, color: '#0a0a0f' }}>{m.initials}</div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                            <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{m.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {ticket.assignee && (
                  <button onClick={(e) => { e.stopPropagation(); onUnassign(ticket.id); }}
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <XCircle size={11} />
                    Unassign
                  </button>
                )}
                {ticket.assignee && ticket.status !== 'resolved' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Resolution notes..."
                      onClick={(e) => e.stopPropagation()}
                      className="w-40 text-[10px] px-2.5 py-1.5 rounded-lg outline-none"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    />
                    <button onClick={(e) => { e.stopPropagation(); onStatusChange(ticket.id, 'resolved', resolution || undefined); }}
                      className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <CheckCircle2 size={11} />
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertRulesModal({ rules, onSave, onClose }: { rules: AlertRule[]; onSave: (rules: AlertRule[]) => void; onClose: () => void }) {
  const [localRules, setLocalRules] = useState<AlertRule[]>(rules);

  const toggleRule = (id: string) => {
    setLocalRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const updateThreshold = (id: string, threshold: number) => {
    setLocalRules(prev => prev.map(r => r.id === id ? { ...r, threshold } : r));
  };

  const updateSeverity = (id: string, severity: AlertRule['severity']) => {
    setLocalRules(prev => prev.map(r => r.id === id ? { ...r, severity } : r));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <Settings size={16} style={{ color: 'var(--text-primary)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Alert Rules Configuration</h2>
          </div>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}>
            <XCircle size={16} />
          </button>
        </div>
        <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-3">
          {localRules.map(rule => (
            <div key={rule.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ background: rule.enabled ? 'rgba(255,255,255,0.03)' : 'transparent', border: '1px solid var(--border-subtle)', opacity: rule.enabled ? 1 : 0.5 }}>
              <button onClick={() => toggleRule(rule.id)}
                className="w-5 h-5 rounded flex items-center justify-center transition-all flex-shrink-0"
                style={{ background: rule.enabled ? '#34d399' : 'rgba(255,255,255,0.1)' }}>
                {rule.enabled && <CheckCircle2 size={12} className="text-black" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{rule.label}</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {rule.metric.toUpperCase()} {rule.condition === 'gt' ? '>' : rule.condition === 'lt' ? '<' : rule.condition === 'gte' ? '≥' : '≤'} {rule.threshold}% for {rule.duration}s
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select value={rule.threshold} onChange={e => updateThreshold(rule.id, Number(e.target.value))}
                  className="text-[9px] px-1.5 py-1 rounded-lg font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {[50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(v => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
                <select value={rule.severity} onChange={e => updateSeverity(rule.id, e.target.value as AlertRule['severity'])}
                  className="text-[9px] px-1.5 py-1 rounded-lg font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {(['low', 'medium', 'high', 'critical'] as const).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose}
            className="text-[10px] font-semibold px-4 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            Cancel
          </button>
          <button onClick={() => { onSave(localRules); onClose(); }}
            className="text-[10px] font-semibold px-4 py-2 rounded-lg transition-all hover:scale-[1.02]"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
            Save Rules
          </button>
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
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [resourceTrends, setResourceTrends] = useState<ResourceTrend[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30);
  const [showAlertRules, setShowAlertRules] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setHealthMetrics(generateHealthMetrics());
      setDriftAlerts(generateDriftAlerts());
      setComplianceChecks(generateComplianceChecks());
      setResourceTrends(generateResourceTrends());
      setIncidents(generateIncidents());
      setTickets(generateTickets());
      setRefreshing(false);
    }, 400);
  }, []);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(refresh, autoRefreshInterval * 1000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, autoRefreshInterval, refresh]);

  const summary = useMemo(
    () => generateMonitoringSummary(healthMetrics, driftAlerts),
    [healthMetrics, driftAlerts],
  );

  const complianceSummary = useMemo(
    () => generateComplianceSummary(complianceChecks),
    [complianceChecks],
  );

  const incidentSummary = useMemo(
    () => generateIncidentSummary(incidents),
    [incidents],
  );

  const ticketSummary = useMemo(
    () => generateTicketSummary(tickets),
    [tickets],
  );

  const activeAlerts = useMemo(
    () => healthMetrics.flatMap(m => evaluateAlertRules(m, alertRules)),
    [healthMetrics, alertRules],
  );

  const handleAcknowledgeIncident = useCallback((id: string) => {
    setIncidents(prev => prev.map(i =>
      i.id === id && i.status === 'open'
        ? { ...i, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString(), acknowledgedBy: 'ops@infrastudio.io' }
        : i
    ));
  }, []);

  const handleAssignTicket = useCallback((ticketId: string, member: TeamMember) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId
        ? { ...t, assignee: member, assignedAt: new Date().toISOString(), status: 'in_progress' as const }
        : t
    ));
  }, []);

  const handleTicketStatusChange = useCallback((ticketId: string, status: Ticket['status'], resolution?: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId
        ? {
            ...t, status,
            ...(status === 'resolved' ? { resolvedAt: new Date().toISOString(), resolution } : {}),
          }
        : t
    ));
  }, []);

  const handleUnassignTicket = useCallback((ticketId: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId
        ? { ...t, assignee: undefined, assignedAt: undefined, status: 'open' as const }
        : t
    ));
  }, []);

  const tabs: Array<{ id: Tab; icon: React.ReactNode; label: string; count: number; color: string }> = [
    { id: 'health', icon: <Activity size={13} />, label: 'Health Metrics', count: healthMetrics.length, color: '#34d399' },
    { id: 'drift', icon: <AlertTriangle size={13} />, label: 'Drift Alerts', count: driftAlerts.length, color: '#fbbf24' },
    { id: 'compliance', icon: <FileCheck size={13} />, label: 'Compliance', count: complianceChecks.filter(c => c.status === 'fail').length, color: '#818cf8' },
    { id: 'trends', icon: <Gauge size={13} />, label: 'Trends', count: resourceTrends.length, color: '#60a5fa' },
    { id: 'incidents', icon: <Bell size={13} />, label: 'Incidents', count: incidents.filter(i => i.status !== 'resolved').length, color: '#f97316' },
    { id: 'tickets', icon: <UserPlus size={13} />, label: 'Tickets', count: tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length, color: '#a78bfa' },
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
                Real-time Health & Drift Detection · Compliance · Incidents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <button onClick={() => setAutoRefresh(!autoRefresh)}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
                style={{ color: autoRefresh ? '#34d399' : 'var(--text-muted)' }}>
                {autoRefresh ? <Pause size={11} /> : <Play size={11} />}
                {autoRefresh ? `${autoRefreshInterval}s` : 'Auto'}
              </button>
              {autoRefresh && (
                <select value={autoRefreshInterval} onChange={e => setAutoRefreshInterval(Number(e.target.value))}
                  className="text-[9px] font-medium bg-transparent rounded px-1 py-0.5"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}
            </div>
            {/* Alert rules button */}
            <button onClick={() => setShowAlertRules(true)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Settings size={11} />
              Rules
            </button>
            {activeAlerts.length > 0 && !showAlertRules && (
              <div className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Bell size={10} />
                {activeAlerts.length} active
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500' : 'bg-gray-500'}`}
                style={{ animation: autoRefresh ? 'pulse-soft 2s ease-in-out infinite' : 'none' }} />
              {refreshing ? 'Collecting...' : autoRefresh ? 'Auto' : 'Static'}
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
      {(healthMetrics.length > 0 || complianceChecks.length > 0) && (
        <div className="relative z-10 px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={<CheckCircle2 size={14} />} label="Healthy" color="#34d399"
              bg="rgba(52,211,153,0.1)"
              value={summary.healthyResources} subtitle="resources operational" />
            <SummaryCard icon={<AlertTriangle size={14} />} label="Warning" color="#fbbf24"
              bg="rgba(251,191,36,0.1)"
              value={summary.warningResources} subtitle="resources degraded" />
            <SummaryCard icon={<FileCheck size={14} />} label="Compliance Score" color="#818cf8"
              bg="rgba(99,102,241,0.1)"
              value={`${complianceSummary.score}%`} subtitle={`${complianceSummary.failed} failed checks`} />
            <SummaryCard icon={<Bell size={14} />} label={incidentSummary.open > 0 ? 'Open Incidents' : 'MTTR'} color={incidentSummary.open > 0 ? '#ef4444' : '#34d399'}
              bg={incidentSummary.open > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)'}
              value={incidentSummary.open > 0 ? incidentSummary.open : `${incidentSummary.mttr}m`}
              subtitle={incidentSummary.open > 0 ? 'require acknowledgement' : 'mean time to resolve'} />
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
                {activeAlerts.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-2"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Bell size={12} className="text-red-400 flex-shrink-0" />
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-bold text-red-400">{activeAlerts.length} alert rule{activeAlerts.length !== 1 ? 's' : ''}</span> firing — consider reviewing thresholds
                    </p>
                  </div>
                )}
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
        ) : tab === 'compliance' ? (
          <div className="p-5 space-y-3">
            {complianceChecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <FileCheck size={36} style={{ color: '#818cf8', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No compliance data</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Connect cloud accounts to run compliance scans</p>
              </div>
            ) : (
              <>
                {/* Compliance score ring */}
                <div className="flex items-center gap-6 px-5 py-4 rounded-2xl mb-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#818cf8" strokeWidth="5"
                        strokeDasharray={`${(complianceSummary.score / 100) * 176} 176`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-extrabold" style={{ color: '#818cf8' }}>{complianceSummary.score}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Compliance Posture</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {complianceSummary.passed} passed · {complianceSummary.failed} failed · {complianceSummary.na} N/A across {complianceSummary.totalChecks} checks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <CheckCircle2 size={9} /> {complianceSummary.passed}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <XCircle size={9} /> {complianceSummary.failed}
                    </span>
                  </div>
                </div>

                {/* Standards grouping */}
                {Array.from(new Set(complianceChecks.map(c => c.standard))).map(standard => {
                  const checks = complianceChecks.filter(c => c.standard === standard);
                  const passed = checks.filter(c => c.status === 'pass').length;
                  const failed = checks.filter(c => c.status === 'fail').length;
                  return (
                    <div key={standard} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-2">
                          <Shield size={12} style={{ color: failed > 0 ? '#ef4444' : '#34d399' }} />
                          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{standard}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{passed} pass</span>
                          {failed > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{failed} fail</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between mt-4 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                    {complianceChecks.length} checks
                  </p>
                </div>
                {complianceChecks.map(c => <ComplianceCard key={c.id} check={c} />)}
              </>
            )}
          </div>
        ) : tab === 'trends' ? (
          <div className="p-5 space-y-3">
            {resourceTrends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <Gauge size={36} style={{ color: '#60a5fa', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No trend data available</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Resource utilization history appears once monitoring is active</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                    {resourceTrends.length} resources · 24h rolling window
                  </p>
                  <span className="text-[9px] flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                    <History size={10} /> 24 data points each
                  </span>
                </div>
                {resourceTrends.map(t => <TrendCard key={t.resourceId} trend={t} />)}
              </>
            )}
          </div>
        ) : tab === 'incidents' ? (
          <div className="p-5 space-y-3">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
                  <Bell size={36} style={{ color: '#f97316', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No incidents recorded</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All clear — no issues detected in the monitoring window</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-2"
                  style={{ background: incidentSummary.open > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(52,211,153,0.06)', border: '1px solid ' + (incidentSummary.open > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)') }}>
                  {incidentSummary.open > 0 ? <AlertTriangle size={14} className="text-red-400 flex-shrink-0" /> : <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {incidentSummary.open > 0
                      ? <><span className="font-bold text-red-400">{incidentSummary.open} open</span> · {incidentSummary.acknowledged} acknowledged · {incidentSummary.resolved} resolved · MTTR <span className="font-bold text-emerald-400">{incidentSummary.mttr}m</span></>
                      : <><span className="font-bold text-emerald-400">All {incidentSummary.total} incidents resolved</span> · MTTR {incidentSummary.mttr}m</>
                    }
                  </p>
                </div>
                {incidents.map(i => <IncidentCard key={i.id} incident={i} onAcknowledge={handleAcknowledgeIncident} />)}
              </>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                  style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
                  <UserPlus size={36} style={{ color: '#a78bfa', opacity: 0.5 }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No tickets yet</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tickets are automatically created from critical incidents and compliance failures</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-2"
                  style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
                  <UserPlus size={14} className="text-purple-400 flex-shrink-0" />
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold text-purple-400">{ticketSummary.total} tickets</span> · {ticketSummary.open} open · {ticketSummary.inProgress} in progress · {ticketSummary.resolved} resolved · <span className="font-bold text-purple-400">{ticketSummary.critical} critical</span> · {ticketSummary.unassigned} unassigned
                  </p>
                </div>
                {tickets.map(t => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    teamMembers={TEAM_MEMBERS}
                    onAssign={handleAssignTicket}
                    onStatusChange={handleTicketStatusChange}
                    onUnassign={handleUnassignTicket}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Alert Rules Modal */}
      {showAlertRules && (
        <AlertRulesModal
          rules={alertRules}
          onSave={(rules) => setAlertRules(rules)}
          onClose={() => setShowAlertRules(false)}
        />
      )}
    </div>
  );
}

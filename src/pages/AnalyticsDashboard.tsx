import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, PieChart, TrendingUp, RefreshCw,
  Server, DollarSign, Activity, Shield,
  Clock, ArrowUpRight, FolderOpen, Search,
  Filter, CheckCircle2, XCircle, AlertTriangle,
  Play, User, Calendar,
} from 'lucide-react';
import { generateAnalyticsSummary, PROVIDER_COLORS, PROVIDER_LABELS } from '../utils/analyticsEngine';
import type {
  AnalyticsSummary, CategoryStat, ProviderStat,
  CostBreakdown, ActivityEvent, ComplexityMetric, CloudServiceRecord,
} from '../types/analytics';

type Tab = 'overview' | 'resources' | 'cost' | 'activity' | 'services';

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 800;
    const step = Math.max(0.1, end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { start = end; clearInterval(timer); }
      setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

// ── Summary Card ───────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color, bg, subtitle, badge }: {
  icon: React.ReactNode; label: string; value: number; color: string;
  bg: string; subtitle?: string; badge?: string;
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl"
      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${color}0c, transparent)` }} />
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.04] pointer-events-none -translate-y-1/2 translate-x-1/2"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{label}</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
            style={{ background: bg, border: `1px solid ${color}30`, boxShadow: `0 0 12px ${color}15` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-extrabold tracking-tight" style={{ color }}>
            {typeof value === 'number' ? (
              <AnimatedNumber value={value}
                prefix={label === 'Total Cost' ? '$' : ''}
                decimals={label === 'Total Cost' ? 2 : 0} />
            ) : value}
          </p>
          {badge && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md mb-1"
              style={{ background: `${color}15`, color }}>{badge}</span>
          )}
        </div>
        {subtitle && <p className="text-[9px] mt-1.5" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>}
      </div>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
    </div>
  );
}

// ── Category Pie Chart ────────────────────────────────────────────────────────

function CategoryPie({ stats }: { stats: CategoryStat[] }) {
  const total = stats.reduce((s, c) => s + c.count, 0);
  if (total === 0) return <div className="text-xs text-center py-8" style={{ color: 'var(--text-faint)' }}>No data</div>;
  let cumulative = 0;
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {stats.map(c => {
          const pct = (c.count / total) * 100;
          cumulative += pct;
          return (
            <div key={c.category} className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full relative group/seg"
              style={{ width: `${pct}%`, background: c.color, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 0 8px ${c.color}30` }}
              title={`${c.category}: ${c.count} (${Math.round(pct)}%)`} />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {stats.map(c => (
          <div key={c.category} className="flex items-center gap-2 text-[11px] px-1">
            <span className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: c.color }} />
            <span style={{ color: 'var(--text-secondary)' }} className="truncate">{c.category}</span>
            <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{Math.round((c.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Provider Bar Chart ────────────────────────────────────────────────────────

function ProviderBar({ stats }: { stats: ProviderStat[] }) {
  const max = Math.max(...stats.map(s => s.count), 1);
  return (
    <div className="space-y-3.5">
      {stats.map(s => (
        <div key={s.provider} className="group">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}50` }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>
                {s.count}
              </span>
            </div>
            <span className="text-xs font-bold" style={{ color: s.color }}>{s.percentage}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="h-full rounded-full transition-all duration-1000 group-hover:brightness-125"
              style={{
                width: `${(s.count / max) * 100}%`,
                background: `linear-gradient(90deg, ${s.color}, ${s.color}dd)`,
                boxShadow: `0 0 8px ${s.color}30`,
              }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cost Bar Chart ────────────────────────────────────────────────────────────

function CostBar({ breakdown }: { breakdown: CostBreakdown[] }) {
  const max = Math.max(...breakdown.map(b => b.monthly), 1);
  return (
    <div className="space-y-3">
      {breakdown.map(b => (
        <div key={b.service} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                b.trend === 'up' ? 'bg-red-400' : b.trend === 'down' ? 'bg-green-400' : 'bg-yellow-400'
              }`} style={{ boxShadow: `0 0 4px ${
                b.trend === 'up' ? '#f87171' : b.trend === 'down' ? '#4ade80' : '#fbbf24'
              }50` }} />
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{b.service}</span>
              <span className="text-[9px] px-1 py-0.5 rounded font-medium"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>{b.provider}</span>
            </div>
            <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>${b.monthly}/mo</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
              style={{
                width: `${(b.monthly / max) * 100}%`,
                background: `linear-gradient(90deg, ${b.trend === 'up' ? '#f87171' : b.trend === 'down' ? '#4ade80' : '#fbbf24'}, ${b.trend === 'up' ? '#ef4444' : b.trend === 'down' ? '#34d399' : '#f59e0b'})`,
                boxShadow: `0 0 6px ${b.trend === 'up' ? '#f87171' : b.trend === 'down' ? '#4ade80' : '#fbbf24'}40`,
              }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Complexity Gauge ──────────────────────────────────────────────────────────

function ComplexityGauge({ metric }: { metric: ComplexityMetric }) {
  const pct = (metric.value / metric.max) * 100;
  const color = pct >= 80 ? '#34d399' : pct >= 55 ? '#fbbf24' : '#f87171';
  return (
    <div className="relative p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{metric.label}</span>
        <span className="text-sm font-bold" style={{ color }}>{metric.value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})`, boxShadow: `0 0 8px ${color}40` }} />
      </div>
      <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{metric.description}</p>
    </div>
  );
}

// ── Activity Item ─────────────────────────────────────────────────────────────

function ActivityItem({ event }: { event: ActivityEvent }) {
  const colors: Record<string, string> = {
    aws: '#fb923c', azure: '#60a5fa', gcp: '#f87171',
    ansible: '#60a5fa', crossplane: '#38bdf8',
  };
  const ago = Math.floor((Date.now() - new Date(event.timestamp).getTime()) / 60000);
  const timeStr = ago < 1 ? 'Just now' : ago < 60 ? `${ago}m ago` : `${Math.floor(ago / 60)}h ago`;
  const actionColors: Record<string, string> = {
    Created: '#34d399', Modified: '#fbbf24', Deleted: '#f87171',
    Deployed: '#818cf8', Configured: '#60a5fa', Scaled: '#c084fc', Updated: '#38bdf8',
  };
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all hover:scale-[1.005]"
      style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.04))' }}>
      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: `${actionColors[event.action] || '#6b7280'}18`, border: `1px solid ${actionColors[event.action] || '#6b7280'}30`, color: actionColors[event.action] || '#6b7280' }}>
        {event.action[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
          <span className="font-semibold">{event.action}</span>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{event.resourceName}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{event.user}</span>
          <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: `${colors[event.provider] || '#6b7280'}12`, color: colors[event.provider] || '#6b7280' }}>
            {event.provider.toUpperCase()}
          </span>
        </div>
      </div>
      <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{timeStr}</span>
    </div>
  );
}

// ── Service Record Row ────────────────────────────────────────────────────────

function formatServiceType(type: string): string {
  const map: Record<string, string> = {
    'aws_instance': 'EC2',
    'aws_vpc': 'VPC',
    'aws_subnet': 'Subnet',
    'aws_security_group': 'Security Group',
    'aws_lb': 'Load Balancer',
    'aws_rds_instance': 'RDS',
    'aws_s3_bucket': 'S3',
    'aws_lambda_function': 'Lambda',
    'aws_iam_role': 'IAM Role',
    'azurerm_virtual_machine': 'VM',
    'azurerm_virtual_network': 'VNet',
    'google_compute_instance': 'Compute Engine',
    'google_compute_network': 'VPC',
  };
  return map[type] || type.split('_').slice(-1)[0] || type;
}

function getServiceIcon(type: string): string {
  const map: Record<string, string> = {
    'aws_instance': '🖥️',
    'aws_vpc': '🌐',
    'aws_subnet': '🔀',
    'aws_security_group': '🛡️',
    'aws_lb': '⚖️',
    'aws_rds_instance': '🗄️',
    'aws_s3_bucket': '🪣',
    'aws_lambda_function': '⚡',
    'aws_iam_role': '🔑',
    'azurerm_virtual_machine': '🖥️',
    'azurerm_virtual_network': '🌐',
    'google_compute_instance': '🖥️',
  };
  return map[type] || '📦';
}

function ServiceRecordRow({ record }: { record: CloudServiceRecord }) {
  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    active:       { label: 'Active', color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: <CheckCircle2 size={10} /> },
    stopped:      { label: 'Stopped', color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: <XCircle size={10} /> },
    failed:       { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <AlertTriangle size={10} /> },
    provisioning: { label: 'Provisioning', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: <Play size={10} /> },
  };
  const st = statusConfig[record.status] || statusConfig.active;
  const createdDate = new Date(record.createdAt);
  const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const providerColor = PROVIDER_COLORS[record.provider] || '#6b7280';

  return (
    <tr className="transition-all hover:brightness-110" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: `${providerColor}18`, border: `1px solid ${providerColor}30` }}>
            {getServiceIcon(record.serviceType)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{record.serviceName}</p>
            <p className="text-[10px] font-medium" style={{ color: '#818cf8' }}>{formatServiceType(record.serviceType)}</p>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap"
          style={{ background: `${providerColor}15`, color: providerColor, border: `1px solid ${providerColor}25` }}>
          {record.providerLabel}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{record.category}</span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{record.region}</span>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
            style={{ background: `${providerColor}20`, color: providerColor }}>
            {record.createdByAvatar.slice(0, 2)}
          </div>
          <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{record.createdBy}</span>
        </div>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Calendar size={9} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{dateStr}</span>
          <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{timeStr}</span>
        </div>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md w-fit"
          style={{ background: st.bg, border: `1px solid ${st.color}25` }}>
          <span style={{ color: st.color }}>{st.icon}</span>
          <span className="text-[9px] font-medium" style={{ color: st.color }}>{st.label}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="text-xs font-semibold" style={{ color: '#34d399' }}>${record.cost.toFixed(2)}</span>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex gap-1">
          {record.tags.slice(0, 2).map(t => (
            <span key={t} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>
              {t.includes(':') ? t.split(':')[1] : t.slice(0, 6)}
            </span>
          ))}
          {record.tags.length > 2 && (
            <span className="text-[8px]" style={{ color: 'var(--text-faint)' }}>+{record.tags.length - 2}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary>(() => generateAnalyticsSummary());
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setSummary(generateAnalyticsSummary());
      setRefreshing(false);
    }, 400);
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={13} /> },
    { id: 'resources', label: 'Resources', icon: <Server size={13} /> },
    { id: 'cost', label: 'Cost', icon: <DollarSign size={13} /> },
    { id: 'services', label: 'Service Audit', icon: <User size={13} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={13} /> },
  ];

  const topCost = useMemo(() =>
    summary.costBreakdown.reduce((max, c) => c.monthly > max.monthly ? c : max, summary.costBreakdown[0]),
    [summary],
  );

  // ── Filtered service records ────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let records = summary.cloudServiceRecords;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      records = records.filter(r =>
        r.serviceName.toLowerCase().includes(q) ||
        r.createdBy.toLowerCase().includes(q) ||
        r.serviceType.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q)
      );
    }
    if (providerFilter !== 'all') {
      records = records.filter(r => r.provider === providerFilter);
    }
    if (statusFilter !== 'all') {
      records = records.filter(r => r.status === statusFilter);
    }
    return records;
  }, [summary.cloudServiceRecords, searchQuery, providerFilter, statusFilter]);

  const providers = useMemo(() =>
    Array.from(new Set(summary.cloudServiceRecords.map(r => r.provider))),
    [summary.cloudServiceRecords],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden page-enter" style={{ background: 'var(--bg-app)' }}>
      {/* ── Animated background ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, #8b5cf6 30%, transparent 70%)', animation: 'drift-orb 18s ease-in-out infinite' }} />
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #34d399 0%, #22d3ee 30%, transparent 70%)', animation: 'drift-orb 22s ease-in-out infinite reverse' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.015]"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 60%)', animation: 'float-slower 20s ease-in-out infinite' }} />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 z-10 px-6 py-4"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 24px rgba(99,102,241,0.35)' }}>
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Analytics & Insights
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Infrastructure usage, cost, performance metrics & service audit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2.5 py-1 rounded-md"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>
              Updated {new Date().toLocaleString()}
            </span>
            <button onClick={handleRefresh}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <RefreshCw size={14} className="text-indigo-400" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mt-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200"
              style={{
                background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))' : 'transparent',
                color: activeTab === tab.id ? '#a5b4fc' : 'var(--text-faint)',
                border: `1px solid ${activeTab === tab.id ? 'rgba(99,102,241,0.35)' : 'transparent'}`,
                boxShadow: activeTab === tab.id ? '0 0 16px rgba(99,102,241,0.15)' : 'none',
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative z-10 px-6 py-5 space-y-5">

        {/* ── Summary cards (always visible) ───────────────────────────────── */}
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard icon={<Server size={15} />} label="Total Resources" value={summary.totalResources} color="#818cf8" bg="rgba(99,102,241,0.12)" subtitle="Across all providers" badge={summary.providerStats.length + ' providers'} />
          <SummaryCard icon={<DollarSign size={15} />} label="Total Cost" value={summary.totalCost} color="#34d399" bg="rgba(52,211,153,0.12)" subtitle="Estimated monthly spend" />
          <SummaryCard icon={<FolderOpen size={15} />} label="Active Projects" value={summary.totalProjects} color="#fbbf24" bg="rgba(251,191,36,0.12)" subtitle="Diagrams & playbooks" />
          <SummaryCard icon={<Shield size={15} />} label="Security Score" value={summary.securityScore} color="#f87171" bg="rgba(239,68,68,0.12)" subtitle="Out of 100" badge={summary.securityScore >= 70 ? 'Good' : 'Needs work'} />
          <SummaryCard icon={<Activity size={15} />} label="Health Score" value={summary.healthScore} color="#38bdf8" bg="rgba(56,189,248,0.12)" subtitle="Infrastructure health" badge={summary.healthScore >= 70 ? 'Stable' : 'At risk'} />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            OVERVIEW TAB
           ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Scorecard */}
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <TrendingUp size={14} style={{ color: '#818cf8' }} />
                  </div>
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Infrastructure Scorecard</h2>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>
                  Overall {summary.complexityScore}/100
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {summary.complexityMetrics.map(m => (
                  <ComplexityGauge key={m.label} metric={m} />
                ))}
              </div>
            </div>

            {/* Category + Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <PieChart size={14} style={{ color: '#818cf8' }} />
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Resource Categories</h2>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                    {summary.categoryStats.reduce((s, c) => s + c.count, 0)} total
                  </span>
                </div>
                <CategoryPie stats={summary.categoryStats} />
              </div>
              <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <DollarSign size={14} style={{ color: '#34d399' }} />
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cost Breakdown</h2>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Top: {topCost.service}</span>
                </div>
                <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Highest spend</span>
                  <span className="text-xs font-bold" style={{ color: '#34d399' }}>{topCost.service} — ${topCost.monthly}/mo</span>
                </div>
                <CostBar breakdown={summary.costBreakdown} />
              </div>
            </div>

            {/* Provider distribution */}
            <div className="grid grid-cols-5 gap-3">
              {summary.providerStats.map(p => (
                <div key={p.provider} className="relative rounded-xl p-4 text-center transition-all duration-300 hover:scale-[1.04] hover:shadow-xl"
                  style={{ background: 'var(--bg-surface-2)', border: `1px solid ${p.color}25`, overflow: 'hidden' }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${p.color}, ${p.color}44)` }} />
                  <p className="text-2xl font-extrabold" style={{ color: p.color }}>{p.percentage}%</p>
                  <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{p.label}</p>
                  <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{p.count} resources</p>
                  <p className="text-[9px] mt-1 font-semibold" style={{ color: p.cost > 0 ? '#34d399' : 'var(--text-faint)' }}>
                    {p.cost > 0 ? `$${p.cost.toFixed(0)}/mo` : 'Free'}
                  </p>
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Clock size={14} style={{ color: '#818cf8' }} />
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
                </div>
                <button onClick={() => setActiveTab('activity')}
                  className="text-[10px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: '#818cf8' }}>
                  View all <ArrowUpRight size={11} />
                </button>
              </div>
              <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
                {summary.recentActivity.slice(0, 10).map(e => (
                  <ActivityItem key={e.id} event={e} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RESOURCES TAB
           ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'resources' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>By Category</h2>
              <CategoryPie stats={summary.categoryStats} />
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>By Provider</h2>
              <ProviderBar stats={summary.providerStats} />
            </div>
            <div className="rounded-xl p-5 col-span-2" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>All Resource Types</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: 'var(--text-faint)' }}>
                      <th className="text-left py-2 px-3 font-medium">Type</th>
                      <th className="text-left py-2 px-3 font-medium">Category</th>
                      <th className="text-right py-2 px-3 font-medium">Count</th>
                      <th className="text-right py-2 px-3 font-medium">Monthly Cost</th>
                      <th className="text-right py-2 px-3 font-medium">Provider</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.resourceStats.map(r => (
                      <tr key={r.type} className="transition-all hover:brightness-110"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{r.icon}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>{r.category}</td>
                        <td className="py-2 px-3 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{r.count}</td>
                        <td className="py-2 px-3 text-right" style={{ color: r.cost > 0 ? '#34d399' : 'var(--text-faint)' }}>
                          ${r.cost.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                            style={{ background: `${PROVIDER_COLORS[r.provider] || '#6b7280'}12`, color: PROVIDER_COLORS[r.provider] || '#6b7280' }}>
                            {PROVIDER_LABELS[r.provider] || r.provider.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            COST TAB
           ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'cost' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Spend by Service</h2>
              <CostBar breakdown={summary.costBreakdown} />
            </div>
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cost Summary</h2>
              {(() => {
                const totalMonthly = summary.costBreakdown.reduce((s, c) => s + c.monthly, 0);
                const totalYearly = summary.costBreakdown.reduce((s, c) => s + c.yearly, 0);
                return (
                  <>
                    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.04))', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <div>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-faint)' }}>Monthly Total</p>
                        <p className="text-2xl font-extrabold" style={{ color: '#34d399' }}>${totalMonthly.toFixed(2)}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}>
                        <DollarSign size={22} style={{ color: '#34d399' }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.04))', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <div>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-faint)' }}>Yearly Projection</p>
                        <p className="text-2xl font-extrabold" style={{ color: '#818cf8' }}>${totalYearly.toFixed(2)}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <ArrowUpRight size={22} style={{ color: '#818cf8' }} />
                      </div>
                    </div>
                    <div className="space-y-2.5 mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Provider Totals</p>
                      {summary.providerStats.filter(p => p.cost > 0).map(p => (
                        <div key={p.provider} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: p.color }}>${p.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SERVICE AUDIT TAB  ← NEW
           ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'services' && (
          <div className="rounded-xl" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
            {/* Header + filters */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <User size={14} style={{ color: '#818cf8' }} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cloud Service Audit Log</h2>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Track who created which service, when, and on which cloud
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>
                  {filteredRecords.length} records
                </span>
              </div>

              {/* Filters row */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search service, user, or region..."
                    className="w-full text-[11px] pl-8 pr-3 py-2 rounded-lg outline-none transition-all"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={12} style={{ color: 'var(--text-faint)' }} />
                  <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)}
                    className="text-[11px] px-2.5 py-2 rounded-lg outline-none cursor-pointer"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                    <option value="all">All Providers</option>
                    {providers.map(p => (
                      <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
                    ))}
                  </select>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-[11px] px-2.5 py-2 rounded-lg outline-none cursor-pointer"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="stopped">Stopped</option>
                    <option value="provisioning">Provisioning</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--text-faint)' }}>
                    <th className="text-left py-2.5 px-3 font-medium">Service</th>
                    <th className="text-left py-2.5 px-3 font-medium">Provider</th>
                    <th className="text-left py-2.5 px-3 font-medium">Category</th>
                    <th className="text-left py-2.5 px-3 font-medium">Region</th>
                    <th className="text-left py-2.5 px-3 font-medium">Created By</th>
                    <th className="text-left py-2.5 px-3 font-medium">Created At</th>
                    <th className="text-left py-2.5 px-3 font-medium">Status</th>
                    <th className="text-right py-2.5 px-3 font-medium">Cost</th>
                    <th className="text-left py-2.5 px-3 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-xs" style={{ color: 'var(--text-faint)' }}>
                        No matching service records found
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(r => (
                      <ServiceRecordRow key={r.id} record={r} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}>
              <span className="text-[10px]">
                Showing {filteredRecords.length} of {summary.cloudServiceRecords.length} services
              </span>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> Active: {filteredRecords.filter(r => r.status === 'active').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" /> Provisioning: {filteredRecords.filter(r => r.status === 'provisioning').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> Failed: {filteredRecords.filter(r => r.status === 'failed').length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ACTIVITY TAB
           ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Activity size={14} style={{ color: '#818cf8' }} />
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Activity Timeline</h2>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>
                  {summary.recentActivity.length} events
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {summary.recentActivity.map(e => (
                  <ActivityItem key={e.id} event={e} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Activity Summary</h2>
              <div className="grid grid-cols-4 gap-3">
                {['Created', 'Modified', 'Deleted', 'Deployed'].map(action => {
                  const count = summary.recentActivity.filter(e => e.action === action).length;
                  const colors: Record<string, string> = { Created: '#34d399', Modified: '#fbbf24', Deleted: '#f87171', Deployed: '#818cf8' };
                  return (
                    <div key={action} className="text-center p-4 rounded-xl transition-all hover:scale-[1.03]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors[action]}15` }}>
                      <p className="text-2xl font-extrabold" style={{ color: colors[action] }}>{count}</p>
                      <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-faint)' }}>{action}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

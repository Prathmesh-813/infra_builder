import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, PieChart, TrendingUp, RefreshCw,
  Server, DollarSign, Activity, Shield,
  Clock, ArrowUpRight, FolderOpen,
} from 'lucide-react';
import { generateAnalyticsSummary } from '../utils/analyticsEngine';
import type {
  AnalyticsSummary, CategoryStat, ProviderStat,
  CostBreakdown, ActivityEvent, ComplexityMetric,
} from '../types/analytics';

type Tab = 'overview' | 'resources' | 'cost' | 'activity';

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

function SummaryCard({ icon, label, value, color, bg, subtitle }: {
  icon: React.ReactNode; label: string; value: number; color: string;
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
          {typeof value === 'number' ? <AnimatedNumber value={value} prefix={label === 'Total Cost' ? '$' : ''} decimals={label === 'Total Cost' ? 2 : 0} /> : value}
        </p>
        {subtitle && <p className="text-[9px] mt-1" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>}
      </div>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
    </div>
  );
}

function CategoryPie({ stats }: { stats: CategoryStat[] }) {
  const total = stats.reduce((s, c) => s + c.count, 0);
  if (total === 0) return <div className="text-xs text-center py-8" style={{ color: 'var(--text-faint)' }}>No data</div>;
  let cumulative = 0;
  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {stats.map(c => {
          const pct = (c.count / total) * 100;
          cumulative += pct;
          return (
            <div key={c.category} className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, background: c.color, boxShadow: `0 0 6px ${c.color}40` }} />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {stats.map(c => (
          <div key={c.category} className="flex items-center gap-2 text-[10px]">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span style={{ color: 'var(--text-secondary)' }} className="truncate">{c.category}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--text-primary)' }}>{Math.round((c.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderBar({ stats }: { stats: ProviderStat[] }) {
  const max = Math.max(...stats.map(s => s.count), 1);
  return (
    <div className="space-y-3">
      {stats.map(s => (
        <div key={s.provider} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
              <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>({s.count})</span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.percentage}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
              style={{
                width: `${(s.count / max) * 100}%`,
                background: `linear-gradient(90deg, ${s.color}80, ${s.color})`,
                boxShadow: `0 0 6px ${s.color}40`,
              }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CostBar({ breakdown }: { breakdown: CostBreakdown[] }) {
  const max = Math.max(...breakdown.map(b => b.monthly), 1);
  return (
    <div className="space-y-2.5">
      {breakdown.map(b => (
        <div key={b.service} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.trend === 'up' ? 'bg-red-400' : b.trend === 'down' ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{b.service}</span>
              <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}>{b.provider}</span>
            </div>
            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>${b.monthly}/mo</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
              style={{
                width: `${(b.monthly / max) * 100}%`,
                background: `linear-gradient(90deg, #818cf880, #818cf8)`,
                boxShadow: `0 0 6px #818cf840`,
              }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ComplexityGauge({ metric }: { metric: ComplexityMetric }) {
  const pct = (metric.value / metric.max) * 100;
  const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="relative p-3 rounded-xl transition-all duration-300 hover:scale-[1.02]"
      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{metric.label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{metric.value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 6px ${color}40` }} />
      </div>
      <p className="text-[8px]" style={{ color: 'var(--text-faint)' }}>{metric.description}</p>
    </div>
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const providerColors: Record<string, string> = {
    aws: '#fb923c', azure: '#60a5fa', gcp: '#f87171',
    ansible: '#60a5fa', crossplane: '#38bdf8',
  };
  const ago = Math.floor((Date.now() - new Date(event.timestamp).getTime()) / 60000);
  const timeStr = ago < 1 ? 'Just now' : ago < 60 ? `${ago}m ago` : `${Math.floor(ago / 60)}h ago`;
  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg transition-all hover:scale-[1.005]"
      style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.04))' }}>
      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] flex-shrink-0"
        style={{ background: `${providerColors[event.provider] || '#6b7280'}15`, border: `1px solid ${providerColors[event.provider] || '#6b7280'}30` }}>
        {event.action[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] truncate" style={{ color: 'var(--text-primary)' }}>
          <span className="font-medium">{event.action}</span>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{event.resourceName}</span>
        </p>
        <p className="text-[8px]" style={{ color: 'var(--text-faint)' }}>
          {event.user} · {event.provider.toUpperCase()}
        </p>
      </div>
      <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{timeStr}</span>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary>(() => generateAnalyticsSummary());
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setSummary(generateAnalyticsSummary());
      setRefreshing(false);
    }, 400);
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={12} /> },
    { id: 'resources', label: 'Resources', icon: <Server size={12} /> },
    { id: 'cost', label: 'Cost', icon: <DollarSign size={12} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={12} /> },
  ];

  const topCost = useMemo(() => summary.costBreakdown.reduce((max, c) => c.monthly > max.monthly ? c : max, summary.costBreakdown[0]), [summary]);

  return (
    <div className="flex flex-col h-full overflow-hidden page-enter" style={{ background: 'var(--bg-app)' }}>
      {/* Animated background */}
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

      {/* Header */}
      <div className="relative flex-shrink-0 z-10 px-6 py-4"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
              <BarChart3 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Analytics & Insights
              </h1>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Infrastructure usage, cost, and performance metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>
              Updated {new Date().toLocaleString()}
            </span>
            <button onClick={handleRefresh}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <RefreshCw size={13} className="text-indigo-400" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: activeTab === tab.id ? '#818cf8' : 'var(--text-faint)',
                border: `1px solid ${activeTab === tab.id ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10 px-6 py-5 space-y-5">
        {/* Summary cards (always visible) */}
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard icon={<Server size={14} />} label="Total Resources" value={summary.totalResources} color="#818cf8" bg="rgba(99,102,241,0.12)" subtitle="Across all providers" />
          <SummaryCard icon={<DollarSign size={14} />} label="Total Cost" value={summary.totalCost} color="#34d399" bg="rgba(52,211,153,0.12)" subtitle="Estimated monthly spend" />
          <SummaryCard icon={<FolderOpen size={14} />} label="Active Projects" value={summary.totalProjects} color="#fbbf24" bg="rgba(251,191,36,0.12)" subtitle="Diagrams & playbooks" />
          <SummaryCard icon={<Shield size={14} />} label="Security Score" value={summary.securityScore} color="#f87171" bg="rgba(239,68,68,0.12)" subtitle="Out of 100" />
          <SummaryCard icon={<Activity size={14} />} label="Health Score" value={summary.healthScore} color="#38bdf8" bg="rgba(56,189,248,0.12)" subtitle="Infrastructure health" />
        </div>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Complexity metrics */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Infrastructure Scorecard</h2>
                <TrendingUp size={13} style={{ color: 'var(--text-faint)' }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {summary.complexityMetrics.map(m => (
                  <ComplexityGauge key={m.label} metric={m} />
                ))}
              </div>
            </div>

            {/* Category breakdown + Cost breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Resource Categories</h2>
                  <PieChart size={13} style={{ color: 'var(--text-faint)' }} />
                </div>
                <CategoryPie stats={summary.categoryStats} />
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Cost Breakdown</h2>
                  <DollarSign size={13} style={{ color: 'var(--text-faint)' }} />
                </div>
                <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.04))' }}>
                  <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>Top spender</span>
                  <span className="text-[11px] font-bold" style={{ color: '#34d399' }}>{topCost.service} — ${topCost.monthly}/mo</span>
                </div>
                <CostBar breakdown={summary.costBreakdown} />
              </div>
            </div>

            {/* Provider distribution */}
            <div className="grid grid-cols-5 gap-3">
              {summary.providerStats.map(p => (
                <div key={p.provider} className="relative rounded-xl p-3 text-center transition-all duration-300 hover:scale-[1.03]"
                  style={{ background: 'var(--bg-surface-2)', border: `1px solid ${p.color}25` }}>
                  <p className="text-lg font-extrabold" style={{ color: p.color }}>{p.percentage}%</p>
                  <p className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{p.label}</p>
                  <p className="text-[8px]" style={{ color: 'var(--text-faint)' }}>{p.count} resources</p>
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
                <Clock size={13} style={{ color: 'var(--text-faint)' }} />
              </div>
              <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                {summary.recentActivity.slice(0, 8).map(e => (
                  <ActivityItem key={e.id} event={e} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── RESOURCES TAB ───────────────────────────────────────────────── */}
        {activeTab === 'resources' && (
          <div className="grid grid-cols-2 gap-4">
            {/* Category breakdown */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs font-bold mb-4" style={{ color: 'var(--text-primary)' }}>By Category</h2>
              <CategoryPie stats={summary.categoryStats} />
            </div>
            {/* Provider breakdown */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs font-bold mb-4" style={{ color: 'var(--text-primary)' }}>By Provider</h2>
              <ProviderBar stats={summary.providerStats} />
            </div>
            {/* Resource type table */}
            <div className="rounded-xl p-4 col-span-2" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>All Resource Types</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{ color: 'var(--text-faint)' }}>
                      <th className="text-left py-1.5 px-2 font-medium">Type</th>
                      <th className="text-left py-1.5 px-2 font-medium">Category</th>
                      <th className="text-right py-1.5 px-2 font-medium">Count</th>
                      <th className="text-right py-1.5 px-2 font-medium">Monthly Cost</th>
                      <th className="text-right py-1.5 px-2 font-medium">Provider</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.resourceStats.map(r => (
                      <tr key={r.type} className="transition-all hover:brightness-125" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-2">
                            <span>{r.icon}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2" style={{ color: 'var(--text-secondary)' }}>{r.category}</td>
                        <td className="py-1.5 px-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{r.count}</td>
                        <td className="py-1.5 px-2 text-right" style={{ color: r.cost > 0 ? '#34d399' : 'var(--text-faint)' }}>${r.cost.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right">
                          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}>
                            {r.provider.toUpperCase()}
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

        {/* ── COST TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'cost' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Spend by Service</h2>
              <CostBar breakdown={summary.costBreakdown} />
            </div>
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Cost Summary</h2>
              {(() => {
                const totalMonthly = summary.costBreakdown.reduce((s, c) => s + c.monthly, 0);
                const totalYearly = summary.costBreakdown.reduce((s, c) => s + c.yearly, 0);
                return (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <div>
                        <p className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>Monthly Total</p>
                        <p className="text-lg font-extrabold" style={{ color: '#34d399' }}>${totalMonthly.toFixed(2)}</p>
                      </div>
                      <DollarSign size={20} className="text-green-400/30" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <div>
                        <p className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>Yearly Projection</p>
                        <p className="text-lg font-extrabold" style={{ color: '#818cf8' }}>${totalYearly.toFixed(2)}</p>
                      </div>
                      <ArrowUpRight size={20} className="text-indigo-400/30" />
                    </div>
                    <div className="space-y-2 mt-2">
                      <p className="text-[9px] font-medium" style={{ color: 'var(--text-faint)' }}>Provider Totals</p>
                      {summary.providerStats.filter(p => p.cost > 0).map(p => (
                        <div key={p.provider} className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
                          <span className="text-[10px] font-medium" style={{ color: p.color }}>${p.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Activity Timeline</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)' }}>
                    {summary.recentActivity.length} events
                  </span>
                </div>
              </div>
              <div className="space-y-0">
                {summary.recentActivity.map(e => (
                  <ActivityItem key={e.id} event={e} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
              <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Activity Summary</h2>
              <div className="grid grid-cols-4 gap-3">
                {['Created', 'Modified', 'Deleted', 'Deployed'].map(action => {
                  const count = summary.recentActivity.filter(e => e.action === action).length;
                  const colors: Record<string, string> = { Created: '#34d399', Modified: '#fbbf24', Deleted: '#f87171', Deployed: '#818cf8' };
                  return (
                    <div key={action} className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-lg font-extrabold" style={{ color: colors[action] }}>{count}</p>
                      <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{action}</p>
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

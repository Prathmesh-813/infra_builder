import { useNavigate } from 'react-router-dom';
import { Cpu, FileCode2, BarChart3, Settings, Layers3, LogOut, TrendingUp, Activity, Sparkles, Crown, ArrowRight, PieChart, DollarSign } from 'lucide-react';
import { useSubscriptionStore } from '../store/subscriptionStore';

const FEATURES = [
  {
    route: '/terraform',
    icon: FileCode2,
    label: 'Terraform',
    tagline: 'Design & provision',
    desc: 'Declarative infrastructure as code using HCL. Design, configure, and provision cloud resources across AWS, Azure, and GCP.',
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.06)',
    border: 'rgba(99,102,241,0.25)',
    glow: 'rgba(99,102,241,0.2)',
    gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
    darkBg: 'rgba(99,102,241,0.04)',
  },
  {
    route: '/cost-comparison',
    icon: BarChart3,
    label: 'Cost Compare',
    tagline: 'Analyze & save',
    desc: 'Multi-cloud cost analysis. Drag and drop services to compare pricing across AWS, Azure, GCP, and on-premises.',
    color: '#c084fc',
    bg: 'rgba(168,85,247,0.06)',
    border: 'rgba(168,85,247,0.25)',
    glow: 'rgba(168,85,247,0.2)',
    gradient: 'linear-gradient(135deg, #a855f7, #c084fc)',
    darkBg: 'rgba(168,85,247,0.04)',
  },
  {
    route: '/optimization',
    icon: TrendingUp,
    label: 'Compute Optimizer',
    tagline: 'AI-powered right-sizing',
    desc: 'Intelligent resource right-sizing across AWS, Azure, and GCP. Simulate utilization metrics, get upgrade/downgrade recommendations with cost impact analysis, and unlock savings instantly.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.06)',
    border: 'rgba(249,115,22,0.25)',
    glow: 'rgba(249,115,22,0.2)',
    gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
    darkBg: 'rgba(249,115,22,0.04)',
  },
  {
    route: '/monitoring',
    icon: Activity,
    label: 'Monitoring',
    tagline: 'Observe & detect',
    desc: 'Real-time infrastructure health monitoring with live utilization metrics, IaC drift detection, compliance scanning, incident tracking, and resource trend analysis across all cloud providers.',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.06)',
    border: 'rgba(56,189,248,0.25)',
    glow: 'rgba(56,189,248,0.2)',
    gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    darkBg: 'rgba(56,189,248,0.04)',
  },
  {
    route: '/ansible',
    icon: Settings,
    label: 'Ansible',
    tagline: 'Automate & manage',
    desc: 'Automation playbooks for configuration management. Build and visualize your automation workflows with drag-and-drop.',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.25)',
    glow: 'rgba(239,68,68,0.2)',
    gradient: 'linear-gradient(135deg, #ef4444, #f87171)',
    darkBg: 'rgba(239,68,68,0.04)',
  },
  {
    route: '/crossplane',
    icon: Layers3,
    label: 'Crossplane',
    tagline: 'K8s-native cloud',
    desc: 'Kubernetes-native cloud resource management. Define infrastructure using Kubernetes CRDs and manage it declaratively.',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.06)',
    border: 'rgba(56,189,248,0.25)',
    glow: 'rgba(56,189,248,0.2)',
    gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    darkBg: 'rgba(56,189,248,0.04)',
  },
  {
    route: '/analytics',
    icon: PieChart,
    label: 'Analytics',
    tagline: 'Usage & insights',
    desc: 'Infrastructure analytics and insights dashboard. Track resource usage, cost breakdowns, provider distribution, complexity metrics, and team activity across all your projects.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.25)',
    glow: 'rgba(34,197,94,0.2)',
    gradient: 'linear-gradient(135deg, #16a34a, #22c55e)',
    darkBg: 'rgba(34,197,94,0.04)',
  },
  {
    route: '/pricing',
    icon: DollarSign,
    label: 'Pricing',
    tagline: 'Plans & billing',
    desc: 'View subscription plans and pricing. Upgrade to Pro for AI-powered infrastructure generation, live pricing, cost comparison, monitoring, and priority support.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.25)',
    glow: 'rgba(245,158,11,0.2)',
    gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
    darkBg: 'rgba(245,158,11,0.04)',
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('infrastudio_logged_in');
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative page-enter" style={{ background: 'var(--bg-app)' }}>

      {/* ── Decorative background orbs ───────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
            animation: 'float-slower 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)',
            animation: 'float-slow 10s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
            animation: 'float-slower 15s ease-in-out infinite',
          }}
        />
      </div>

      {/* ── Top branding bar ──────────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-between px-8 py-5 flex-shrink-0 z-10"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.15))',
              border: '1px solid var(--accent-border)',
              boxShadow: '0 0 20px var(--accent-glow)',
            }}
          >
            <Cpu size={22} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold gradient-text tracking-tight">InfraStudio</h1>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Design. Compare. Deploy.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-soft 2s ease-in-out infinite' }} />
            All systems ready
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      {/* ── Welcome section ──────────────────────────────────────────────── */}
      <div className="relative z-10 px-8 pt-10 pb-4 flex-shrink-0">
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Welcome to <span className="gradient-text">InfraStudio</span>
        </h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
          Select a tool to start designing, comparing, and managing your cloud infrastructure
        </p>
      </div>

      {/* ── Upgrade banner (free tier only) ────────────────────────────────── */}
      {useSubscriptionStore.getState().tier === 'free' && (
        <div className="relative z-10 px-8 pb-4 flex-shrink-0">
          <div className="relative rounded-2xl overflow-hidden p-[1px]">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.3), rgba(99,102,241,0.5))' }} />
            <div className="relative rounded-2xl p-4 flex items-center justify-between gap-4"
              style={{ background: 'var(--bg-surface-2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}>
                  <Crown size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Unlock Pro Features
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Live pricing, unlimited projects, AI optimization, and more
                  </p>
                </div>
              </div>
              <button onClick={() => navigate('/pricing')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 group"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                <Sparkles size={13} />
                View Plans
                <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature cards grid ────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5 auto-rows-fr">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <button
                key={feat.route}
                onClick={() => navigate(feat.route)}
                className="group relative rounded-2xl text-left p-[1px] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  animation: `dash-card-in 0.5s ease ${idx * 0.08}s forwards`,
                  opacity: 0,
                }}
              >
                {/* Gradient border wrapper */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
                  style={{
                    background: feat.gradient,
                    filter: 'blur(1px)',
                  }}
                />

                {/* Card body */}
                <div
                  className="relative h-full rounded-2xl p-6 transition-all duration-300 overflow-hidden"
                  style={{
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {/* Hover shimmer */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `linear-gradient(105deg, transparent 40%, ${feat.color}08 50%, transparent 60%)`,
                      animation: 'shimmer-sweep 1.5s ease-in-out infinite',
                      transform: 'translateX(-100%)',
                    }}
                  />

                  <div className="flex items-start gap-5 relative z-10">
                    {/* Icon */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl"
                      style={{
                        background: feat.gradient,
                        boxShadow: `0 0 20px ${feat.glow}`,
                      }}
                    >
                      <Icon size={24} className="text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="text-base font-bold transition-colors duration-300"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {feat.label}
                        </h3>
                        <span
                          className="text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all duration-300"
                          style={{
                            background: `${feat.color}15`,
                            color: feat.color,
                            border: `1px solid ${feat.color}30`,
                          }}
                        >
                          {feat.tagline}
                        </span>
                      </div>

                      <p
                        className="text-xs leading-relaxed flex-1 transition-colors duration-300"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {feat.desc}
                      </p>

                      {/* CTA */}
                      <div
                        className="mt-4 flex items-center gap-1.5 text-xs font-semibold transition-all duration-300 group-hover:gap-3"
                        style={{ color: feat.color }}
                      >
                        Launch {feat.label}
                        <span className="text-base leading-none transition-transform duration-300 group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, FileCode2, Settings, Layers3, Cpu, Home, LogOut, TrendingUp, Activity, DollarSign, PieChart, Bot, Server, KeyRound, CalendarClock, ChevronLeft, ChevronRight, Sun, Moon, Rocket, Cloud, type LucideIcon } from 'lucide-react';
import { clearToken } from '../utils/ozClient';
import { prefetchRoute } from '../pages/lazyRoutes';
import { useTheme } from '../context/ThemeContext';
import SystemHealthMenu from './SystemHealthMenu';

interface NavItemDef { to: string; icon: LucideIcon; label: string; color: string; desc: string }

// Design & analysis (InfraStudio) modules.
const NAV_ITEMS: NavItemDef[] = [
  { to: '/terraform', icon: FileCode2, label: 'Terraform', color: '#818cf8', desc: 'HCL Infrastructure' },
  { to: '/cost-comparison', icon: BarChart3, label: 'Cost Compare', color: '#c084fc', desc: 'Cloud Cost Analysis' },
  { to: '/costing', icon: Cloud, label: 'Costing', color: '#a855f7', desc: 'K8s Cost & Architecture' },
  { to: '/deploy', icon: Rocket, label: 'Deploy', color: '#a855f7', desc: 'Deploy from Git Repo' },
  { to: '/optimization', icon: TrendingUp, label: 'Compute Optimizer', color: '#f97316', desc: 'Right-size Recommendations' },
  { to: '/monitoring', icon: Activity, label: 'Monitoring', color: '#38bdf8', desc: 'Health, Drift & Cost Alerts' },
  { to: '/analytics', icon: PieChart, label: 'Analytics', color: '#22c55e', desc: 'Usage & Infrastructure Insights' },
  { to: '/ansible', icon: Settings, label: 'Ansible', color: '#f87171', desc: 'Automation Playbooks' },
  { to: '/crossplane', icon: Layers3, label: 'Crossplane', color: '#38bdf8', desc: 'K8s-native Cloud' },
  { to: '/pricing', icon: DollarSign, label: 'Pricing', color: '#f59e0b', desc: 'Plans & Subscription' },
];

// Operations (Oz) modules — orchestrate & run the infrastructure you design.
const OPS_ITEMS: NavItemDef[] = [
  { to: '/agents', icon: Bot, label: 'Agents', color: '#a78bfa', desc: 'Launch & observe AI agents' },
  { to: '/servers', icon: Server, label: 'Servers', color: '#34d399', desc: 'Registered SSH/Docker targets' },
  { to: '/secrets', icon: KeyRound, label: 'Secrets', color: '#fbbf24', desc: 'Encrypted credential vault' },
  { to: '/schedules', icon: CalendarClock, label: 'Schedules', color: '#38bdf8', desc: 'Cron-scheduled agent runs' },
];

const STORAGE_KEY = 'infrastudio_nav_expanded';

function Tooltip({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div
      className="absolute left-full ml-3 px-3 py-2 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-2xl translate-x-[-4px] group-hover:translate-x-0"
      style={{ background: 'rgba(8,12,22,0.96)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}
    >
      <p className="text-xs font-bold" style={{ color }}>{label}</p>
      <p className="text-[9px] text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}

function ActiveBar({ color }: { color: string }) {
  return (
    <div
      className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full transition-all duration-300"
      style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
    />
  );
}

function NavItem({ item, expanded }: { item: NavItemDef; expanded: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      title={item.label}
      onMouseEnter={() => prefetchRoute(item.to)}
      className={`group relative flex items-center rounded-xl h-11 transition-all duration-200 ${expanded ? 'w-[200px] px-3 gap-3 justify-start' : 'w-11 justify-center hover:scale-110'}`}
      style={({ isActive }) => ({
        background: isActive ? `${item.color}15` : 'transparent',
        border: `1px solid ${isActive ? `${item.color}40` : 'transparent'}`,
        color: isActive ? item.color : (expanded ? '#94a3b8' : '#475569'),
        boxShadow: isActive ? `0 0 20px ${item.color}25` : 'none',
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && <ActiveBar color={item.color} />}
          <Icon size={17} className="shrink-0" />
          {expanded && <span className="text-xs font-semibold truncate">{item.label}</span>}
          {!expanded && <Tooltip color={item.color} label={item.label} desc={item.desc} />}
        </>
      )}
    </NavLink>
  );
}

// Always-available theme switch. The Header toggle only exists on the provider
// editors, so without this the Dashboard/Ops/Pricing pages fall back to the
// device's OS theme with no way to override it (the "some devices dark, some
// light" bug). Living in the persistent sidebar makes it reachable everywhere.
function ThemeToggle({ expanded }: { expanded: boolean }) {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;
  const nextLabel = isDark ? 'light' : 'dark';
  const accent = isDark ? '#fbbf24' : '#818cf8';
  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${nextLabel} mode`}
      aria-label={`Switch to ${nextLabel} mode`}
      className={`group relative flex items-center rounded-xl h-11 transition-all duration-200 hover:bg-white/5 ${expanded ? 'w-[200px] px-3 gap-3 justify-start' : 'w-11 justify-center hover:scale-110'}`}
      style={{ border: '1px solid transparent', color: accent }}
    >
      <Icon size={17} className="shrink-0" />
      {expanded && <span className="text-xs font-semibold truncate">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
      {!expanded && <Tooltip color={accent} label={isDark ? 'Light Mode' : 'Dark Mode'} desc={`Switch to ${nextLabel} theme`} />}
    </button>
  );
}

function SectionLabel({ label, expanded }: { label: string; expanded: boolean }) {
  if (!expanded) return <div className="w-8 h-px my-1.5 self-center" style={{ background: 'var(--border-subtle)' }} />;
  return <p className="text-[9px] font-bold uppercase tracking-wider px-3 mt-3 mb-1" style={{ color: 'var(--text-faint)' }}>{label}</p>;
}

export default function DashboardNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
  });

  const toggle = () => setExpanded((v) => {
    const next = !v;
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  const handleLogout = () => {
    localStorage.removeItem('infrastudio_logged_in');
    clearToken();
    window.location.reload();
  };

  return (
    <nav
      className={`flex flex-col py-3 gap-0.5 flex-shrink-0 border-r z-30 overflow-y-auto overflow-x-hidden transition-[width] duration-300 ease-in-out ${expanded ? 'items-start px-3' : 'items-center'}`}
      style={{
        width: expanded ? 224 : 56,
        background: 'linear-gradient(180deg, rgba(8,12,22,0.99) 0%, rgba(6,9,18,0.99) 100%)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center mb-1 ${expanded ? 'w-[200px] gap-2.5' : 'flex-col gap-2'}`}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 hover:scale-110 hover:rotate-3"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid var(--accent-border)',
            boxShadow: '0 0 12px var(--accent-glow)',
            animation: 'border-glow 4s ease-in-out infinite',
          }}
        >
          <Cpu size={16} style={{ color: 'var(--accent-light)' }} />
        </div>
        {expanded && <span className="text-sm font-extrabold gradient-text flex-1 truncate">InfraStudio</span>}
        <button
          onClick={toggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse' : 'Expand'}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: '#64748b', border: '1px solid var(--border-subtle)' }}
        >
          {expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>

      <SectionLabel label="Workspace" expanded={expanded} />

      {/* Home / Back to Dashboard */}
      <NavLink
        to="/dashboard"
        title="Dashboard"
        onMouseEnter={() => prefetchRoute('/dashboard')}
        className={`group relative flex items-center rounded-xl h-11 transition-all duration-200 ${expanded ? 'w-[200px] px-3 gap-3 justify-start' : 'w-11 justify-center hover:scale-110'}`}
        style={({ isActive }) => ({
          background: isActive ? '#22c55e15' : 'transparent',
          border: `1px solid ${isActive ? '#22c55e40' : 'transparent'}`,
          color: isActive ? '#22c55e' : (expanded ? '#94a3b8' : '#475569'),
          boxShadow: isActive ? '0 0 16px rgba(34,197,94,0.2)' : 'none',
        })}
      >
        {isActive('/dashboard') && <ActiveBar color="#22c55e" />}
        <Home size={17} className="shrink-0" />
        {expanded && <span className="text-xs font-semibold truncate">Dashboard</span>}
        {!expanded && <Tooltip color="#22c55e" label="Dashboard" desc="Back to Home" />}
      </NavLink>

      <SectionLabel label="Design" expanded={expanded} />
      {NAV_ITEMS.map((item) => <NavItem key={item.to} item={item} expanded={expanded} />)}

      <SectionLabel label="Operations" expanded={expanded} />
      {OPS_ITEMS.map((item) => <NavItem key={item.to} item={item} expanded={expanded} />)}

      {/* Spacer */}
      <div className="flex-1 min-h-[12px]" />

      {/* System health (replaces the old static "All systems ready") */}
      <SystemHealthMenu expanded={expanded} />

      {/* Dedicated theme switch — available on every route via the sidebar. */}
      <ThemeToggle expanded={expanded} />

      <SectionLabel label="" expanded={false} />

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        title="Sign Out"
        aria-label="Sign Out"
        className={`group relative flex items-center rounded-xl h-11 transition-all duration-200 hover:bg-red-500/10 ${expanded ? 'w-[200px] px-3 gap-3 justify-start' : 'w-11 justify-center hover:scale-110'}`}
        style={{ border: '1px solid transparent', color: '#ef4444' }}
      >
        <LogOut size={17} className="shrink-0" />
        {expanded && <span className="text-xs font-semibold">Sign Out</span>}
        {!expanded && <Tooltip color="#ef4444" label="Sign Out" desc="Log out of your account" />}
      </button>
    </nav>
  );
}

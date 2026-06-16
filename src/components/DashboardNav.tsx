import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, FileCode2, Settings, Layers3, Cpu, Home, LogOut, TrendingUp, Activity, DollarSign } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/terraform', icon: FileCode2, label: 'Terraform', color: '#818cf8', desc: 'HCL Infrastructure' },
  { to: '/cost-comparison', icon: BarChart3, label: 'Cost Compare', color: '#c084fc', desc: 'Cloud Cost Analysis' },
  { to: '/optimization', icon: TrendingUp, label: 'Compute Optimizer', color: '#f97316', desc: 'Right-size Recommendations' },
  { to: '/monitoring', icon: Activity, label: 'Monitoring', color: '#38bdf8', desc: 'Health, Drift & Cost Alerts' },
  { to: '/ansible', icon: Settings, label: 'Ansible', color: '#f87171', desc: 'Automation Playbooks' },
  { to: '/crossplane', icon: Layers3, label: 'Crossplane', color: '#38bdf8', desc: 'K8s-native Cloud' },
  { to: '/pricing', icon: DollarSign, label: 'Pricing', color: '#f59e0b', desc: 'Plans & Subscription' },
];

function Tooltip({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div
      className="absolute left-full ml-3 px-3 py-2 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-2xl translate-x-[-4px] group-hover:translate-x-0"
      style={{
        background: 'rgba(8,12,22,0.96)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
      }}
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

export default function DashboardNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem('infrastudio_logged_in');
    window.location.reload();
  };

  return (
    <nav
      className="flex flex-col items-center py-3 gap-1 w-[56px] flex-shrink-0 border-r z-30"
      style={{
        background: 'linear-gradient(180deg, rgba(8,12,22,0.99) 0%, rgba(6,9,18,0.99) 100%)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 hover:scale-110 hover:rotate-3"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid var(--accent-border)',
          boxShadow: '0 0 12px var(--accent-glow)',
          animation: 'border-glow 4s ease-in-out infinite',
        }}
      >
        <Cpu size={16} style={{ color: 'var(--accent-light)' }} />
      </div>

      <div className="w-8 h-px mb-1" style={{ background: 'var(--border-subtle)' }} />

      {/* Home / Back to Dashboard */}
      <NavLink
        to="/dashboard"
        title="Dashboard"
        className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 relative group hover:scale-110"
        style={({ isActive }) => ({
          background: isActive ? '#22c55e15' : 'transparent',
          border: `1px solid ${isActive ? '#22c55e40' : 'transparent'}`,
          color: isActive ? '#22c55e' : '#475569',
          boxShadow: isActive ? '0 0 16px rgba(34,197,94,0.2)' : 'none',
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        })}
      >
        {isActive('/dashboard') && <ActiveBar color="#22c55e" />}
        <Home size={17} />
        <Tooltip color="#22c55e" label="Dashboard" desc="Back to Home" />
      </NavLink>

      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.label}
          className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 relative group hover:scale-110"
          style={({ isActive }) => ({
            background: isActive ? `${item.color}15` : 'transparent',
            border: `1px solid ${isActive ? `${item.color}40` : 'transparent'}`,
            color: isActive ? item.color : '#475569',
            boxShadow: isActive ? `0 0 20px ${item.color}25` : 'none',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          })}
        >
          {isActive(item.to) && <ActiveBar color={item.color} />}
          <item.icon size={17} />
          <Tooltip color={item.color} label={item.label} desc={item.desc} />
        </NavLink>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        title="Sign Out"
        className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 relative group hover:scale-110 hover:bg-red-500/10 hover:border-red-500/30"
        style={{
          border: '1px solid transparent',
          color: '#ef4444',
        }}
      >
        <LogOut size={17} />
        <Tooltip color="#ef4444" label="Sign Out" desc="Log out of your account" />
      </button>
    </nav>
  );
}

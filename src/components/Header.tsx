import { Layout, ChevronDown, Cpu, ScanLine, Sun, Moon, Cloud } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTheme } from '../context/ThemeContext';
import ProviderIcon from './ProviderIcon';

const REGIONS: Record<string, string[]> = {
  aws:        ['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-west-2','eu-central-1','ap-south-1','ap-southeast-1','ap-northeast-1','ca-central-1','sa-east-1'],
  azure:      ['East US','East US 2','West US','West US 2','West Europe','North Europe','Southeast Asia','Australia East','UK South','Canada Central','Japan East','Brazil South'],
  gcp:        ['us-central1','us-east1','us-west1','us-west2','europe-west1','europe-west2','europe-west3','asia-east1','asia-southeast1','asia-northeast1','australia-southeast1'],
  ansible:    ['localhost'],
  crossplane: ['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','East US','East US 2','West Europe','us-central1','europe-west1'],
};

const PROVIDER_META: Record<string, { label: string; icon: string; accent: string }> = {
  aws:         { label: 'AWS Terraform',    icon: 'aws', accent: 'from-orange-500 to-amber-500'   },
  azure:       { label: 'Azure Terraform',  icon: 'azure', accent: 'from-blue-500 to-cyan-500'      },
  gcp:         { label: 'GCP Terraform',    icon: 'gcp', accent: 'from-red-500 to-rose-500'       },
  ansible:     { label: 'Ansible Playbook', icon: '⚙️', accent: 'from-red-700 to-red-500'        },
  crossplane:  { label: 'Crossplane K8s',   icon: '⎈',  accent: 'from-sky-500 to-blue-600'       },
  costcompare: { label: 'Cost Comparison',  icon: '📊', accent: 'from-purple-500 to-violet-500'  },
};

interface HeaderProps {
  dashboard?: 'terraform' | 'ansible' | 'crossplane' | 'costcompare';
  onOpenTemplates?: () => void;
  onOpenDiagramScan?: () => void;
  onOpenImport?: () => void;
}

export default function Header({ dashboard, onOpenTemplates, onOpenDiagramScan, onOpenImport }: HeaderProps) {
  const { providerRegion, providerProfile, setProviderRegion, setProviderProfile, nodes, cloudProvider } = useStore();
  const { theme, toggleTheme, isDark } = useTheme();
  const regions = REGIONS[cloudProvider] ?? REGIONS.aws;
  const meta = PROVIDER_META[cloudProvider] ?? PROVIDER_META.aws;
  const isAnsible = cloudProvider === 'ansible';
  const isCostCompare = cloudProvider === 'costcompare';

  return (
    <header
      className="relative flex items-center justify-between gap-4 px-5 py-2.5 z-20 flex-shrink-0"
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)',
        boxShadow: 'var(--header-shadow)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${meta.accent} opacity-80 shimmer-hover`}
        style={{ boxShadow: '0 0 12px rgba(168,85,247,0.15)' }}
      />

      {/* Ambient glow behind logo */}
      <div
        className="absolute left-8 top-1/2 -translate-y-1/2 w-24 h-24 pointer-events-none opacity-15"
        style={{
          background: `radial-gradient(circle, ${meta.accent.includes('purple') ? '#a855f7' : meta.accent.includes('emerald') ? '#22c55e' : '#6366f1'} 0%, transparent 70%)`,
          animation: 'float-slow 6s ease-in-out infinite',
        }}
      />

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
            border: '1px solid var(--accent-border)',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <Cpu size={18} style={{ color: 'var(--accent-light)' }} />
        </div>
        <div>
          <h1 className="font-bold text-[15px] leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Infrastructure <span className="gradient-text">Visual Builder</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {['aws','azure','gcp','onprem'].includes(meta.icon) ? <ProviderIcon provider={meta.icon as any} size={14} /> : <span className="text-[10px]">{meta.icon}</span>}
            <span className={`text-[10px] font-semibold bg-gradient-to-r ${meta.accent} bg-clip-text text-transparent`}>
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Centre ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {dashboard === 'terraform' && onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              boxShadow: '0 0 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <Layout size={13} className="text-indigo-200" />
            <span className="text-white">Templates</span>
          </button>
        )}

        {dashboard === 'terraform' && onOpenImport && (
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all group"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%)',
              border: '1px solid rgba(99,102,241,0.35)',
            }}
            title="Connect to cloud provider APIs, discover existing resources, and generate Terraform HCL"
          >
            <Cloud size={13} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span className="text-indigo-600 dark:text-indigo-300 group-hover:text-indigo-500 transition-colors" style={{ color: isDark ? '#a5b4fc' : '#6366f1' }}>
              Import Infra
            </span>
            <span
              className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              NEW
            </span>
          </button>
        )}

        {dashboard === 'terraform' && onOpenDiagramScan && (
          <button
            onClick={onOpenDiagramScan}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all group"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(56,189,248,0.1) 100%)',
              border: '1px solid rgba(52,211,153,0.35)',
            }}
            title="Upload PNG, JPEG or Draw.io diagram and get Terraform code"
          >
            <ScanLine size={13} className="text-emerald-500 group-hover:text-emerald-400 transition-colors" />
            <span className="text-emerald-600 dark:text-emerald-300 group-hover:text-emerald-500 transition-colors" style={{ color: isDark ? '#6ee7b7' : '#059669' }}>
              Scan Diagram
            </span>
            <span
              className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(52,211,153,0.2)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.3)' }}
            >
              NEW
            </span>
          </button>
        )}

        {/* Resource count badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
        >
          <span
            className="text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #818cf8, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {nodes.length}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {isAnsible ? 'task' : isCostCompare ? 'service' : 'resource'}{nodes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Right controls ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {!isAnsible && !isCostCompare && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Region</span>
            <div className="relative">
              <select
                value={providerRegion}
                onChange={(e) => setProviderRegion(e.target.value)}
                className="appearance-none text-[11px] font-medium pl-3 pr-7 py-1.5 rounded-lg border transition-all cursor-pointer"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-input)',
                  color: 'var(--text-primary)',
                }}
              >
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        )}

        {cloudProvider === 'aws' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Profile</span>
            <input
              type="text"
              value={providerProfile}
              onChange={(e) => setProviderProfile(e.target.value)}
              className="text-[11px] px-3 py-1.5 rounded-lg w-24 transition-all"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
              placeholder="default"
            />
          </div>
        )}

        {cloudProvider === 'gcp' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Project</span>
            <input
              type="text"
              value={providerProfile}
              onChange={(e) => setProviderProfile(e.target.value)}
              className="text-[11px] px-3 py-1.5 rounded-lg w-32 transition-all"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
              placeholder="my-gcp-project"
            />
          </div>
        )}

        {cloudProvider === 'azure' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Subscription</span>
            <input
              type="text"
              value={providerProfile}
              onChange={(e) => setProviderProfile(e.target.value)}
              className="text-[11px] px-3 py-1.5 rounded-lg w-32 transition-all"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
              placeholder="subscription-id"
            />
          </div>
        )}

        {/* ── Theme toggle ──────────────────────────────────────────────── */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          className="theme-toggle flex items-center"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #1e293b, #0f172a)'
              : 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
            border: `1px solid ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
            boxShadow: isDark ? '0 0 12px rgba(99,102,241,0.2)' : '0 2px 8px rgba(99,102,241,0.15)',
          }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <div
            className="theme-toggle-thumb"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              boxShadow: isDark
                ? '0 0 8px rgba(99,102,241,0.5)'
                : '0 0 8px rgba(251,191,36,0.5)',
            }}
          >
            {isDark ? <Moon size={10} className="text-white" /> : <Sun size={10} className="text-white" />}
          </div>
        </button>
      </div>
    </header>
  );
}

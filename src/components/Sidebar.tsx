import { useState, useEffect } from 'react';
import { Zap, Search, X, AlertTriangle, FileCode2, Settings, Layers3, BarChart3 } from 'lucide-react';
import { RESOURCE_DEFINITIONS, CATEGORIES } from '../data/resourceDefinitions';
import { AZURE_DEFINITIONS, AZURE_CATEGORIES } from '../data/azureDefinitions';
import { GCP_DEFINITIONS, GCP_CATEGORIES } from '../data/gcpDefinitions';
import { ANSIBLE_DEFINITIONS, ANSIBLE_CATEGORIES } from '../data/ansibleDefinitions';
import {
  CROSSPLANE_CATEGORIES,
  CROSSPLANE_AWS_DEFINITIONS,
  CROSSPLANE_AZURE_DEFINITIONS,
  CROSSPLANE_GCP_DEFINITIONS,
} from '../data/crossplaneDefinitions';
import { COMPARISON_SERVICES, COMPARISON_CATEGORIES, ComparisonProvider } from '../data/costComparisonData';
import { ResourceDefinition } from '../types/resources';
import { useStore, CloudProvider, CrossplaneCloud } from '../store/useStore';
import ProviderIcon from './ProviderIcon';

// ─── Provider tabs for cost compare sidebar ───────────────────────────────────
const CC_PROVIDERS: Array<{ id: ComparisonProvider; label: string; icon: string; color: string; bg: string; border: string }> = [
  { id: 'aws',    label: 'AWS',     icon: 'aws', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.45)' },
  { id: 'azure',  label: 'Azure',   icon: 'azure', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.45)' },
  { id: 'gcp',    label: 'GCP',     icon: 'gcp', color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.45)'  },
  { id: 'onprem', label: 'On-Prem', icon: 'onprem', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.45)' },
];

function CostCompareSidebar() {
  const [activeProvider, setActiveProvider] = useState<ComparisonProvider>('aws');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');

  const tab = CC_PROVIDERS.find(p => p.id === activeProvider)!;
  const svcs = COMPARISON_SERVICES.filter(s => s.providers.some(p => p.provider === activeProvider));
  const cats = ['All', ...Array.from(new Set(svcs.map(s => s.category)))];
  const filtered = svcs.filter(s =>
    (cat === 'All' || s.category === cat) &&
    (!search || s.serviceName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDragStart = (e: React.DragEvent, serviceId: string) => {
    // Set BOTH keys so CostComparisonPanel drop handler can read it
    e.dataTransfer.setData('application/compareServiceId', serviceId);
    e.dataTransfer.setData('application/resourceType', serviceId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <>
      {/* Provider tabs */}
      <div className="grid grid-cols-4 border-b border-white/[0.05] flex-shrink-0">
        {CC_PROVIDERS.map(p => {
          const isActive = activeProvider === p.id;
          return (
            <button key={p.id} onClick={() => setActiveProvider(p.id)}
              className="flex flex-col items-center gap-0.5 py-2.5 transition-all"
              style={isActive
                ? { background: p.bg, color: p.color, borderBottom: `2px solid ${p.color}` }
                : { color: '#475569', borderBottom: '2px solid transparent' }
              }>
              <ProviderIcon provider={p.icon as any} size={18} />
              <span className="text-[8px] font-bold leading-tight">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Provider banner */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
        style={{ background: tab.bg, borderBottom: `1px solid ${tab.border}` }}>
        <ProviderIcon provider={tab.icon as any} size={18} />
        <p className="text-[10px] font-bold" style={{ color: tab.color }}>{tab.label} Services</p>
        <p className="text-[9px] text-gray-500 ml-auto">{filtered.length} available</p>
      </div>

      {/* Search + category */}
      <div className="px-2 py-1.5 flex-shrink-0 space-y-1">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input type="text" placeholder="Search services…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-[10px] pl-7 pr-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#d1d5db' }} />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className="text-[8px] px-2 py-0.5 rounded-lg whitespace-nowrap font-medium flex-shrink-0 transition-all"
              style={cat === c
                ? { background: tab.bg, color: tab.color, border: `1px solid ${tab.border}` }
                : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid transparent' }
              }>{c}</button>
          ))}
        </div>
      </div>

      {/* Service cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {filtered.map(svc => {
          const p = svc.providers.find(pr => pr.provider === activeProvider)!;
          const defaultCfg: Record<string, string | number | boolean> = {};
          p.fields.forEach(f => { if (f.default !== undefined) defaultCfg[f.key] = f.default; });
          const est = p.estimate(defaultCfg);
          const avgCost = (est.min + est.max) / 2;
          return (
            <div key={svc.id} draggable onDragStart={e => handleDragStart(e, svc.id)}
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-grab active:cursor-grabbing select-none border transition-all hover:scale-[1.01] hover:border-white/20"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
              title={svc.description}>
              <span className="text-lg flex-shrink-0">{svc.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold truncate ${svc.color}`}>{svc.serviceName}</p>
                <p className="text-[9px] text-gray-600 truncate">{p.serviceLabel}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[10px] font-bold" style={{ color: tab.color }}>${avgCost.toFixed(0)}/mo</p>
                <p className="text-[8px] text-gray-600">drag →</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-white/[0.05] flex items-center justify-between flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.25)' }}>
        <p className="text-[9px] text-gray-600">{filtered.length} / {svcs.length} services</p>
        <p className="text-[9px] text-gray-700">drag to compare →</p>
      </div>
    </>
  );
}// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ToolMode = 'terraform' | 'ansible' | 'crossplane' | 'costcompare';
type TerraformCloud = 'aws' | 'azure' | 'gcp';

// ─────────────────────────────────────────────────────────────────────────────
// Static config
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_MODES: Array<{
  id: ToolMode;
  label: string;
  icon: React.ReactNode;
  desc: string;
  accent: string;
  glow: string;
  border: string;
  bg: string;
}> = [
  {
    id: 'terraform',
    label: 'Terraform',
    icon: <FileCode2 size={15} />,
    desc: 'HCL infrastructure as code',
    accent: '#818cf8',
    glow: 'rgba(99,102,241,0.35)',
    border: 'rgba(99,102,241,0.5)',
    bg: 'rgba(99,102,241,0.12)',
  },
  {
    id: 'ansible',
    label: 'Ansible',
    icon: <Settings size={15} />,
    desc: 'Automation playbooks',
    accent: '#f87171',
    glow: 'rgba(239,68,68,0.35)',
    border: 'rgba(239,68,68,0.5)',
    bg: 'rgba(239,68,68,0.12)',
  },
  {
    id: 'crossplane',
    label: 'Crossplane',
    icon: <Layers3 size={15} />,
    desc: 'Kubernetes-native cloud',
    accent: '#38bdf8',
    glow: 'rgba(14,165,233,0.35)',
    border: 'rgba(14,165,233,0.5)',
    bg: 'rgba(14,165,233,0.12)',
  },
  {
    id: 'costcompare',
    label: 'Cost Compare',
    icon: <BarChart3 size={15} />,
    desc: 'Cloud cost comparison',
    accent: '#c084fc',
    glow: 'rgba(168,85,247,0.35)',
    border: 'rgba(168,85,247,0.5)',
    bg: 'rgba(139,92,246,0.12)',
  },
];

const CLOUD_PROVIDERS: Array<{
  id: TerraformCloud;
  label: string;
  icon: string;
  color: string;
  glow: string;
  border: string;
  bg: string;
}> = [
  { id: 'aws',   label: 'AWS',   icon: 'aws', color: '#fb923c', glow: 'rgba(249,115,22,0.3)',  border: 'rgba(249,115,22,0.5)',  bg: 'rgba(249,115,22,0.12)'  },
  { id: 'azure', label: 'Azure', icon: 'azure', color: '#60a5fa', glow: 'rgba(59,130,246,0.3)',  border: 'rgba(59,130,246,0.5)',  bg: 'rgba(59,130,246,0.12)'  },
  { id: 'gcp',   label: 'GCP',   icon: 'gcp', color: '#f87171', glow: 'rgba(239,68,68,0.3)',   border: 'rgba(239,68,68,0.5)',   bg: 'rgba(239,68,68,0.12)'   },
];

// Terraform resource definitions per cloud
const TF_DEFS: Record<TerraformCloud, { defs: ResourceDefinition[]; cats: readonly string[] }> = {
  aws:   { defs: RESOURCE_DEFINITIONS,              cats: CATEGORIES      },
  azure: { defs: AZURE_DEFINITIONS as ResourceDefinition[], cats: AZURE_CATEGORIES },
  gcp:   { defs: GCP_DEFINITIONS   as ResourceDefinition[], cats: GCP_CATEGORIES   },
};

// Crossplane resource definitions per cloud
const XP_DEFS: Record<CrossplaneCloud, { defs: ResourceDefinition[]; cats: readonly string[] }> = {
  aws:   { defs: CROSSPLANE_AWS_DEFINITIONS   as ResourceDefinition[], cats: CROSSPLANE_CATEGORIES },
  azure: { defs: CROSSPLANE_AZURE_DEFINITIONS as ResourceDefinition[], cats: CROSSPLANE_CATEGORIES },
  gcp:   { defs: CROSSPLANE_GCP_DEFINITIONS   as ResourceDefinition[], cats: CROSSPLANE_CATEGORIES },
};

// Map (mode + cloud) → CloudProvider store value
const MODE_CLOUD_TO_PROVIDER: Record<string, CloudProvider> = {
  'terraform-aws':   'aws',
  'terraform-azure': 'azure',
  'terraform-gcp':   'gcp',
  'ansible-ansible': 'ansible',
  'crossplane-aws':  'crossplane',
  'crossplane-azure':'crossplane',
  'crossplane-gcp':  'crossplane',
  'costcompare-costcompare': 'costcompare',
};

const CAT_ICONS: Record<string, string> = {
  All: '✦', Compute: '🖥️', Storage: '💾', Network: '🌐', Database: '🗄️',
  Serverless: '⚡', Security: '🔒', Monitoring: '📊', Analytics: '📈',
  'AI/ML': '🤖', DevOps: '🔧', Messaging: '📨', Container: '📦',
  Identity: '🪪', Integration: '🔗', Inventory: '📋', Packages: '📦',
  Services: '⚙️', Files: '📁', Commands: '💻', Users: '👤',
  Deployment: '🚀', Docker: '🐳', Control: '🎛️',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  onDragStart: (e: React.DragEvent, definition: ResourceDefinition) => void;
  onOpenBlueprints: () => void;
  fixedMode?: 'terraform' | 'ansible' | 'crossplane' | 'costcompare';
}

export default function Sidebar({ onDragStart, onOpenBlueprints, fixedMode }: SidebarProps) {
  const { cloudProvider, setCloudProvider, nodes } = useStore();

  // Derive initial mode + cloud from current store provider
  const initMode = (): ToolMode => {
    if (fixedMode) return fixedMode;
    if (cloudProvider === 'ansible') return 'ansible';
    if (cloudProvider === 'crossplane') return 'crossplane';
    if (cloudProvider === 'costcompare') return 'costcompare';
    return 'terraform';
  };
  const initCloud = (): TerraformCloud => {
    if (cloudProvider === 'azure') return 'azure';
    if (cloudProvider === 'gcp') return 'gcp';
    return 'aws';
  };

  const [mode, setMode] = useState<ToolMode>(initMode);
  const [tfCloud, setTfCloud] = useState<TerraformCloud>(initCloud);

  useEffect(() => {
    if (fixedMode) setMode(fixedMode);
  }, [fixedMode]);
  const xpCloud = useStore((s) => s.crossplaneCloud);
  const setXpCloud = useStore((s) => s.setCrossplaneCloud);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState<{ mode: ToolMode; cloud?: TerraformCloud | CrossplaneCloud } | null>(null);

  // ── Derived active definitions ─────────────────────────────────────────────
  const { activeDefs, activeCategories } = (() => {
    if (mode === 'terraform') return { activeDefs: TF_DEFS[tfCloud].defs, activeCategories: TF_DEFS[tfCloud].cats };
    if (mode === 'ansible')   return { activeDefs: ANSIBLE_DEFINITIONS as ResourceDefinition[], activeCategories: ANSIBLE_CATEGORIES };
    if (mode === 'costcompare') return {
      activeDefs: COMPARISON_SERVICES.map(s => ({
        type: s.id as any,
        label: s.serviceName,
        icon: s.icon,
        color: s.color,
        bgColor: s.bgColor,
        borderColor: 'border-purple-500',
        category: s.category as any,
        fields: [],
        description: s.description,
        ports: [],
      })),
      activeCategories: COMPARISON_CATEGORIES.map(c => c.name),
    };
    return { activeDefs: XP_DEFS[xpCloud].defs, activeCategories: XP_DEFS[xpCloud].cats };
  })();

  const filtered = activeDefs.filter((def) => {
    const matchCat = activeCategory === 'All' || def.category === activeCategory;
    const matchSearch = !search ||
      def.label.toLowerCase().includes(search.toLowerCase()) ||
      def.type.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Active accent colors ───────────────────────────────────────────────────
  const activeTool = TOOL_MODES.find(t => t.id === mode)!;
  const activeCloud = mode === 'terraform'
    ? CLOUD_PROVIDERS.find(c => c.id === tfCloud)!
    : mode === 'crossplane'
    ? CLOUD_PROVIDERS.find(c => c.id === xpCloud)!
    : null;

  // ── Switch handler ─────────────────────────────────────────────────────────
  const doSwitch = (newMode: ToolMode, newCloud?: TerraformCloud | CrossplaneCloud) => {
    const key = newMode === 'ansible' ? 'ansible-ansible'
      : newMode === 'costcompare' ? 'costcompare-costcompare'
      : `${newMode}-${newCloud ?? 'aws'}`;
    const newProvider = MODE_CLOUD_TO_PROVIDER[key] ?? 'aws';

    setMode(newMode);
    if (newMode === 'terraform' && newCloud) setTfCloud(newCloud as TerraformCloud);
    if (newMode === 'crossplane' && newCloud) setXpCloud(newCloud as CrossplaneCloud);
    setActiveCategory('All');
    setSearch('');
    setCloudProvider(newProvider);
  };

  const requestSwitch = (newMode: ToolMode, newCloud?: TerraformCloud | CrossplaneCloud) => {
    const sameMode = newMode === mode;
    const sameCloud = newMode === 'terraform'
      ? newCloud === tfCloud
      : newMode === 'crossplane'
      ? newCloud === xpCloud
      : newMode === 'costcompare'
      ? true
      : true;
    if (sameMode && sameCloud) return;

    if (nodes.length > 0) {
      setConfirmSwitch({ mode: newMode, cloud: newCloud });
    } else {
      doSwitch(newMode, newCloud);
    }
  };

  const ambGlow = activeTool?.accent ?? '#818cf8';

  return (
    <aside
      className="w-72 flex flex-col h-full flex-shrink-0 relative"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Ambient glow for active mode */}
      <div
        className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(circle, ${ambGlow} 0%, transparent 70%)`,
          animation: 'float-slow 5s ease-in-out infinite',
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          LEVEL 1 — Tool mode selector: Terraform / Ansible / Crossplane
      ══════════════════════════════════════════════════════════════════════ */}
      {!fixedMode && (<div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-[9px] uppercase font-bold mb-2 tracking-widest" style={{ color: 'var(--text-faint)' }}>
          Tool
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {TOOL_MODES.map((t) => {
            const isActive = mode === t.id;
            return (
              <button
                key={t.id}
                  onClick={() => requestSwitch(t.id, t.id === 'costcompare' ? undefined : t.id === 'terraform' ? tfCloud : xpCloud)}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all"
                style={isActive ? {
                  background: t.bg,
                  border: `1px solid ${t.border}`,
                  boxShadow: `0 0 16px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  color: t.accent,
                } : {
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#475569',
                }}
              >
                <span className={`transition-colors ${isActive ? '' : 'opacity-50'}`}>{t.icon}</span>
                <span className="text-[10px] font-bold leading-tight">{t.label}</span>
                <span
                  className="text-[8px] leading-tight text-center"
                  style={{ color: isActive ? t.accent : '#334155', opacity: isActive ? 0.8 : 1 }}
                >
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>)}

      {/* ══════════════════════════════════════════════════════════════════════
          LEVEL 2 — Cloud provider selector (hidden for Ansible / Cost Compare)
      ══════════════════════════════════════════════════════════════════════ */}
      {mode !== 'ansible' && mode !== 'costcompare' && (
        <div className="px-3 py-2.5 border-b border-white/[0.05]">
          <p className="text-[9px] text-gray-600 uppercase font-bold mb-2 tracking-widest">
            Cloud Provider
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {CLOUD_PROVIDERS.map((cp) => {
              const isActive = mode === 'terraform' ? tfCloud === cp.id : xpCloud === cp.id;
              const defsCount = mode === 'terraform'
                ? TF_DEFS[cp.id].defs.length
                : XP_DEFS[cp.id].defs.length;
              return (
                <button
                  key={cp.id}
                  onClick={() => requestSwitch(mode, cp.id)}
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all"
                  style={isActive ? {
                    background: cp.bg,
                    border: `1px solid ${cp.border}`,
                    boxShadow: `0 0 12px ${cp.glow}`,
                    color: cp.color,
                  } : {
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: '#475569',
                  }}
                >
                  <ProviderIcon provider={cp.icon as any} size={24} />
                  <span className="text-[10px] font-bold">{cp.label}</span>
                  <span
                    className="text-[8px]"
                    style={{ color: isActive ? cp.color : '#334155', opacity: 0.8 }}
                  >
                    {defsCount} res
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active provider + mode info strip */}
          <div
            className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
            style={{
              background: activeCloud ? activeCloud.bg : activeTool.bg,
              border: `1px solid ${activeCloud ? activeCloud.border : activeTool.border}`,
            }}
          >
            <span className="text-base leading-none">{activeCloud?.icon ?? '⎈'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold leading-tight" style={{ color: activeCloud?.color ?? activeTool.accent }}>
                {activeCloud?.label ?? ''} {mode === 'crossplane' ? 'via Crossplane' : 'Terraform'}
              </p>
              <p className="text-[9px] text-gray-600 truncate">
                {mode === 'crossplane'
                  ? `upbound/provider-${xpCloud}`
                  : `hashicorp/provider-${tfCloud === 'aws' ? 'aws' : tfCloud === 'azure' ? 'azurerm' : 'google'}`}
              </p>
            </div>
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: activeTool.bg,
                color: activeTool.accent,
                border: `1px solid ${activeTool.border}`,
              }}
            >
              {mode === 'terraform' ? 'HCL' : 'K8s'}
            </span>
          </div>
        </div>
      )}

      {/* Ansible info banner */}
      {mode === 'ansible' && (
        <div className="px-3 py-2.5 border-b border-white/[0.05]">
          <div
            className="rounded-xl p-2.5"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Settings size={12} className="text-red-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-red-400">Ansible Playbook Mode</span>
            </div>
            <p className="text-[9px] text-gray-500 leading-relaxed">
              Drag tasks onto the canvas. Connect <span className="text-red-400 font-medium">Host Group</span> → Tasks to build your playbook.
            </p>
          </div>
        </div>
      )}

      {/* Cost Compare info banner — hidden, CostCompareSidebar shows below instead */}

      {/* ══════════════════════════════════════════════════════════════════════
          LEVEL 3 — Quick actions + Search + Category filter + Resource list
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Cost Compare: provider tabs + service palette */}
      {mode === 'costcompare' && <CostCompareSidebar />}

      {/* Quick Setup button (AWS Terraform only) */}
      {mode !== 'costcompare' && mode === 'terraform' && tfCloud === 'aws' && (
        <div className="px-3 pt-2.5 pb-0">
          <button
            onClick={onOpenBlueprints}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Zap size={13} className="text-yellow-300 flex-shrink-0" />
            <span className="text-white flex-1 text-left">Quick Setup</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#c7d2fe' }}
            >
              blueprints
            </span>
          </button>
        </div>
      )}

      {/* Search + categories + cards — hidden in costcompare mode */}
      {mode !== 'costcompare' && (<>
      {/* Search */}
      <div className="px-3 py-2.5">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${
              mode === 'ansible' ? 'Ansible'
              : mode === 'crossplane' ? `Crossplane ${CLOUD_PROVIDERS.find(c => c.id === xpCloud)?.label}`
              : CLOUD_PROVIDERS.find(c => c.id === tfCloud)?.label
            } resources…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-[11px] text-gray-300 pl-8 pr-8 py-2 rounded-lg transition-all placeholder:text-gray-600"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Category filter tabs */}
      <div
        className="flex flex-wrap gap-1 px-2 pb-2 border-b border-white/[0.05]"
        style={{ maxHeight: 84, overflowY: 'auto' }}
      >
        {['All', ...activeCategories].map((cat) => {
          const count = cat === 'All'
            ? activeDefs.length
            : activeDefs.filter((d) => d.category === cat).length;
          const isActive = activeCategory === cat;
          const accent = activeCloud?.color ?? activeTool.accent;
          const border = activeCloud?.border ?? activeTool.border;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg transition-all font-medium whitespace-nowrap"
              style={isActive ? {
                background: `${activeCloud?.bg ?? activeTool.bg}`,
                border: `1px solid ${border}`,
                color: accent,
              } : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#64748b',
              }}
            >
              <span>{CAT_ICONS[cat] ?? '▸'}</span>
              {cat}
              <span
                className="text-[8px] px-1 rounded-full"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#fff' : '#475569',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Resource cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-3xl opacity-20">🔍</span>
            <p className="text-gray-600 text-[11px]">No resources found</p>
          </div>
        )}
        {filtered.map((def) => (
          <div
            key={def.type + def.label}
            draggable
            onDragStart={(e) => onDragStart(e, def)}
            className={`resource-card ${def.bgColor} border rounded-xl p-2.5 cursor-grab active:cursor-grabbing select-none`}
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            title={def.description}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-lg leading-none"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {def.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-[11px] ${def.color} leading-tight truncate`}>
                  {def.label}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5 truncate">{def.category}</div>
              </div>
              {def.ports.length > 0 && (
                <div
                  className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.3)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {def.ports.length}p
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-3 py-2 border-t border-white/[0.05] flex items-center justify-between"
        style={{ background: 'rgba(0,0,0,0.25)' }}
      >
        <p className="text-[9px] text-gray-600">
          {filtered.length} / {activeDefs.length} resources
        </p>
        <p className="text-[9px] text-gray-700">drag to canvas →</p>
      </div>
      </>)}

      {/* ── Confirm switch modal ───────────────────────────────────────────── */}
      {confirmSwitch && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="mx-3 rounded-2xl p-5 shadow-2xl fade-in w-full"
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.99) 0%, rgba(10,16,30,0.99) 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
              boxShadow: '0 0 40px rgba(239,68,68,0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-sm font-bold text-white">Switch provider?</p>
            </div>
            <p className="text-[11px] text-gray-400 mb-1 leading-relaxed">
              Switching to{' '}
              <span className="text-white font-semibold">
                {confirmSwitch.mode === 'ansible'
                  ? 'Ansible'
                  : `${CLOUD_PROVIDERS.find(c => c.id === confirmSwitch.cloud)?.label ?? ''} ${confirmSwitch.mode === 'crossplane' ? 'Crossplane' : 'Terraform'}`}
              </span>{' '}
              will clear the canvas.
            </p>
            <p className="text-[11px] text-gray-500 mb-4">
              {nodes.length} resource{nodes.length !== 1 ? 's' : ''} will be removed. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  doSwitch(confirmSwitch.mode, confirmSwitch.cloud as TerraformCloud);
                  setConfirmSwitch(null);
                }}
                className="flex-1 text-white text-xs font-semibold py-2.5 rounded-xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                }}
              >
                Switch & Clear
              </button>
              <button
                onClick={() => setConfirmSwitch(null)}
                className="flex-1 text-gray-300 text-xs py-2.5 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

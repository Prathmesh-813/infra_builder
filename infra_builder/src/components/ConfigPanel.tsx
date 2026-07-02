import { useStore } from '../store/useStore';
import { X, Settings2, ChevronDown, Sparkles } from 'lucide-react';
import SuggestionPanel from './SuggestionPanel';
import type { ResourceField } from '../types/resources';

const BORDER_RGB: Record<string, string> = {
  'border-orange-500': '249,115,22', 'border-green-500': '34,197,94', 'border-blue-500': '59,130,246',
  'border-cyan-500': '6,182,212', 'border-red-500': '239,68,68', 'border-purple-500': '168,85,247',
  'border-yellow-500': '234,179,8', 'border-pink-500': '236,72,153', 'border-teal-500': '20,184,166',
  'border-indigo-500': '99,102,241', 'border-amber-500': '245,158,11',
};

export default function ConfigPanel() {
  const { nodes, selectedNodeId, setSelectedNode, updateNodeConfig, updateNodeName, providerRegion } = useStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;
  if (selectedNode.type === 'costCompareNode' || selectedNode.data?.nodeType === 'costCompare') return null;

  const { definition, config, resourceName } = selectedNode.data;
  const rgb = BORDER_RGB[definition.borderColor] ?? '99,102,241';
  const tint = (a: number) => `rgba(${rgb},${a})`;

  const label = (text: string, required?: boolean) => (
    <label className="flex items-center gap-1 text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
      {text}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );

  return (
    <div className="w-80 flex flex-col h-full flex-shrink-0 fade-in" style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="relative p-4 border-b shrink-0" style={{ background: `linear-gradient(135deg, ${tint(0.16)}, ${tint(0.04)})`, borderBottomColor: 'var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: tint(0.7) }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: tint(0.14), border: `1px solid ${tint(0.4)}`, boxShadow: `0 0 16px ${tint(0.22)}` }}>
              {definition.icon}
            </div>
            <div className="min-w-0">
              <div className={`font-bold text-[13px] truncate ${definition.color}`}>{definition.label}</div>
              <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{definition.type}</div>
            </div>
          </div>
          <button onClick={() => setSelectedNode(null)} aria-label="Close panel"
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 shrink-0" style={{ color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SuggestionPanel node={selectedNode} />

        {/* Resource name */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            <Settings2 size={10} style={{ color: 'var(--accent-light)' }} />
            Resource Name <span className="text-red-400">*</span>
          </label>
          <input type="text" value={resourceName}
            onChange={(e) => updateNodeName(selectedNodeId!, e.target.value)}
            placeholder="e.g. main, web_server" className="cfg-input" />
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>Used as the Terraform resource identifier</p>
        </div>

        {definition.fields.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-faint)' }}>Configuration</p>
            <div className="space-y-3.5">
              {definition.fields.map((field: ResourceField) => (
                <div key={field.key}>
                  {label(field.label, field.required)}

                  {field.type === 'select' && (
                    <div className="relative">
                      <select value={String(config[field.key] ?? field.default ?? '')}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: e.target.value })}
                        className="cfg-input appearance-none pr-7 cursor-pointer">
                        {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}

                  {field.type === 'boolean' && (
                    <button type="button"
                      onClick={() => updateNodeConfig(selectedNodeId!, { [field.key]: !Boolean(config[field.key] ?? field.default ?? false) })}
                      className="flex items-center gap-3 group">
                      <div className="w-9 h-5 rounded-full transition-all duration-200 relative shrink-0"
                        style={{
                          background: Boolean(config[field.key] ?? field.default ?? false) ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'var(--bg-input)',
                          border: '1px solid var(--border-input)',
                          boxShadow: Boolean(config[field.key] ?? field.default ?? false) ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
                        }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
                          style={{ background: 'white', left: Boolean(config[field.key] ?? field.default ?? false) ? 'calc(100% - 18px)' : '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
                      </div>
                      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        {Boolean(config[field.key] ?? field.default ?? false) ? 'Enabled' : 'Disabled'}
                      </span>
                    </button>
                  )}

                  {field.type === 'number' && (
                    <input type="number" value={String(config[field.key] ?? field.default ?? '')}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: Number(e.target.value) })}
                      placeholder={field.placeholder} className="cfg-input" />
                  )}

                  {(field.type === 'text' || field.type === 'textarea') && (
                    <input type="text" value={String(config[field.key] ?? field.default ?? '')}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: e.target.value })}
                      placeholder={field.placeholder} className="cfg-input" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Region override */}
        <div className="pt-3 border-t" style={{ borderTopColor: 'var(--border)' }}>
          <label className="flex items-center gap-1.5 text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            🌍 Region Override
          </label>
          <div className="relative">
            <select value={String(config.region ?? '')}
              onChange={(e) => updateNodeConfig(selectedNodeId!, { region: e.target.value || '' })}
              className="cfg-input appearance-none pr-7 cursor-pointer">
              <option value="">Use default ({providerRegion})</option>
              {['us-east-1 (N. Virginia)','us-east-2 (Ohio)','us-west-1 (N. California)','us-west-2 (Oregon)','eu-west-1 (Ireland)','eu-west-2 (London)','eu-central-1 (Frankfurt)','ap-southeast-1 (Singapore)','ap-southeast-2 (Sydney)','ap-northeast-1 (Tokyo)','ap-south-1 (Mumbai)','sa-east-1 (São Paulo)','ca-central-1 (Canada)'].map((r) => {
                const val = r.split(' ')[0];
                return <option key={val} value={val}>{r}</option>;
              })}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>Overrides the global region for this resource only.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t shrink-0 flex items-center justify-center gap-1.5" style={{ borderTopColor: 'var(--border)', background: 'var(--bg-input)' }}>
        <Sparkles size={11} style={{ color: 'var(--accent-light)' }} />
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Changes reflect in the code panel instantly</p>
      </div>
    </div>
  );
}

import { useStore } from '../store/useStore';
import { X, Settings2 } from 'lucide-react';
import SuggestionPanel from './SuggestionPanel';
import type { ResourceField } from '../types/resources';

export default function ConfigPanel() {
  const { nodes, selectedNodeId, setSelectedNode, updateNodeConfig, updateNodeName, providerRegion } = useStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  // CostCompare nodes have no definition — don't render config panel for them
  if (selectedNode.type === 'costCompareNode' || selectedNode.data?.nodeType === 'costCompare') return null;

  const { definition, config, resourceName } = selectedNode.data;

  const BORDER_GLOW: Record<string, string> = {
    'border-orange-500': 'rgba(249,115,22,0.4)',
    'border-green-500':  'rgba(34,197,94,0.4)',
    'border-blue-500':   'rgba(59,130,246,0.4)',
    'border-cyan-500':   'rgba(6,182,212,0.4)',
    'border-red-500':    'rgba(239,68,68,0.4)',
    'border-purple-500': 'rgba(168,85,247,0.4)',
    'border-yellow-500': 'rgba(234,179,8,0.4)',
    'border-pink-500':   'rgba(236,72,153,0.4)',
    'border-teal-500':   'rgba(20,184,166,0.4)',
    'border-indigo-500': 'rgba(99,102,241,0.4)',
    'border-amber-500':  'rgba(245,158,11,0.4)',
  };
  const glowColor = BORDER_GLOW[definition.borderColor] ?? 'rgba(99,102,241,0.4)';

  const inputClass = `w-full text-[12px] text-gray-200 px-3 py-2 rounded-lg transition-all placeholder:text-gray-600`;
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <div
      className="w-80 flex flex-col h-full flex-shrink-0 fade-in"
      style={{
        background: 'linear-gradient(180deg, rgba(10,16,30,0.98) 0%, rgba(8,12,20,0.98) 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className={`relative p-4 border-b ${definition.bgColor}`}
        style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* Accent line matching resource color */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: glowColor.replace('0.4', '0.8') }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${glowColor}`,
                boxShadow: `0 0 16px ${glowColor.replace('0.4', '0.2')}`,
              }}
            >
              {definition.icon}
            </div>
            <div>
              <div className={`font-bold text-[13px] ${definition.color}`}>{definition.label}</div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {definition.type}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-gray-600 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Smart suggestions */}
        <SuggestionPanel node={selectedNode} />

        {/* Resource name */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
            <Settings2 size={10} className="text-indigo-400" />
            Resource Name
            <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={resourceName}
            onChange={(e) => updateNodeName(selectedNodeId!, e.target.value)}
            placeholder="e.g. main, web_server"
            className={inputClass}
            style={inputStyle}
          />
          <p className="text-[10px] mt-1.5" style={{ color: 'rgba(100,116,139,0.8)' }}>
            Used as the Terraform resource identifier
          </p>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* Dynamic config fields */}
        {definition.fields.map((field: ResourceField) => (
          <div key={field.key}>
            <label className="flex items-center gap-1 text-[11px] font-medium text-gray-400 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>

            {field.type === 'select' && (
              <div className="relative">
                <select
                  value={String(config[field.key] ?? field.default ?? '')}
                  onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: e.target.value })}
                  className={`${inputClass} appearance-none pr-7 cursor-pointer`}
                  style={inputStyle}
                >
                  {field.options?.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 text-[10px]">▾</div>
              </div>
            )}

            {field.type === 'boolean' && (
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    id={`${selectedNodeId}-${field.key}`}
                    checked={Boolean(config[field.key] ?? field.default ?? false)}
                    onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: e.target.checked })}
                    className="sr-only"
                  />
                  <div
                    className="w-9 h-5 rounded-full transition-all duration-200 relative"
                    style={{
                      background: Boolean(config[field.key] ?? field.default ?? false)
                        ? 'linear-gradient(135deg, #4f46e5, #6366f1)'
                        : 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: Boolean(config[field.key] ?? field.default ?? false)
                        ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
                    }}
                    onClick={() => updateNodeConfig(selectedNodeId!, { [field.key]: !Boolean(config[field.key] ?? field.default ?? false) })}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
                      style={{
                        background: 'white',
                        left: Boolean(config[field.key] ?? field.default ?? false) ? 'calc(100% - 18px)' : '2px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[12px] text-gray-300">
                  {Boolean(config[field.key] ?? field.default ?? false) ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            )}

            {field.type === 'number' && (
              <input
                type="number"
                value={String(config[field.key] ?? field.default ?? '')}
                onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: Number(e.target.value) })}
                placeholder={field.placeholder}
                className={inputClass}
                style={inputStyle}
              />
            )}

            {(field.type === 'text' || field.type === 'textarea') && (
              <input
                type="text"
                value={String(config[field.key] ?? field.default ?? '')}
                onChange={(e) => updateNodeConfig(selectedNodeId!, { [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className={inputClass}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        {/* ── Region Override ─────────────────────────────────────────────── */}
        <div className="pt-3 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.06)' }}>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
            <span className="text-[10px]">🌍</span>
            Region Override
          </label>
          <div className="relative">
            <select
              value={String(config.region ?? '')}
              onChange={(e) => updateNodeConfig(selectedNodeId!, { region: e.target.value || '' })}
              className={`${inputClass} appearance-none pr-7 cursor-pointer`}
              style={inputStyle}
            >
              <option value="">Use default ({providerRegion})</option>
              <option value="us-east-1">us-east-1 (N. Virginia)</option>
              <option value="us-east-2">us-east-2 (Ohio)</option>
              <option value="us-west-1">us-west-1 (N. California)</option>
              <option value="us-west-2">us-west-2 (Oregon)</option>
              <option value="eu-west-1">eu-west-1 (Ireland)</option>
              <option value="eu-west-2">eu-west-2 (London)</option>
              <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
              <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
              <option value="ap-southeast-2">ap-southeast-2 (Sydney)</option>
              <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
              <option value="ap-south-1">ap-south-1 (Mumbai)</option>
              <option value="sa-east-1">sa-east-1 (São Paulo)</option>
              <option value="ca-central-1">ca-central-1 (Canada)</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 text-[10px]">▾</div>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(100,116,139,0.7)' }}>
            Overrides the global region for this resource only. Leave as "Use default" to use the project-wide region.
          </p>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-2.5 border-t"
        style={{ borderTopColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
      >
        <p className="text-[10px] text-center" style={{ color: 'rgba(100,116,139,0.7)' }}>
          ✦ Changes reflect in the code panel instantly
        </p>
      </div>
    </div>
  );
}

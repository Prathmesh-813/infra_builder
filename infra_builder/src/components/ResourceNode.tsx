import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { Trash2, SlidersHorizontal } from 'lucide-react';
import { ResourceNodeData } from '../types/resources';
import { useStore } from '../store/useStore';

// Map each resource's Tailwind border class to an rgb triplet so the node can
// theme its header/icon/glow from the resource's own colour.
const BORDER_RGB: Record<string, string> = {
  'border-orange-500': '249,115,22',
  'border-green-500':  '34,197,94',
  'border-blue-500':   '59,130,246',
  'border-cyan-500':   '6,182,212',
  'border-red-500':    '239,68,68',
  'border-purple-500': '168,85,247',
  'border-yellow-500': '234,179,8',
  'border-pink-500':   '236,72,153',
  'border-teal-500':   '20,184,166',
  'border-indigo-500': '99,102,241',
  'border-amber-500':  '245,158,11',
  'border-lime-500':   '132,204,22',
  'border-violet-500': '139,92,246',
  'border-sky-500':    '14,165,233',
  'border-rose-500':   '244,63,94',
  'border-emerald-500':'16,185,129',
};

function ResourceNode({ data, id, selected }: NodeProps<ResourceNodeData>) {
  const { deleteNode, setSelectedNode } = useStore();
  const { definition, resourceName } = data;

  const leftPorts = definition.ports.filter((p) => p.side === 'left');
  const rightPorts = definition.ports.filter((p) => p.side === 'right');
  const portSpacing = (total: number, index: number) => (total === 1 ? 50 : ((index + 1) / (total + 1)) * 100);

  const rgb = BORDER_RGB[definition.borderColor] ?? '99,102,241';
  const tint = (a: number) => `rgba(${rgb},${a})`;

  const portLabel = (label: string, reverse: boolean) => (
    <div
      className={`absolute flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${reverse ? 'flex-row-reverse' : ''}`}
      style={{
        [reverse ? 'right' : 'left']: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        [reverse ? 'paddingRight' : 'paddingLeft']: 6,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      <span
        className="text-[9px] font-medium text-gray-200 px-1.5 py-0.5 rounded-md leading-none"
        style={{ background: 'rgba(10,16,30,0.92)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <motion.div
      className="group relative rounded-2xl cursor-pointer select-none transition-[box-shadow,border-color] duration-200"
      // Spring pop-in when a node is dropped/created, and a gentle lift on hover.
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 480, damping: 26, mass: 0.6 }}
      style={{
        minWidth: 224,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.96) 0%, rgba(10,15,26,0.96) 100%)',
        border: selected ? `1.5px solid ${tint(0.9)}` : '1px solid rgba(255,255,255,0.08)',
        boxShadow: selected
          ? `0 0 0 4px ${tint(0.18)}, 0 14px 44px rgba(0,0,0,0.55)`
          : '0 6px 24px rgba(0,0,0,0.42)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={() => setSelectedNode(id)}
    >
      {/* ── Left handles ── */}
      {leftPorts.map((port, i) => (
        <div key={port.id} className="absolute" style={{ top: `${portSpacing(leftPorts.length, i)}%`, left: 0, transform: 'translateY(-50%)' }}>
          <Handle type={port.type} position={Position.Left} id={port.id}
            className={`!w-3.5 !h-3.5 !rounded-full !border-2 !border-gray-900 ${port.color}`}
            style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none' }} />
          {portLabel(port.label, true)}
        </div>
      ))}

      {/* ── Right handles ── */}
      {rightPorts.map((port, i) => (
        <div key={port.id} className="absolute" style={{ top: `${portSpacing(rightPorts.length, i)}%`, right: 0, transform: 'translateY(-50%)' }}>
          <Handle type={port.type} position={Position.Right} id={port.id}
            className={`!w-3.5 !h-3.5 !rounded-full !border-2 !border-gray-900 ${port.color}`}
            style={{ position: 'relative', top: 'auto', right: 'auto', transform: 'none' }} />
          {portLabel(port.label, false)}
        </div>
      ))}

      {/* ── Coloured header band ── */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 rounded-t-2xl"
        style={{ background: `linear-gradient(135deg, ${tint(0.22)} 0%, ${tint(0.06)} 100%)`, borderBottom: `1px solid ${tint(0.18)}` }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl leading-none transition-transform duration-200 group-hover:scale-105"
          style={{ background: tint(0.16), border: `1px solid ${tint(0.42)}`, boxShadow: `0 0 18px ${tint(0.28)}` }}
        >
          {definition.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-[13px] leading-tight truncate ${definition.color}`}>{definition.label}</div>
          <div className="text-[10px] mt-0.5 truncate font-mono" style={{ color: 'rgba(148,163,184,0.78)' }}>
            {resourceName || 'unnamed'}
          </div>
        </div>
        {/* Hover-reveal actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button onClick={(e) => { e.stopPropagation(); setSelectedNode(id); }} title="Configure"
            className="p-1 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-white/10 transition-colors">
            <SlidersHorizontal size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); deleteNode(id); }} title="Delete resource"
            className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Body: meta chips ── */}
      {(data.config?.region || definition.ports.length > 0) && (
        <div className="px-3.5 py-2.5 flex flex-wrap items-center gap-1.5">
          {data.config?.region && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: tint(0.14), border: `1px solid ${tint(0.3)}`, color: `rgba(${rgb},0.95)` }}>
              🌍 {String(data.config.region)}
            </span>
          )}
          {definition.ports.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}>
              {definition.ports.slice(0, 4).map((p) => (
                <span key={p.id} className={`w-1.5 h-1.5 rounded-full ${p.color} inline-block`} />
              ))}
              {definition.ports.length} {definition.ports.length === 1 ? 'port' : 'ports'}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default memo(ResourceNode);

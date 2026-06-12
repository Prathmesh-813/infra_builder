import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { ResourceNodeData } from '../types/resources';
import { useStore } from '../store/useStore';

function ResourceNode({ data, id, selected }: NodeProps<ResourceNodeData>) {
  const { deleteNode, setSelectedNode } = useStore();
  const { definition, resourceName } = data;

  const leftPorts  = definition.ports.filter((p) => p.side === 'left');
  const rightPorts = definition.ports.filter((p) => p.side === 'right');

  const portSpacing = (_ports: unknown[], totalPorts: number, index: number) => {
    if (totalPorts === 1) return 50;
    return ((index + 1) / (totalPorts + 1)) * 100;
  };

  // Extract a raw hex/rgb color from the Tailwind border class for glow
  const BORDER_GLOW: Record<string, string> = {
    'border-orange-500': 'rgba(249,115,22,0.5)',
    'border-green-500':  'rgba(34,197,94,0.5)',
    'border-blue-500':   'rgba(59,130,246,0.5)',
    'border-cyan-500':   'rgba(6,182,212,0.5)',
    'border-red-500':    'rgba(239,68,68,0.5)',
    'border-purple-500': 'rgba(168,85,247,0.5)',
    'border-yellow-500': 'rgba(234,179,8,0.5)',
    'border-pink-500':   'rgba(236,72,153,0.5)',
    'border-teal-500':   'rgba(20,184,166,0.5)',
    'border-indigo-500': 'rgba(99,102,241,0.5)',
    'border-amber-500':  'rgba(245,158,11,0.5)',
    'border-lime-500':   'rgba(132,204,22,0.5)',
    'border-violet-500': 'rgba(139,92,246,0.5)',
    'border-sky-500':    'rgba(14,165,233,0.5)',
    'border-rose-500':   'rgba(244,63,94,0.5)',
    'border-emerald-500':'rgba(16,185,129,0.5)',
  };

  const glowColor = BORDER_GLOW[definition.borderColor] ?? 'rgba(99,102,241,0.4)';

  return (
    <div
      className={`relative rounded-2xl cursor-pointer select-none transition-all duration-200 ${definition.bgColor}`}
      style={{
        minWidth: 210,
        border: selected
          ? `2px solid ${glowColor.replace('0.5', '0.9')}`
          : `1px solid rgba(255,255,255,0.1)`,
        boxShadow: selected
          ? `0 0 0 3px ${glowColor.replace('0.5', '0.2')}, 0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${glowColor}`
          : '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={() => setSelectedNode(id)}
    >
      {/* Top accent stripe */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl ${definition.borderColor}`}
        style={{ background: glowColor.replace('0.5', '0.8') }}
      />

      {/* ── Left handles ──────────────────────────────────────────────────── */}
      {leftPorts.map((port, i) => {
        const pct = portSpacing(leftPorts, leftPorts.length, i);
        return (
          <div
            key={port.id}
            className="absolute"
            style={{ top: `${pct}%`, left: 0, transform: 'translateY(-50%)' }}
          >
            <Handle
              type={port.type}
              position={Position.Left}
              id={port.id}
              className={`!w-3.5 !h-3.5 !rounded-full !border-2 !border-gray-900 ${port.color}`}
              style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none' }}
            />
            <div
              className="absolute flex items-center gap-1 flex-row-reverse"
              style={{
                right: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                paddingRight: 5,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              <span
                className="text-[9px] font-medium text-gray-300 px-1.5 py-0.5 rounded-md leading-none"
                style={{
                  background: 'rgba(10,16,30,0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {port.label}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${port.color} flex-shrink-0`} />
            </div>
          </div>
        );
      })}

      {/* ── Right handles ─────────────────────────────────────────────────── */}
      {rightPorts.map((port, i) => {
        const pct = portSpacing(rightPorts, rightPorts.length, i);
        return (
          <div
            key={port.id}
            className="absolute"
            style={{ top: `${pct}%`, right: 0, transform: 'translateY(-50%)' }}
          >
            <Handle
              type={port.type}
              position={Position.Right}
              id={port.id}
              className={`!w-3.5 !h-3.5 !rounded-full !border-2 !border-gray-900 ${port.color}`}
              style={{ position: 'relative', top: 'auto', right: 'auto', transform: 'none' }}
            />
            <div
              className="absolute flex items-center gap-1"
              style={{
                left: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                paddingLeft: 5,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${port.color} flex-shrink-0`} />
              <span
                className="text-[9px] font-medium text-gray-300 px-1.5 py-0.5 rounded-md leading-none"
                style={{
                  background: 'rgba(10,16,30,0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {port.label}
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Node body ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Icon container */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl leading-none"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: `0 0 12px ${glowColor.replace('0.5', '0.2')}`,
              }}
            >
              {definition.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold text-[13px] leading-tight ${definition.color}`}>
                {definition.label}
              </div>
              <div
                className="text-[10px] mt-0.5 truncate font-mono"
                style={{ color: 'rgba(148,163,184,0.7)' }}
              >
                {resourceName || 'unnamed'}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 flex-shrink-0"
            title="Delete resource"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Port chips */}
        {definition.ports.length > 0 && (
          <div
            className="mt-3 pt-2.5 flex flex-wrap gap-1"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            {definition.ports.map((port) => (
              <span
                key={port.id}
                className="inline-flex items-center gap-1 text-[8px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#94a3b8',
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${port.color} inline-block`} />
                {port.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ResourceNode);

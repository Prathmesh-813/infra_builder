// Custom edge with n8n-style hover affordances: a "+" to insert a node inline
// (splicing the edge) and a "×" to delete the connection. A wide invisible hit
// path makes the edge easy to hover.
import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow';
import { Plus, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useBuilderUi } from '../store/builderUiStore';

export default function SmartEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const openPickerForEdge = useBuilderUi((s) => s.openPickerForEdge);
  const [hover, setHover] = useState(false);

  const btn = (bg: string, brd: string, color: string): React.CSSProperties => ({
    width: 20, height: 20, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, border: `1px solid ${brd}`, color, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer',
  });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {/* Invisible wide hit area for easy hover */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={20}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ cursor: 'pointer' }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="flex items-center gap-1 transition-opacity duration-150" style={{ opacity: hover ? 1 : 0 }}>
            <button title="Insert node here" aria-label="Insert node"
              onClick={(e) => { e.stopPropagation(); openPickerForEdge(id); }}
              style={btn('rgba(99,102,241,0.92)', 'rgba(129,140,248,0.6)', '#fff')}>
              <Plus size={12} />
            </button>
            <button title="Delete connection" aria-label="Delete connection"
              onClick={(e) => { e.stopPropagation(); onEdgesChange([{ id, type: 'remove' }]); }}
              style={btn('rgba(15,23,42,0.95)', 'rgba(248,113,113,0.5)', '#fca5a5')}>
              <X size={12} />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

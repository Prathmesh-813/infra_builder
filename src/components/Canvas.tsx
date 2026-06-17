import { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowInstance,
  ConnectionLineType,
  MarkerType,
  Edge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Zap, Download, Image, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ResourceDefinition } from '../types/resources';
import ResourceNode from './ResourceNode';
import CostCompareNode from './CostCompareNode';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { exportDiagramAsPNG, exportDiagramAsPDF } from '../utils/canvasExport';

const nodeTypes = { resourceNode: ResourceNode, costCompareNode: CostCompareNode };

// Color a connection edge based on the source port's color class
const PORT_EDGE_COLORS: Record<string, string> = {
  'bg-cyan-400':    '#22d3ee',
  'bg-red-400':     '#f87171',
  'bg-pink-400':    '#f472b6',
  'bg-blue-400':    '#60a5fa',
  'bg-orange-400':  '#fb923c',
  'bg-purple-400':  '#c084fc',
  'bg-yellow-400':  '#facc15',
  'bg-green-400':   '#4ade80',
  'bg-teal-400':    '#2dd4bf',
  'bg-indigo-400':  '#818cf8',
};

function getEdgeColor(sourceNodeId: string, sourceHandleId: string | null | undefined, nodes: ReturnType<typeof useStore.getState>['nodes']): string {
  const node = nodes.find((n) => n.id === sourceNodeId);
  if (!node) return '#6b7280';
  const ports = node.data?.definition?.ports;
  if (!ports) return '#6b7280';
  const port = ports.find((p: any) => p.id === sourceHandleId);
  if (!port) return '#6b7280';
  return PORT_EDGE_COLORS[port.color] ?? '#6b7280';
}

interface CanvasProps {
  draggedDefinition: ResourceDefinition | null;
  onDrop: (e: React.DragEvent, rfInstance: ReactFlowInstance) => void;
  onOpenBlueprints?: () => void;
}

export default function Canvas({ onDrop, onOpenBlueprints }: CanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore();
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (rfInstanceRef.current) onDrop(e, rfInstanceRef.current);
    },
    [onDrop]
  );

  // Enrich new connections with color + style
  const handleConnect = useCallback(
    (connection: Connection) => {
      const color = getEdgeColor(connection.source ?? '', connection.sourceHandle, nodes);
      const portLabel = (() => {
        const node = nodes.find((n) => n.id === connection.source);
        const port = node?.data?.definition?.ports?.find((p: any) => p.id === connection.sourceHandle);
        return port?.label ?? '';
      })();

      // Build a full Edge and push it directly via onConnect (store accepts Edge | Connection)
      const enrichedEdge: Edge = {
        id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}-${Date.now()}`,
        source: connection.source ?? '',
        target: connection.target ?? '',
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'smoothstep',
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        label: portLabel,
        labelStyle: { fill: '#9ca3af', fontSize: 10 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.8 },
      };
      onConnect(enrichedEdge as unknown as Connection);
    },
    [nodes, onConnect]
  );

  return (
    <div className="flex-1 h-full canvas-bg relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        nodeTypes={nodeTypes}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        deleteKeyCode="Delete"
        className="canvas-bg"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6b7280', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(99,102,241,0.15)"
        />
        <Controls className="bg-gray-800 border-gray-600" />
        <MiniMap
          nodeColor={(node) => {
            const colorMap: Record<string, string> = {
              'border-orange-500': '#f97316',
              'border-green-500':  '#22c55e',
              'border-blue-500':   '#3b82f6',
              'border-cyan-500':   '#06b6d4',
              'border-red-500':    '#ef4444',
              'border-purple-500': '#a855f7',
              'border-yellow-500': '#eab308',
              'border-pink-500':   '#ec4899',
              'border-teal-500':   '#14b8a6',
              'border-indigo-500': '#6366f1',
            };
            // CostCompare nodes have no definition — use purple
            if (node.type === 'costCompareNode') return '#a855f7';
            return colorMap[node.data?.definition?.borderColor] ?? '#6b7280';
          }}
          style={{
            background: 'rgba(10,16,30,0.9)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 12,
          }}
        />

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center fade-in">
              {/* Animated glow orb */}
              <div className="relative inline-block mb-6">
                <div
                  className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mx-auto"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(56,189,248,0.1) 100%)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    boxShadow: '0 0 60px rgba(99,102,241,0.2), 0 0 120px rgba(56,189,248,0.1)',
                    animation: 'scale-pulse 3s ease-in-out infinite',
                    transition: 'box-shadow 0.3s ease',
                  }}
                >
                  🏗️
                </div>
                {/* Decorative ring */}
                <div
                  className="absolute -inset-4 rounded-[2rem] opacity-30"
                  style={{
                    border: '1px solid rgba(99,102,241,0.15)',
                    animation: 'float-slow 4s ease-in-out infinite',
                  }}
                />
              </div>

              <h3
                className="text-2xl font-bold mb-2"
                style={{
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Start Building Your Infrastructure
              </h3>
              <p className="text-sm max-w-xs mx-auto mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Drag resources from the left panel, or use{' '}
                <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>Quick Setup</span>
                {' '}to scaffold a full stack instantly.
              </p>

              <div className="pointer-events-auto flex flex-col items-center gap-3">
                <button
                  onClick={onOpenBlueprints}
                  className="group relative flex items-center gap-2.5 font-semibold px-6 py-3 rounded-2xl text-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)' }} />
                  <span className="relative flex items-center gap-2.5">
                    <Zap size={16} className="text-yellow-300" />
                    Quick Setup — pick a blueprint
                  </span>
                </button>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>or drag resources from the left panel</p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {RESOURCE_DEFINITIONS.slice(0, 5).map((d) => (
                  <span
                    key={d.type}
                    className="text-[11px] px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-faint)',
                    }}
                  >
                    {d.icon} {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </ReactFlow>

      {/* Export button */}
      {nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                boxShadow: '0 0 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                color: 'white',
              }}
            >
              <Download size={14} />
              Export
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div
                  className="absolute bottom-full right-0 mb-2 z-20 rounded-lg overflow-hidden shadow-xl border"
                  style={{
                    background: '#1e293b',
                    borderColor: 'rgba(99,102,241,0.3)',
                    minWidth: 140,
                  }}
                >
                  <button
                    onClick={() => { setExportOpen(false); exportDiagramAsPNG(); }}
                    className="flex items-center gap-2 w-full text-left text-xs px-3 py-2.5 transition-colors hover:bg-gray-700"
                    style={{ color: '#e2e8f0' }}
                  >
                    <Image size={14} className="text-indigo-400" />
                    Download as PNG
                  </button>
                  <button
                    onClick={() => { setExportOpen(false); exportDiagramAsPDF(); }}
                    className="flex items-center gap-2 w-full text-left text-xs px-3 py-2.5 transition-colors hover:bg-gray-700"
                    style={{ color: '#e2e8f0' }}
                  >
                    <FileText size={14} className="text-indigo-400" />
                    Download as PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

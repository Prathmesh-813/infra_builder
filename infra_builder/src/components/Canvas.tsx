import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  BackgroundVariant,
  ReactFlowInstance,
  ConnectionLineType,
  MarkerType,
  Node,
  Edge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Zap, Download, Image, FileText, Wand2, Plus, Minus, Network, Maximize, Map as MapIcon, Undo2, Redo2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ResourceDefinition, ResourceNodeData } from '../types/resources';
import ResourceNode from './ResourceNode';
import CostCompareNode from './CostCompareNode';
import SmartEdge from './SmartEdge';
import NodePicker from './NodePicker';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { exportDiagramAsPNG, exportDiagramAsPDF } from '../utils/canvasExport';
import { autoConfigureSG, propagateTags } from '../utils/autoConfig';
import { layoutWithDagre } from '../utils/autoLayout';
import { getActiveDefinitions } from '../utils/activeDefinitions';
import { createNode } from '../utils/createNode';
import { useBuilderUi } from '../store/builderUiStore';

const nodeTypes = { resourceNode: ResourceNode, costCompareNode: CostCompareNode };
const edgeTypes = { smart: SmartEdge };

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

function ToolBtn({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
      style={{ color: active ? 'var(--accent-light)' : 'var(--text-secondary)', background: active ? 'var(--accent-bg)' : 'transparent' }}>
      {children}
    </button>
  );
}
function ToolDivider() { return <div className="w-px h-5 mx-0.5" style={{ background: 'var(--border)' }} />; }

interface CanvasProps {
  draggedDefinition: ResourceDefinition | null;
  onDrop: (e: React.DragEvent, rfInstance: ReactFlowInstance) => void;
  onOpenBlueprints?: () => void;
  onOpenPromptToDiagram?: () => void;
}

export default function Canvas({ onDrop, onOpenBlueprints, onOpenPromptToDiagram }: CanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, updateNodeConfig, setNodes, addNode, cloudProvider, crossplaneCloud } = useStore();
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showMinimap, setShowMinimap] = useState(true);
  const { pickerOpen, spliceEdgeId, openPicker, closePicker } = useBuilderUi();

  // Auto-arrange the diagram with dagre (uses ReactFlow's measured node sizes
  // when available for an accurate layout), then fit the result into view.
  const handleAutoArrange = useCallback(() => {
    if (nodes.length === 0) return;
    const measured = rfInstanceRef.current?.getNodes() ?? nodes;
    const laidOut = layoutWithDagre(measured as typeof nodes, edges, 'LR');
    setNodes(laidOut as typeof nodes);
    setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2, maxZoom: 1.25, duration: 500 }), 60);
  }, [nodes, edges, setNodes]);
  const [exportOpen, setExportOpen] = useState(false);
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as HTMLElement | null)) setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
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
        type: 'smart',
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        label: portLabel,
        labelStyle: { fill: '#9ca3af', fontSize: 10 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.8 },
      };
      onConnect(enrichedEdge as unknown as Connection);

      // ── Auto-configuration on connect ────────────────────────────────────
      const sourceNode = nodes.find((n: Node<ResourceNodeData>) => n.id === connection.source);
      const targetNode = nodes.find((n: Node<ResourceNodeData>) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceType = sourceNode.data?.resourceType ?? sourceNode.data?.definition?.type ?? '';
      const targetType = targetNode.data?.resourceType ?? targetNode.data?.definition?.type ?? '';

      // If connecting a Security Group to a resource, auto-set ingress rules
      if (sourceType === 'aws_security_group') {
        autoConfigureSG(sourceNode, targetNode, enrichedEdge, (id, cfg) => updateNodeConfig(id, cfg));
      } else if (targetType === 'aws_security_group') {
        autoConfigureSG(targetNode, sourceNode, enrichedEdge, (id, cfg) => updateNodeConfig(id, cfg));
      }

      // Propagate tags from parent resources to children
      propagateTags(sourceNode, targetNode, (id, cfg) => updateNodeConfig(id, cfg));
    },
    [nodes, onConnect, updateNodeConfig]
  );

  // ── Add-node panel: add at canvas centre, or splice into a hovered edge ────
  const handlePick = useCallback((def: ResourceDefinition) => {
    const rf = rfInstanceRef.current;
    if (spliceEdgeId) {
      const edge = edges.find((e) => e.id === spliceEdgeId);
      const src = nodes.find((n) => n.id === edge?.source);
      const tgt = nodes.find((n) => n.id === edge?.target);
      const mid = src && tgt
        ? { x: (src.position.x + tgt.position.x) / 2, y: (src.position.y + tgt.position.y) / 2 }
        : { x: 0, y: 0 };
      const node = createNode(def, mid);
      addNode(node);
      if (edge) {
        const leftPort = def.ports.find((p) => p.side === 'left');
        const rightPort = def.ports.find((p) => p.side === 'right');
        onEdgesChange([{ id: edge.id, type: 'remove' }]);
        handleConnect({ source: edge.source, sourceHandle: edge.sourceHandle ?? null, target: node.id, targetHandle: leftPort?.id ?? null });
        handleConnect({ source: node.id, sourceHandle: rightPort?.id ?? null, target: edge.target, targetHandle: edge.targetHandle ?? null });
      }
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      const pos = rect && rf
        ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      addNode(createNode(def, pos));
    }
    closePicker();
  }, [spliceEdgeId, edges, nodes, addNode, onEdgesChange, handleConnect, closePicker]);

  // ── Zoom controls ─────────────────────────────────────────────────────────
  const zoomIn = () => rfInstanceRef.current?.zoomIn({ duration: 200 });
  const zoomOut = () => rfInstanceRef.current?.zoomOut({ duration: 200 });
  const fitAll = () => rfInstanceRef.current?.fitView({ padding: 0.2, maxZoom: 1.25, duration: 300 });
  const resetZoom = () => rfInstanceRef.current?.zoomTo(1, { duration: 200 });

  // ── Undo / redo (zundo temporal store) ────────────────────────────────────
  const undo = useCallback(() => useStore.temporal.getState().undo(), []);
  const redo = useCallback(() => useStore.temporal.getState().redo(), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo]);

  return (
    <div ref={containerRef} className="flex-1 h-full canvas-bg relative"
      onDragOver={handleDragOver}
      onDragEnter={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={handleDragLeave}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={(instance) => { rfInstanceRef.current = instance; setZoom(instance.getZoom()); }}
        onMove={(_, vp) => setZoom(vp.zoom)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.25 }}
        minZoom={0.2}
        maxZoom={2.5}
        snapToGrid
        snapGrid={[16, 16]}
        panOnScroll
        zoomOnPinch
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Meta', 'Control']}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Delete', 'Backspace']}
        className="canvas-bg"
        defaultEdgeOptions={{
          type: 'smart',
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
        {showMinimap && (
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
        )}

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

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span className="text-[10px] px-2" style={{ color: 'var(--text-faint)' }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>

                {onOpenPromptToDiagram && (
                  <button
                    onClick={onOpenPromptToDiagram}
                    className="group relative flex items-center gap-2.5 font-semibold px-6 py-3 rounded-2xl text-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      color: '#a5b4fc',
                    }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.15) 100%)' }} />
                    <span className="relative flex items-center gap-2.5">
                      <Wand2 size={16} className="text-indigo-400" />
                      AI Prompt to Diagram
                    </span>
                    <span
                      className="relative text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                    >
                      NEW
                    </span>
                  </button>
                )}

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

      {/* Drop-zone highlight while dragging a resource over the canvas */}
      {isOver && (
        <div
          className="drop-overlay absolute inset-3 z-20 pointer-events-none rounded-2xl flex items-center justify-center"
          style={{ border: '2px dashed rgba(99,102,241,0.6)', background: 'rgba(99,102,241,0.06)' }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: 'rgba(15,23,42,0.92)',
              color: '#a5b4fc',
              border: '1px solid rgba(99,102,241,0.45)',
              boxShadow: '0 10px 36px rgba(99,102,241,0.35)',
            }}
          >
            <Plus size={16} /> Drop to add to canvas
          </div>
        </div>
      )}

      {/* Add-node FAB (top-left) — opens the searchable picker */}
      <button
        onClick={openPicker}
        title="Add resource (search)"
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 6px 22px rgba(99,102,241,0.42)' }}
      >
        <Plus size={15} /> Add node
      </button>

      {/* Bottom-left toolbar: undo/redo · zoom · fit · minimap (n8n-style) */}
      <div
        className="absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-xl px-1.5 py-1"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 6px 24px rgba(0,0,0,0.35)' }}
      >
        <ToolBtn onClick={undo} title="Undo (⌘Z)"><Undo2 size={15} /></ToolBtn>
        <ToolBtn onClick={redo} title="Redo (⌘⇧Z)"><Redo2 size={15} /></ToolBtn>
        <ToolDivider />
        <ToolBtn onClick={zoomOut} title="Zoom out"><Minus size={15} /></ToolBtn>
        <button onClick={resetZoom} title="Reset to 100%"
          className="text-[11px] font-bold px-1.5 min-w-[42px] text-center tabular-nums"
          style={{ color: 'var(--text-secondary)' }}>
          {Math.round(zoom * 100)}%
        </button>
        <ToolBtn onClick={zoomIn} title="Zoom in"><Plus size={15} /></ToolBtn>
        <ToolDivider />
        <ToolBtn onClick={fitAll} title="Fit to view"><Maximize size={14} /></ToolBtn>
        <ToolBtn onClick={() => setShowMinimap((v) => !v)} title="Toggle minimap" active={showMinimap}><MapIcon size={14} /></ToolBtn>
      </div>

      {/* Searchable add-node panel */}
      {pickerOpen && (
        <NodePicker
          definitions={getActiveDefinitions(cloudProvider, crossplaneCloud)}
          title={spliceEdgeId ? 'Insert resource' : 'Add resource'}
          onPick={handlePick}
          onClose={closePicker}
        />
      )}

      {/* Bottom-right toolbar */}
      {nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={handleAutoArrange}
            title="Auto-arrange the diagram"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent-light)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <Network size={14} />
            Auto-arrange
          </button>
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

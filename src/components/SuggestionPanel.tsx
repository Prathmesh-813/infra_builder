import { useState } from 'react';
import { Node } from 'reactflow';
import { Lightbulb, Plus, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Info, Link } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ResourceNodeData } from '../types/resources';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { AZURE_DEFINITIONS } from '../data/azureDefinitions';
import { GCP_DEFINITIONS } from '../data/gcpDefinitions';
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions';
import { RESOURCE_DEPENDENCIES, Dependency } from '../data/dependencies';
import {
  AZURE_DEPENDENCIES,
  GCP_DEPENDENCIES,
  ANSIBLE_DEPENDENCIES,
  MultiCloudDependency,
} from '../data/multiCloudDependencies';
import { MarkerType } from 'reactflow';

let depIdCounter = 5000;

type AnyDep = Dependency | MultiCloudDependency;

interface Props {
  node: Node<ResourceNodeData>;
}

const PORT_COLORS: Record<string, string> = {
  'bg-cyan-400': '#22d3ee', 'bg-red-400': '#f87171', 'bg-pink-400': '#f472b6',
  'bg-blue-400': '#60a5fa', 'bg-orange-400': '#fb923c', 'bg-purple-400': '#c084fc',
  'bg-yellow-400': '#facc15', 'bg-green-400': '#4ade80', 'bg-teal-400': '#2dd4bf',
  'bg-indigo-400': '#818cf8',
};

export default function SuggestionPanel({ node }: Props) {
  const { nodes, edges, addBlueprint, cloudProvider } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [created, setCreated] = useState<Set<string>>(new Set());

  const resourceType = node.data.resourceType as string;

  // ── Find dep spec ─────────────────────────────────────────────────────────
  let depSpec: { resourceType: string; deps: AnyDep[] } | undefined;
  let allDefinitions: any[] = RESOURCE_DEFINITIONS;

  if (cloudProvider === 'aws') {
    depSpec = RESOURCE_DEPENDENCIES.find(d => d.resourceType === resourceType);
    allDefinitions = RESOURCE_DEFINITIONS;
  } else if (cloudProvider === 'azure') {
    depSpec = AZURE_DEPENDENCIES.find(d => d.resourceType === resourceType);
    allDefinitions = AZURE_DEFINITIONS as any[];
  } else if (cloudProvider === 'gcp') {
    depSpec = GCP_DEPENDENCIES.find(d => d.resourceType === resourceType);
    allDefinitions = GCP_DEFINITIONS as any[];
  } else if (cloudProvider === 'ansible') {
    depSpec = ANSIBLE_DEPENDENCIES.find(d => d.resourceType === resourceType);
    allDefinitions = ANSIBLE_DEFINITIONS as any[];
  }

  if (!depSpec || depSpec.deps.length === 0) return null;

  // ── Which dep types are already connected to THIS node ────────────────────
  const connectedTypes = new Set<string>();
  edges.forEach((e) => {
    if (e.target === node.id || e.source === node.id) {
      const otherId = e.target === node.id ? e.source : e.target;
      const other = nodes.find((n) => n.id === otherId);
      if (other) connectedTypes.add(other.data.resourceType as string);
    }
  });

  // ── For each missing dep, check if a matching node already exists on canvas
  // (not connected to THIS node yet, but exists elsewhere)
  const existingByType = new Map<string, Node<ResourceNodeData>>();
  nodes.forEach(n => {
    if (n.id !== node.id) {
      existingByType.set(n.data.resourceType as string, n);
    }
  });

  const missing = depSpec.deps.filter((d) => !connectedTypes.has(d.resourceType));
  const satisfied = depSpec.deps.filter((d) => connectedTypes.has(d.resourceType));

  if (missing.length === 0) return null;

  const requiredMissing = missing.filter((d) => d.required);
  const optionalMissing = missing.filter((d) => !d.required);

  // ── Connect to an existing node on canvas ─────────────────────────────────
  const handleConnectExisting = (dep: AnyDep, existingNode: Node<ResourceNodeData>) => {
    const color = PORT_COLORS[dep.portColor] ?? '#6b7280';
    const newEdge = {
      id: `dep-${existingNode.id}-${dep.sourcePortId}-${node.id}-${dep.targetPortId}-${Date.now()}`,
      source: existingNode.id,
      target: node.id,
      sourceHandle: dep.sourcePortId,
      targetHandle: dep.targetPortId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
      label: dep.label,
      labelStyle: { fill: '#9ca3af', fontSize: 10 },
      labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85 },
    };
    addBlueprint([], [newEdge]);
    setCreated((prev) => new Set(prev).add(dep.resourceType));
  };

  // ── Create a brand new dependency node ────────────────────────────────────
  const handleCreate = (dep: AnyDep) => {
    const definition = allDefinitions.find(
      (d: any) => d.type === dep.resourceType || d.label === dep.label
    );
    if (!definition) return;

    const id = `dep_${depIdCounter++}`;
    const config: Record<string, string | number | boolean> = {};
    definition.fields.forEach((f: any) => {
      if (f.default !== undefined) config[f.key] = f.default;
    });
    if (dep.defaultConfig) Object.assign(config, dep.defaultConfig);

    const isLeft = definition.ports.some((p: any) => p.side === 'right');
    const newPos = {
      x: node.position.x + (isLeft ? -320 : 320),
      y: node.position.y + (depIdCounter % 3) * 130 - 130,
    };

    const newNode = {
      id,
      type: 'resourceNode',
      position: newPos,
      data: {
        resourceType: definition.type,
        resourceName: `${definition.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${depIdCounter}`,
        config,
        definition,
      },
    };

    const color = PORT_COLORS[dep.portColor] ?? '#6b7280';
    const newEdge = {
      id: `dep-${id}-${dep.sourcePortId}-${node.id}-${dep.targetPortId}-${Date.now()}`,
      source: id,
      target: node.id,
      sourceHandle: dep.sourcePortId,
      targetHandle: dep.targetPortId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
      label: dep.label,
      labelStyle: { fill: '#9ca3af', fontSize: 10 },
      labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85 },
    };

    addBlueprint([newNode as any], [newEdge]);
    setCreated((prev) => new Set(prev).add(dep.resourceType));
  };

  // ── Create all required at once (skip ones that have existing nodes) ───────
  const handleCreateAll = () => {
    const newNodes: any[] = [];
    const newEdges: any[] = [];
    let offsetY = -((requiredMissing.filter(d => !created.has(d.resourceType)).length - 1) * 140) / 2;

    for (const dep of requiredMissing) {
      if (created.has(dep.resourceType)) continue;

      // If an existing node of this type is on canvas, just connect it
      const existing = existingByType.get(dep.resourceType);
      if (existing) {
        const color = PORT_COLORS[dep.portColor] ?? '#6b7280';
        newEdges.push({
          id: `dep-${existing.id}-${dep.sourcePortId}-${node.id}-${dep.targetPortId}-${Date.now()}-${depIdCounter}`,
          source: existing.id,
          target: node.id,
          sourceHandle: dep.sourcePortId,
          targetHandle: dep.targetPortId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          label: dep.label,
          labelStyle: { fill: '#9ca3af', fontSize: 10 },
          labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85 },
        });
        continue;
      }

      const definition = allDefinitions.find(
        (d: any) => d.type === dep.resourceType || d.label === dep.label
      );
      if (!definition) continue;

      const id = `dep_${depIdCounter++}`;
      const config: Record<string, string | number | boolean> = {};
      definition.fields.forEach((f: any) => {
        if (f.default !== undefined) config[f.key] = f.default;
      });
      if (dep.defaultConfig) Object.assign(config, dep.defaultConfig);

      newNodes.push({
        id,
        type: 'resourceNode',
        position: { x: node.position.x - 340, y: node.position.y + offsetY },
        data: {
          resourceType: definition.type,
          resourceName: `${definition.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${depIdCounter}`,
          config,
          definition,
        },
      });

      const color = PORT_COLORS[dep.portColor] ?? '#6b7280';
      newEdges.push({
        id: `dep-${id}-${dep.sourcePortId}-${node.id}-${dep.targetPortId}-${Date.now()}-${depIdCounter}`,
        source: id,
        target: node.id,
        sourceHandle: dep.sourcePortId,
        targetHandle: dep.targetPortId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        label: dep.label,
        labelStyle: { fill: '#9ca3af', fontSize: 10 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85 },
      });

      offsetY += 140;
    }

    addBlueprint(newNodes, newEdges);
    setCreated((prev) => {
      const next = new Set(prev);
      requiredMissing.forEach((d) => next.add(d.resourceType));
      return next;
    });
  };

  const providerLabel = cloudProvider === 'aws' ? 'AWS' : cloudProvider === 'azure' ? 'Azure' : cloudProvider === 'gcp' ? 'GCP' : 'Ansible';

  return (
    <div className="mt-3 rounded-xl border border-amber-700/50 bg-amber-950/30 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-900/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-300">{providerLabel} Dependencies</span>
          {requiredMissing.length > 0 && (
            <span className="text-[9px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-full font-bold">
              {requiredMissing.length} required
            </span>
          )}
          {optionalMissing.length > 0 && (
            <span className="text-[9px] bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full">
              {optionalMissing.length} optional
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronUp size={13} className="text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {/* Create all required */}
          {requiredMissing.filter(d => !created.has(d.resourceType)).length > 1 && (
            <button
              onClick={handleCreateAll}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={13} />
              Add all {requiredMissing.filter(d => !created.has(d.resourceType)).length} required
              {requiredMissing.some(d => !created.has(d.resourceType) && existingByType.has(d.resourceType)) && ' (uses existing where possible)'}
            </button>
          )}

          {/* Required */}
          {requiredMissing.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <AlertCircle size={10} className="text-red-400" />
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-wide">Required</span>
              </div>
              <div className="space-y-1.5">
                {requiredMissing.map((dep) => (
                  <DepRow
                    key={dep.resourceType}
                    dep={dep}
                    done={created.has(dep.resourceType)}
                    existingNode={existingByType.get(dep.resourceType)}
                    onAdd={() => handleCreate(dep)}
                    onConnect={(n) => handleConnectExisting(dep, n)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Optional */}
          {optionalMissing.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5 mt-2">
                <Info size={10} className="text-blue-400" />
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">Optional</span>
              </div>
              <div className="space-y-1.5">
                {optionalMissing.map((dep) => (
                  <DepRow
                    key={dep.resourceType}
                    dep={dep}
                    done={created.has(dep.resourceType)}
                    existingNode={existingByType.get(dep.resourceType)}
                    onAdd={() => handleCreate(dep)}
                    onConnect={(n) => handleConnectExisting(dep, n)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Already satisfied */}
          {satisfied.length > 0 && (
            <div className="pt-1 border-t border-white/5">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle2 size={10} className="text-green-400" />
                <span className="text-[9px] font-bold text-green-400 uppercase tracking-wide">Connected</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {satisfied.map((dep) => (
                  <span key={dep.resourceType} className="inline-flex items-center gap-1 text-[9px] text-green-400 bg-green-950/50 px-2 py-0.5 rounded-full border border-green-800/50">
                    <CheckCircle2 size={8} />
                    {dep.icon} {dep.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Single dependency row ─────────────────────────────────────────────────────
function DepRow({
  dep, done, existingNode, onAdd, onConnect,
}: {
  dep: AnyDep;
  done: boolean;
  existingNode?: Node<ResourceNodeData>;
  onAdd: () => void;
  onConnect: (n: Node<ResourceNodeData>) => void;
}) {
  const hasExisting = !!existingNode && !done;

  return (
    <div className={`flex items-start gap-2 rounded-lg p-2 border transition-all ${
      done        ? 'bg-green-950/30 border-green-800/40'
      : hasExisting ? 'bg-blue-950/30 border-blue-700/50'
      : dep.required ? 'bg-red-950/30 border-red-800/40 hover:bg-red-950/50'
      : 'bg-gray-800/40 border-gray-700/40 hover:bg-gray-800/60'
    }`}>
      <span className="text-base leading-none mt-0.5 flex-shrink-0">{dep.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-semibold ${done ? 'text-green-400' : hasExisting ? 'text-blue-300' : 'text-gray-200'}`}>
            {dep.label}
          </span>
          {dep.required && !done && (
            <span className="text-[8px] bg-red-600/70 text-red-200 px-1 py-0.5 rounded font-bold">REQUIRED</span>
          )}
          {hasExisting && (
            <span className="text-[8px] bg-blue-600/70 text-blue-200 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
              <Link size={7} />
              "{existingNode!.data.resourceName}" exists
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{dep.reason}</p>
      </div>

      {done ? (
        <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
      ) : hasExisting ? (
        /* Two buttons: connect existing OR create new */
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onConnect(existingNode!); }}
            className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
          >
            <Link size={9} />
            Use existing
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-200 px-2 py-1 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <Plus size={9} />
            New
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0 transition-colors ${
            dep.required ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          <Plus size={10} />
          Add
        </button>
      )}
    </div>
  );
}


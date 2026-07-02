import { useCallback, useEffect, useState } from 'react';
import { ReactFlowInstance } from 'reactflow';
import { DollarSign, Shield, GitCompare, Globe, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Canvas from '../components/Canvas';
import ConfigPanel from '../components/ConfigPanel';
import CodePanel from '../components/CodePanel';
import CostPanel from '../components/CostPanel';
import SecurityPanel from '../components/SecurityPanel';
import DiffPanel from '../components/DiffPanel';
import DriftPanel from '../components/DriftPanel';
import AIChatPanel from '../components/AIChatPanel';
import RightPanelDock, { type DockTab } from '../components/RightPanelDock';
import { ResourceDefinition } from '../types/resources';
import { useStore } from '../store/useStore';
import {
  CROSSPLANE_AWS_DEFINITIONS,
  CROSSPLANE_AZURE_DEFINITIONS,
  CROSSPLANE_GCP_DEFINITIONS,
} from '../data/crossplaneDefinitions';

const idCounter = { current: 1 };

const ALL_DEFINITIONS: Record<string, ResourceDefinition[]> = {
  aws:   CROSSPLANE_AWS_DEFINITIONS as ResourceDefinition[],
  azure: CROSSPLANE_AZURE_DEFINITIONS as ResourceDefinition[],
  gcp:   CROSSPLANE_GCP_DEFINITIONS as ResourceDefinition[],
};

export default function CrossplaneDashboard() {
  const { addNode, selectedNodeId, crossplaneCloud } = useStore();

  useEffect(() => {
    useStore.getState().setCloudProvider('crossplane');
  }, []);

  const [draggedDefinition, setDraggedDefinition] = useState<ResourceDefinition | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, definition: ResourceDefinition) => {
    e.dataTransfer.setData('application/resourceLabel', definition.label);
    e.dataTransfer.setData('application/resourceType', definition.type);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedDefinition(definition);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, rfInstance: ReactFlowInstance) => {
      const label = e.dataTransfer.getData('application/resourceLabel');
      const type  = e.dataTransfer.getData('application/resourceType');
      if (!label && !type) return;

      const position = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `node_${idCounter.current++}`;

      const providerDefs = ALL_DEFINITIONS[crossplaneCloud];
      const definition = providerDefs?.find((d) => d.label === label)
        ?? providerDefs?.find((d) => d.type === type);
      if (!definition) return;

      const defaultConfig: Record<string, string | number | boolean> = {};
      definition.fields.forEach((f) => {
        if (f.default !== undefined) defaultConfig[f.key] = f.default;
      });

      const cleanName = definition.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      addNode({
        id,
        type: 'resourceNode',
        position,
        data: {
          resourceType: definition.type,
          resourceName: `${cleanName}_${idCounter.current - 1}`,
          config: defaultConfig,
          definition,
        },
      });

      setDraggedDefinition(null);
    },
    [addNode, crossplaneCloud]
  );

  const panelTabs: DockTab[] = [
    { id: 'code',     icon: <span className="font-mono text-[10px] font-bold">{'{}'}</span>, label: 'Code',     title: 'Generated Manifests', content: <CodePanel /> },
    { id: 'cost',     icon: <DollarSign size={13} />,  label: 'Cost',     title: 'Cost Estimate',       content: <CostPanel /> },
    { id: 'security', icon: <Shield size={13} />,      label: 'Security', title: 'Security Audit',      content: <SecurityPanel /> },
    { id: 'diff',     icon: <GitCompare size={13} />,  label: 'Diff',     title: 'Diff View',           content: <DiffPanel /> },
    { id: 'drift',    icon: <Globe size={13} />,       label: 'Drift',    title: 'Drift Detection',     content: <DriftPanel /> },
    { id: 'ai',       icon: <Sparkles size={13} />,    label: 'AI',       title: 'AI Assistant',        content: <AIChatPanel /> },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-enter">
      <Header dashboard="crossplane" />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          fixedMode="crossplane"
          onDragStart={handleDragStart}
          onOpenBlueprints={() => {}}
        />

        <div className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
            <Canvas
              draggedDefinition={draggedDefinition}
              onDrop={handleDrop}
            />
            {selectedNodeId && <ConfigPanel />}
          </div>

          <RightPanelDock tabs={panelTabs} storageKey="crossplane_right_panel" />
        </div>
      </div>
    </div>
  );
}

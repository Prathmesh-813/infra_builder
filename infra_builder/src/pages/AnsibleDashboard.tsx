import { useCallback, useEffect, useState } from 'react';
import { ReactFlowInstance } from 'reactflow';
import { DollarSign, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Canvas from '../components/Canvas';
import ConfigPanel from '../components/ConfigPanel';
import CodePanel from '../components/CodePanel';
import CostPanel from '../components/CostPanel';
import AIChatPanel from '../components/AIChatPanel';
import RightPanelDock, { type DockTab } from '../components/RightPanelDock';
import { ResourceDefinition } from '../types/resources';
import { useStore } from '../store/useStore';
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions';

const idCounter = { current: 1 };

export default function AnsibleDashboard() {
  const { addNode, selectedNodeId } = useStore();

  useEffect(() => {
    useStore.getState().setCloudProvider('ansible');
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

      const definition = ANSIBLE_DEFINITIONS.find((d) => d.label === label)
        ?? ANSIBLE_DEFINITIONS.find((d) => d.type === type);
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
    [addNode]
  );

  const panelTabs: DockTab[] = [
    { id: 'code', icon: <span className="font-mono text-[10px] font-bold">{'{}'}</span>, label: 'Code', title: 'Generated Playbook', content: <CodePanel /> },
    { id: 'cost', icon: <DollarSign size={13} />,  label: 'Cost',  title: 'Cost Estimate', content: <CostPanel /> },
    { id: 'ai',   icon: <Sparkles size={13} />,    label: 'AI',    title: 'AI Assistant',  content: <AIChatPanel /> },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-enter">
      <Header dashboard="ansible" />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          fixedMode="ansible"
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

          <RightPanelDock tabs={panelTabs} storageKey="ansible_right_panel" />
        </div>
      </div>
    </div>
  );
}

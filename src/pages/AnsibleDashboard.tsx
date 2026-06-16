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
import { ResourceDefinition } from '../types/resources';
import { useStore } from '../store/useStore';
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions';

const idCounter = { current: 1 };

type RightPanel = 'code' | 'cost' | 'ai';

export default function AnsibleDashboard() {
  const { addNode, selectedNodeId } = useStore();

  useEffect(() => {
    useStore.getState().setCloudProvider('ansible');
  }, []);

  const [draggedDefinition, setDraggedDefinition] = useState<ResourceDefinition | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>('code');

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

  const panelTabs: Array<{ id: RightPanel; icon: React.ReactNode; label: string; title: string }> = [
    { id: 'code', icon: <span className="font-mono text-[10px] font-bold">{'{}'}</span>, label: 'Code', title: 'Generated Playbook' },
    { id: 'cost', icon: <DollarSign size={13} />,  label: 'Cost',  title: 'Cost Estimate' },
    { id: 'ai',   icon: <Sparkles size={13} />,    label: 'AI',    title: 'AI Assistant' },
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

          <div className="w-px flex-shrink-0" style={{ background: 'var(--border)' }} />

          <div className="flex flex-shrink-0 overflow-hidden" style={{ width: '40%' }}>
            <div
              className="flex flex-col w-12 flex-shrink-0 border-r"
              style={{ background: 'var(--bg-surface)', borderRightColor: 'var(--border)' }}
            >
              {panelTabs.map((tab) => {
                const isActive = rightPanel === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanel(tab.id)}
                    title={tab.title}
                    className="flex flex-col items-center justify-center gap-1 py-3.5 px-1 transition-all relative"
                    style={isActive ? {
                      background: 'var(--tab-active-bg)',
                      borderLeft: '2px solid var(--accent)',
                      color: 'var(--accent-light)',
                    } : {
                      borderLeft: '2px solid transparent',
                      color: 'var(--tab-inactive)',
                    }}
                  >
                    {tab.icon}
                    <span className="text-[8px] leading-none font-medium">{tab.label}</span>
                    {isActive && (
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-l"
                        style={{ background: 'var(--accent-border)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-hidden">
              <div key={rightPanel} className="fade-in h-full">
                {rightPanel === 'code' && <CodePanel />}
                {rightPanel === 'cost' && <CostPanel />}
                {rightPanel === 'ai'   && <AIChatPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

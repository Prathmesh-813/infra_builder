import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowInstance } from 'reactflow';
import { DollarSign, Shield, GitCompare, Globe, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Canvas from '../components/Canvas';
import ConfigPanel from '../components/ConfigPanel';
import CodePanel from '../components/CodePanel';
import BlueprintModal from '../components/BlueprintModal';
import TemplatesModal from '../components/TemplatesModal';
import CostPanel from '../components/CostPanel';
import SecurityPanel from '../components/SecurityPanel';
import DiffPanel from '../components/DiffPanel';
import DriftPanel from '../components/DriftPanel';
import AIChatPanel from '../components/AIChatPanel';
import PromptToDiagramModal from '../components/PromptToDiagramModal';
import DiagramScanModal from '../components/DiagramScanModal';
import ImportModal from '../components/ImportModal';
import { ResourceDefinition } from '../types/resources';
import { useStore } from '../store/useStore';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { AZURE_DEFINITIONS } from '../data/azureDefinitions';
import { GCP_DEFINITIONS } from '../data/gcpDefinitions';

const idCounter = { current: 1 };

const ALL_DEFINITIONS: Record<string, ResourceDefinition[]> = {
  aws:   RESOURCE_DEFINITIONS,
  azure: AZURE_DEFINITIONS as ResourceDefinition[],
  gcp:   GCP_DEFINITIONS as ResourceDefinition[],
};

type RightPanel = 'code' | 'cost' | 'security' | 'diff' | 'drift' | 'ai';

export default function TerraformDashboard() {
  const { addNode, selectedNodeId, cloudProvider } = useStore();

  useEffect(() => {
    const cp = useStore.getState().cloudProvider;
    if (!['aws', 'azure', 'gcp'].includes(cp)) {
      useStore.getState().setCloudProvider('aws');
    }
  }, []);

  const [draggedDefinition, setDraggedDefinition] = useState<ResourceDefinition | null>(null);
  const [showBlueprints, setShowBlueprints] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDiagramScan, setShowDiagramScan] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPromptToDiagram, setShowPromptToDiagram] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>('code');
  const blueprintOffset = useRef(1000);

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

      const providerDefs = ALL_DEFINITIONS[cloudProvider] ?? RESOURCE_DEFINITIONS;
      const definition = providerDefs.find((d) => d.label === label)
        ?? providerDefs.find((d) => d.type === type);
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
    [addNode, cloudProvider]
  );

  const handleBlueprintUsed = (nodeCount: number) => {
    blueprintOffset.current += nodeCount + 100;
  };

  const panelTabs: Array<{ id: RightPanel; icon: React.ReactNode; label: string; title: string }> = [
    { id: 'code',     icon: <span className="font-mono text-[10px] font-bold">{'{}'}</span>, label: 'Code',     title: 'Generated Code' },
    { id: 'cost',     icon: <DollarSign size={13} />,  label: 'Cost',     title: 'Cost Estimate' },
    { id: 'security', icon: <Shield size={13} />,      label: 'Security', title: 'Security Audit' },
    { id: 'diff',     icon: <GitCompare size={13} />,  label: 'Diff',     title: 'Diff View' },
    { id: 'drift',    icon: <Globe size={13} />,       label: 'Drift',    title: 'Drift Detection' },
    { id: 'ai',       icon: <Sparkles size={13} />,    label: 'AI',       title: 'AI Assistant' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-enter">
      <Header
        dashboard="terraform"
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenDiagramScan={() => setShowDiagramScan(true)}
        onOpenImport={() => setShowImport(true)}
        onOpenPromptToDiagram={() => setShowPromptToDiagram(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          fixedMode="terraform"
          onDragStart={handleDragStart}
          onOpenBlueprints={() => setShowBlueprints(true)}
        />

        <div className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
            <Canvas
              draggedDefinition={draggedDefinition}
              onDrop={handleDrop}
              onOpenBlueprints={() => setShowBlueprints(true)}
              onOpenPromptToDiagram={() => setShowPromptToDiagram(true)}
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
                {rightPanel === 'code'     && <CodePanel />}
                {rightPanel === 'cost'     && <CostPanel />}
                {rightPanel === 'security' && <SecurityPanel />}
                {rightPanel === 'diff'     && <DiffPanel />}
                {rightPanel === 'drift'    && <DriftPanel />}
                {rightPanel === 'ai'       && <AIChatPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBlueprints && (
        <BlueprintModal
          onClose={() => setShowBlueprints(false)}
          idOffset={blueprintOffset.current}
          onUsed={handleBlueprintUsed}
        />
      )}
      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
          idOffset={blueprintOffset.current}
          onUsed={handleBlueprintUsed}
        />
      )}
      {showDiagramScan && (
        <DiagramScanModal onClose={() => setShowDiagramScan(false)} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} />
      )}
      {showPromptToDiagram && (
        <PromptToDiagramModal onClose={() => setShowPromptToDiagram(false)} />
      )}
    </div>
  );
}

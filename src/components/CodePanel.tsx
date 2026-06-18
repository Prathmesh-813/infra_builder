import { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Download, Check, DollarSign, TrendingUp, ChevronDown, ChevronUp, Package, Layers, Edit3, Eye, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateTerraform } from '../utils/terraformGenerator';
import { generateAzureTerraform } from '../utils/azureGenerator';
import { generateGCPTerraform } from '../utils/gcpGenerator';
import { generateAnsiblePlaybook, generateInventoryFile } from '../utils/ansibleGenerator';
import { generateCrossplane, generateCrossplaneInstallManifest, generateCrossplaneCompositeResource } from '../utils/crossplaneGenerator';
import { estimateCosts } from '../utils/costEstimator';
import { buildTerraformProject, downloadAsZip } from '../utils/multiFileExport';
import { buildEnvTerraformProject, downloadEnvProjectAsZip } from '../utils/envGenerator';
import { parseHCL, mergeParsedConfig } from '../utils/hclParser';

// ── Cost bar (AWS only) ───────────────────────────────────────────────────────
function CostBar({ onToggleCosts, showCosts }: { onToggleCosts: () => void; showCosts: boolean }) {
  const { nodes } = useStore();
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => estimateCosts(nodes), [nodes]);
  if (nodes.length === 0) return null;

  const totalStr = summary.totalMin === summary.totalMax
    ? `$${summary.totalMin.toFixed(2)}`
    : `$${summary.totalMin.toFixed(0)}–$${summary.totalMax.toFixed(0)}`;

  return (
    <div className="border-b border-gray-700 bg-gray-900">
      <div className="flex items-center gap-2 px-4 py-2">
        <DollarSign size={13} className="text-green-400 flex-shrink-0" />
        <span className="text-xs text-gray-300 font-medium">Est. Monthly:</span>
        <span className="text-xs font-bold text-green-400">{totalStr}/mo</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleCosts}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
              showCosts ? 'bg-green-700/60 text-green-300 border border-green-600' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            <DollarSign size={10} />
            {showCosts ? 'Costs in code ✓' : 'Add to code'}
          </button>
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'Breakdown'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1 max-h-40 overflow-y-auto">
          {summary.items.map((item, i) => {
            const costStr = item.monthlyMax === 0 ? 'FREE'
              : item.monthlyMin === item.monthlyMax ? `$${item.monthlyMax.toFixed(2)}/mo`
              : `$${item.monthlyMin.toFixed(0)}–$${item.monthlyMax.toFixed(0)}/mo`;
            return (
              <div key={i} className="flex items-center gap-1.5 py-0.5">
                <span className="text-sm leading-none">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-gray-300 truncate block">{item.label}</span>
                  <span className="text-[9px] text-gray-500 truncate block">{item.resourceName}</span>
                </div>
                <span className={`text-[10px] font-semibold flex-shrink-0 ${item.monthlyMax === 0 ? 'text-green-400' : 'text-yellow-300'}`}>
                  {costStr}
                </span>
              </div>
            );
          })}
          <div className="col-span-2 border-t border-gray-700 pt-1.5 mt-1 flex justify-between">
            <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1">
              <TrendingUp size={10} className="text-green-400" /> Total
            </span>
            <span className="text-[10px] font-bold text-green-400">{totalStr}/mo</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CodePanel ────────────────────────────────────────────────────────────
export default function CodePanel() {
  const { nodes, edges, providerRegion, providerProfile, cloudProvider, updateNodeConfig } = useStore();
  const [copied, setCopied] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('main');
  // Toggle between standard single-file view and env-based multi-file view
  const [envMode, setEnvMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editableCode, setEditableCode] = useState<string>('');
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAnsible = cloudProvider === 'ansible';
  const isAWS = cloudProvider === 'aws';
  const isTerraform = cloudProvider === 'aws' || cloudProvider === 'azure' || cloudProvider === 'gcp';
  const isCrossplane = cloudProvider === 'crossplane';

  // Crossplane sub-provider selector
  const [cpSubProvider, setCpSubProvider] = useState<'aws' | 'azure' | 'gcp' | 'all'>('all');

  // Generate code based on provider
  const mainCode = useMemo(() => {
    if (cloudProvider === 'aws') return generateTerraform(nodes, providerRegion, providerProfile, showCosts, edges);
    if (cloudProvider === 'azure') return generateAzureTerraform(nodes, providerRegion, providerProfile);
    if (cloudProvider === 'gcp') return generateGCPTerraform(nodes, providerRegion, providerProfile);
    if (cloudProvider === 'ansible') return generateAnsiblePlaybook(nodes, edges);
    if (cloudProvider === 'crossplane') return generateCrossplane(nodes, providerRegion, providerProfile);
    return '';
  }, [nodes, edges, providerRegion, providerProfile, cloudProvider, showCosts]);

  const inventoryCode = useMemo(() =>
    isAnsible ? generateInventoryFile(nodes) : '',
    [nodes, isAnsible]
  );

  // Crossplane install manifest and composite resource
  const installManifest = useMemo(() =>
    isCrossplane ? generateCrossplaneInstallManifest(cpSubProvider) : '',
    [isCrossplane, cpSubProvider]
  );
  const compositeResource = useMemo(() =>
    isCrossplane ? generateCrossplaneCompositeResource(nodes, 'my-infrastructure') : '',
    [isCrossplane, nodes]
  );

  // Standard multi-file project (AWS only)
  const project = useMemo(() =>
    isAWS ? buildTerraformProject(nodes, providerRegion, providerProfile) : null,
    [nodes, providerRegion, providerProfile, isAWS]
  );

  // Environment-based project (all Terraform providers)
  const envProject = useMemo(() => {
    if (!isTerraform || !envMode) return null;
    const outputsTf = isAWS && project ? project['outputs.tf'] : '# No outputs defined\n';
    return buildEnvTerraformProject(cloudProvider, nodes, providerRegion, mainCode, outputsTf);
  }, [isTerraform, envMode, cloudProvider, nodes, providerRegion, mainCode, project, isAWS]);

  // ── Tab definitions ──────────────────────────────────────────────────────
  const tabs = useMemo(() => {
    if (isAnsible) {
      return [
        { id: 'main',      label: 'playbook.yml',  lines: mainCode.split('\n').length },
        { id: 'inventory', label: 'inventory.ini', lines: inventoryCode.split('\n').length },
      ];
    }

    if (isCrossplane) {
      return [
        { id: 'main',      label: 'managed-resources.yaml', lines: mainCode.split('\n').length },
        { id: 'install',   label: 'install.yaml',            lines: installManifest.split('\n').length },
        { id: 'composite', label: 'composition.yaml',        lines: compositeResource.split('\n').length },
      ];
    }

    if (envMode && envProject) {
      return [
        { id: 'main',            label: 'main.tf',            lines: envProject['main.tf'].split('\n').length },
        { id: 'providers',       label: 'providers.tf',       lines: envProject['providers.tf'].split('\n').length },
        { id: 'variables',       label: 'variables.tf',       lines: envProject['variables.tf'].split('\n').length },
        { id: 'outputs',         label: 'outputs.tf',         lines: envProject['outputs.tf'].split('\n').length },
        { id: 'env_dev',         label: 'envs/dev.tfvars',    lines: envProject['envs/dev.tfvars'].split('\n').length },
        { id: 'env_staging',     label: 'envs/staging.tfvars',lines: envProject['envs/staging.tfvars'].split('\n').length },
        { id: 'env_prod',        label: 'envs/prod.tfvars',   lines: envProject['envs/prod.tfvars'].split('\n').length },
        { id: 'readme',          label: 'README.md',          lines: envProject['README.md'].split('\n').length },
      ];
    }

    if (isAWS && project) {
      return [
        { id: 'main',      label: 'main.tf',      lines: mainCode.split('\n').length },
        { id: 'variables', label: 'variables.tf', lines: project['variables.tf'].split('\n').length },
        { id: 'outputs',   label: 'outputs.tf',   lines: project['outputs.tf'].split('\n').length },
        { id: 'providers', label: 'providers.tf', lines: project['providers.tf'].split('\n').length },
      ];
    }

    return [{ id: 'main', label: 'main.tf', lines: mainCode.split('\n').length }];
  }, [isAnsible, isCrossplane, envMode, envProject, isAWS, project, mainCode, inventoryCode, installManifest, compositeResource]);

  // Reset active tab when mode or provider changes
  const safeActiveTab = tabs.find(t => t.id === activeTab) ? activeTab : 'main';

  const tabCode: Record<string, string> = {
    main:        envMode && envProject ? envProject['main.tf']              : mainCode,
    inventory:   inventoryCode,
    install:     installManifest,
    composite:   compositeResource,
    variables:   envMode && envProject ? envProject['variables.tf']         : (project?.['variables.tf'] ?? ''),
    outputs:     envMode && envProject ? envProject['outputs.tf']           : (project?.['outputs.tf'] ?? ''),
    providers:   envMode && envProject ? envProject['providers.tf']         : (project?.['providers.tf'] ?? ''),
    env_dev:     envProject?.['envs/dev.tfvars']     ?? '',
    env_staging: envProject?.['envs/staging.tfvars'] ?? '',
    env_prod:    envProject?.['envs/prod.tfvars']    ?? '',
    readme:      envProject?.['README.md']           ?? '',
  };

  const currentCode = tabCode[safeActiveTab] ?? mainCode;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const isReadme = safeActiveTab === 'readme';
    const isTfvars = safeActiveTab.startsWith('env_');
    const ext = isAnsible
      ? (safeActiveTab === 'inventory' ? '.ini' : '.yml')
      : isCrossplane
      ? '.yaml'
      : isReadme ? '.md'
      : isTfvars ? '.tfvars'
      : '.tf';
    const filename = tabs.find(t => t.id === safeActiveTab)?.label.split('/').pop() ?? `file${ext}`;
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProject = async () => {
    if (isAnsible) {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('ansible-playbook')!;
      folder.file('playbook.yml', mainCode);
      folder.file('inventory.ini', inventoryCode);
      folder.file('README.md', `# Ansible Playbook\n\nGenerated by InfraStudio\n\n## Usage\n\n\`\`\`bash\nansible-playbook -i inventory.ini playbook.yml\n\`\`\`\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ansible-playbook.zip';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (isCrossplane) {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('crossplane-manifests')!;
      folder.file('managed-resources.yaml', mainCode);
      folder.file('install.yaml', installManifest);
      folder.file('composition.yaml', compositeResource);
      folder.file('README.md', `# Crossplane Manifests\n\nGenerated by InfraStudio\n\n## Usage\n\n\`\`\`bash\n# Install Crossplane\nhelm repo add crossplane-stable https://charts.crossplane.io/stable\nhelm install crossplane crossplane-stable/crossplane -n crossplane-system\n\n# Configure providers\nkubectl apply -f install.yaml\n\n# Deploy resources\nkubectl apply -f managed-resources.yaml\n\n# (Optional) Deploy as composite resource\nkubectl apply -f composition.yaml\n\`\`\`\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crossplane-manifests.zip';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (envMode && envProject) {
      setDownloading(true);
      try {
        await downloadEnvProjectAsZip(envProject, `${cloudProvider}-terraform-env-project`);
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (!project) return;
    setDownloading(true);
    try {
      await downloadAsZip(project, `${cloudProvider}-terraform-project`);
    } finally {
      setDownloading(false);
    }
  };

  // Monaco language: README uses markdown, tfvars uses hcl, ansible/crossplane uses yaml
  const lang = isAnsible || isCrossplane
    ? (safeActiveTab === 'inventory' ? 'ini' : 'yaml')
    : safeActiveTab === 'readme'
    ? 'markdown'
    : 'hcl';

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Cost bar — AWS only */}
      {isAWS && <CostBar onToggleCosts={() => setShowCosts(v => !v)} showCosts={showCosts} />}

      {/* Sub-provider selector — Crossplane only */}
      {isCrossplane && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
          <span className="text-[10px] text-gray-400">Provider:</span>
          {(['all', 'aws', 'azure', 'gcp'] as const).map(p => (
            <button
              key={p}
              onClick={() => setCpSubProvider(p)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                cpSubProvider === p
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p === 'all' ? 'All Providers' : p.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Mode toggle bar — Terraform providers only */}
      {isTerraform && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
          <Layers size={12} className="text-purple-400 flex-shrink-0" />
          <span className="text-[10px] text-gray-400">Mode:</span>
          <button
            onClick={() => { setEnvMode(false); setActiveTab('main'); }}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              !envMode ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => { setEnvMode(true); setActiveTab('main'); }}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              envMode ? 'bg-purple-600 text-white font-semibold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Env-based (dev / staging / prod)
          </button>
          {envMode && (
            <span className="ml-1 text-[9px] text-purple-300 bg-purple-900/40 border border-purple-700 px-1.5 py-0.5 rounded">
              separate .tfvars per environment
            </span>
          )}
        </div>
      )}

      {/* Sync message banner */}
      {syncMessage && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[10px] ${
          syncMessage.type === 'success' ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
        }`}>
          {syncMessage.type === 'success' ? <Check size={11} /> : <AlertTriangle size={11} />}
          {syncMessage.text}
          <button
            onClick={() => setSyncMessage(null)}
            className="ml-auto text-gray-500 hover:text-gray-300"
          >✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700 gap-2">
        {/* File tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
                safeActiveTab === tab.id
                  ? envMode && tab.id.startsWith('env_')
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'bg-blue-600 text-white font-semibold'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {tab.label}
              <span className={`text-[8px] px-1 py-0.5 rounded ${
                safeActiveTab === tab.id
                  ? tab.id.startsWith('env_') ? 'bg-purple-500' : 'bg-blue-500'
                  : 'bg-gray-700'
              }`}>
                {tab.lines}L
              </span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Edit mode toggle — Terraform only */}
          {isTerraform && (
            <button
              onClick={() => {
                if (!editMode) {
                  setEditableCode(currentCode);
                }
                setEditMode(!editMode);
                setSyncMessage(null);
              }}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded transition-colors ${
                editMode
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={editMode ? 'Switch to view-only mode' : 'Edit code and sync back to canvas'}
            >
              {editMode ? <Eye size={11} /> : <Edit3 size={11} />}
              {editMode ? 'View' : 'Edit'}
            </button>
          )}

          {/* Apply Changes — shown in edit mode */}
          {editMode && isTerraform && (
            <button
              onClick={() => {
                try {
                  const parsed = parseHCL(editableCode);
                  let updated = 0;
                  const nodeMap = new Map(nodes.map(n => [n.data?.resourceName, n]));
                  for (const p of parsed) {
                    const node = nodeMap.get(p.resourceName);
                    if (node) {
                      const merged = mergeParsedConfig(p, node.data.config);
                      updateNodeConfig(node.id, merged);
                      updated++;
                    }
                  }
                  setSyncMessage({
                    type: 'success',
                    text: `Synced ${updated} resource(s) from code to canvas.`,
                  });
                  setEditMode(false);
                } catch (e) {
                  setSyncMessage({
                    type: 'error',
                    text: 'Failed to parse HCL. Check syntax and try again.',
                  });
                }
              }}
              className="flex items-center gap-1 text-[10px] bg-green-600 hover:bg-green-500 text-white font-semibold px-2.5 py-1.5 rounded transition-colors"
            >
              <Check size={11} />
              Apply
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1.5 rounded transition-colors"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownloadSingle}
            className="flex items-center gap-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1.5 rounded transition-colors"
          >
            <Download size={11} />
            File
          </button>
          <button
            onClick={handleDownloadProject}
            disabled={downloading || nodes.length === 0}
            className={`flex items-center gap-1 text-[10px] disabled:opacity-50 text-white px-2.5 py-1.5 rounded transition-colors ${
              isCrossplane
                ? 'bg-sky-600 hover:bg-sky-500'
                : envMode
                ? 'bg-purple-600 hover:bg-purple-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
            title={
              isAnsible ? 'Download Ansible project ZIP'
              : isCrossplane ? 'Download Crossplane manifests ZIP'
              : envMode ? 'Download env-based project ZIP (dev + staging + prod)'
              : 'Download full project ZIP'
            }
          >
            <Package size={11} />
            {downloading ? 'Zipping…' : isCrossplane ? 'K8s ZIP' : envMode ? 'Env ZIP' : 'ZIP'}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={lang}
          value={editMode ? editableCode : currentCode}
          theme="vs-dark"
          onChange={(val) => {
            if (editMode && val !== undefined) {
              setEditableCode(val);
            }
          }}
          options={{
            readOnly: !editMode,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 10 },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          }}
        />
      </div>
    </div>
  );
}

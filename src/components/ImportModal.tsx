import { useState, useMemo, useCallback } from 'react';
import {
  X, Cloud, CheckSquare, Square, ChevronRight, Download,
  Code, Globe, Layers, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import ProviderIcon from './ProviderIcon';
import {
  discoverCloudResources,
  generateImportHCL,
  resourcesToCanvasNodes,
  DiscoveredResource,
} from '../utils/cloudImporter';

interface Props {
  onClose: () => void;
}

type Step = 'connect' | 'discover' | 'select' | 'preview' | 'imported';

interface Credentials {
  accessKey: string;
  secretKey: string;
  subscriptionId: string;
  apiKey: string;
  projectId: string;
}

const PROVIDER_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  aws:   { label: 'AWS',   icon: 'aws', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  azure: { label: 'Azure', icon: 'azure', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  gcp:   { label: 'GCP',   icon: 'gcp', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const TYPE_ICONS: Record<string, string> = {
  aws_instance: '🖥️',
  aws_vpc: '🌐',
  aws_subnet: '🔀',
  aws_security_group: '🛡️',
  aws_internet_gateway: '🚪',
  aws_eip: '📌',
  aws_nat_gateway: '🔁',
  aws_route_table: '🗺️',
  aws_lb: '⚖️',
  aws_s3_bucket: '🪣',
  aws_rds_instance: '🗄️',
  aws_lambda_function: '⚡',
  aws_dynamodb_table: '📊',
  aws_eks_cluster: '☸️',
  aws_ecs_cluster: '🐳',
  aws_route53_zone: '🌐',
  azurerm_linux_virtual_machine: '🖥️',
  azurerm_kubernetes_cluster: '☸️',
  azurerm_storage_account: '🪣',
  azurerm_cosmosdb_account: '🌍',
  google_compute_instance: '🖥️',
  google_container_cluster: '☸️',
  google_storage_bucket: '🪣',
  google_sql_database_instance: '🗄️',
};

export default function ImportModal({ onClose }: Props) {
  const { cloudProvider, providerRegion, addBlueprint } = useStore();

  const [step, setStep] = useState<Step>('connect');
  const [creds, setCreds] = useState<Credentials>({
    accessKey: '',
    secretKey: '',
    subscriptionId: '',
    apiKey: '',
    projectId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [discovered, setDiscovered] = useState<DiscoveredResource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const meta = PROVIDER_META[cloudProvider] ?? PROVIDER_META.aws;

  const handleDiscover = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const resources = await discoverCloudResources(
        cloudProvider as 'aws' | 'azure' | 'gcp',
        providerRegion,
        {
          accessKey: creds.accessKey || undefined,
          secretKey: creds.secretKey || undefined,
          subscriptionId: creds.subscriptionId || undefined,
          apiKey: creds.apiKey || undefined,
          projectId: creds.projectId || undefined,
        },
      );

      if (resources.length === 0) {
        setError('No resources found. Check your credentials and try again.');
        setIsLoading(false);
        return;
      }

      setDiscovered(resources);
      setSelectedIds(new Set(resources.map(r => r.id)));
      setStep('select');
    } catch (e) {
      setError(`Discovery failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [cloudProvider, providerRegion, creds]);

  const toggleResource = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(discovered.map(r => r.id)));
  }, [discovered]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const groupedByType = useMemo(() => {
    const groups = new Map<string, DiscoveredResource[]>();
    for (const r of discovered) {
      const key = r.resourceType;
      const existing = groups.get(key) ?? [];
      existing.push(r);
      groups.set(key, existing);
    }
    return groups;
  }, [discovered]);

  const generatedHCL = useMemo(() => {
    return generateImportHCL(
      discovered,
      Array.from(selectedIds),
      providerRegion,
      cloudProvider as 'aws' | 'azure' | 'gcp',
    );
  }, [discovered, selectedIds, providerRegion, cloudProvider]);

  const handleAddToCanvas = useCallback(() => {
    const { nodes, edges } = resourcesToCanvasNodes(discovered, Array.from(selectedIds));
    if (nodes.length > 0) {
      addBlueprint(nodes, edges);
      setStep('imported');
      setTimeout(onClose, 1500);
    }
  }, [discovered, selectedIds, addBlueprint, onClose]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(generatedHCL);
  }, [generatedHCL]);

  const handleDownloadCode = useCallback(() => {
    const blob = new Blob([generatedHCL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imported-${cloudProvider}-infra.tf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedHCL, cloudProvider]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedByType;
    const q = searchQuery.toLowerCase();
    const result = new Map<string, DiscoveredResource[]>();
    for (const [type, resources] of groupedByType) {
      const filtered = resources.filter(r =>
        r.resourceName.toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q),
      );
      if (filtered.length > 0) result.set(type, filtered);
    }
    return result;
  }, [groupedByType, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-indigo-950 to-gray-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Cloud size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-base">Import Existing Infra</h2>
                <span className="text-[9px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
                  NEW
                </span>
              </div>
              <p className="text-gray-400 text-xs">
                Discover cloud resources and generate clean Terraform HCL
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-gray-700/50 bg-gray-950/30 flex-shrink-0">
          {(['connect', 'discover', 'select', 'preview'] as Step[]).map((s, i) => {
            const stepIndex = ['connect', 'discover', 'select', 'preview'];
            const currentIndex = stepIndex.indexOf(step);
            const thisIndex = stepIndex.indexOf(s);
            const isActive = s === step || (step === 'imported' && s === 'preview');
            const isComplete = thisIndex < currentIndex || step === 'imported';
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <div className="w-6 h-px bg-gray-700" />}
                <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full transition-all ${
                  isActive ? 'bg-indigo-600/20 text-indigo-300' :
                  isComplete ? 'text-emerald-400' : 'text-gray-600'
                }`}>
                  {isComplete ? <CheckCircle2 size={10} /> : <span>{i + 1}</span>}
                  <span>{s === 'connect' ? 'Connect' : s === 'discover' ? 'Discover' : s === 'select' ? 'Select' : 'Generate'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'connect' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl" style={{ background: meta.bg, border: `1px solid ${meta.color}30` }}>
                <ProviderIcon provider={meta.icon as any} size={32} />
                <div>
                  <div className="text-sm font-semibold text-gray-200">{meta.label} Cloud Connection</div>
                  <div className="text-[10px] text-gray-500">
                    Provide credentials to discover existing resources in your {meta.label} account
                  </div>
                </div>
                <span className="ml-auto text-[8px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">read-only</span>
              </div>

              <div className="space-y-3">
                {cloudProvider === 'aws' && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1">Access Key ID</label>
                      <input
                        type="text"
                        value={creds.accessKey}
                        onChange={e => setCreds(p => ({ ...p, accessKey: e.target.value }))}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className="w-full text-[12px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 placeholder:text-gray-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1">Secret Access Key</label>
                      <input
                        type="password"
                        value={creds.secretKey}
                        onChange={e => setCreds(p => ({ ...p, secretKey: e.target.value }))}
                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                        className="w-full text-[12px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 placeholder:text-gray-600 font-mono"
                      />
                    </div>
                  </>
                )}

                {cloudProvider === 'azure' && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1">Subscription ID</label>
                      <input
                        type="text"
                        value={creds.subscriptionId}
                        onChange={e => setCreds(p => ({ ...p, subscriptionId: e.target.value }))}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        className="w-full text-[12px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 placeholder:text-gray-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1">Bearer Token</label>
                      <input
                        type="password"
                        value={creds.apiKey}
                        onChange={e => setCreds(p => ({ ...p, apiKey: e.target.value }))}
                        placeholder="your-azure-bearer-token"
                        className="w-full text-[12px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 placeholder:text-gray-600 font-mono"
                      />
                    </div>
                  </>
                )}

                {cloudProvider === 'gcp' && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1">Project ID</label>
                      <input
                        type="text"
                        value={creds.projectId}
                        onChange={e => setCreds(p => ({ ...p, projectId: e.target.value }))}
                        placeholder="my-gcp-project"
                        className="w-full text-[12px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 placeholder:text-gray-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1">API Key</label>
                      <input
                        type="password"
                        value={creds.apiKey}
                        onChange={e => setCreds(p => ({ ...p, apiKey: e.target.value }))}
                        placeholder="AIzaSy..."
                        className="w-full text-[12px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 placeholder:text-gray-600 font-mono"
                      />
                    </div>
                  </>
                )}

                {cloudProvider === 'ansible' && (
                  <div className="px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-800/50">
                    <p className="text-[11px] text-amber-400">
                      Cloud import is not available for Ansible mode. Switch to Terraform (AWS, Azure, or GCP) to import existing infrastructure.
                    </p>
                  </div>
                )}

                {cloudProvider === 'crossplane' && (
                  <div className="px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-800/50">
                    <p className="text-[11px] text-amber-400">
                      Cloud import is not available for Crossplane mode. Switch to Terraform (AWS, Azure, or GCP) to import existing infrastructure.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-400 bg-red-950/30 px-3 py-2 rounded-lg border border-red-900/50">
                  <AlertTriangle size={12} />
                  {error}
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 text-xs text-gray-400 hover:text-white transition-colors px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDiscover}
                  disabled={isLoading || cloudProvider === 'ansible' || cloudProvider === 'crossplane'}
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: 'white',
                  }}
                >
                  {isLoading ? <RefreshCw size={13} className="animate-spin" /> : <Globe size={13} />}
                  {isLoading ? 'Discovering...' : 'Discover Resources'}
                </button>
              </div>

              <p className="text-[9px] text-gray-600 text-center mt-3">
                Credentials are sent directly to the cloud provider API and are not stored. 
                We recommend using read-only credentials with minimal permissions.
              </p>
            </div>
          )}

          {step === 'select' && (
            <div className="flex flex-col h-full">
              {/* Stats bar */}
              <div className="px-5 py-3 border-b border-gray-700/50 bg-gray-950/30 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400">
                    <span className="text-white font-bold">{discovered.length}</span> resources discovered
                  </span>
                  <span className="text-[11px] text-gray-400">
                    <span className="text-indigo-400 font-bold">{selectedIds.size}</span> selected
                  </span>
                  <span className="text-[11px] text-gray-500">
                    in <span className="text-gray-300 font-medium">{groupedByType.size}</span> types
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800">
                    Select All
                  </button>
                  <button onClick={deselectAll} className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800">
                    Clear
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="px-5 py-2 border-b border-gray-700/30">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter resources by name or type..."
                  className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 placeholder:text-gray-600"
                />
              </div>

              {/* Resource list */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                {filteredGroups.size === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-gray-500 text-sm">No matching resources</p>
                  </div>
                )}

                {Array.from(filteredGroups.entries()).map(([type, resources]) => {
                  const selectedCount = resources.filter(r => selectedIds.has(r.id)).length;
                  const allSelected = selectedCount === resources.length;
                  const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  const icon = TYPE_ICONS[type] || '📦';

                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => {
                            if (allSelected) {
                              resources.forEach(r => selectedIds.delete(r.id));
                              setSelectedIds(new Set(selectedIds));
                            } else {
                              resources.forEach(r => selectedIds.add(r.id));
                              setSelectedIds(new Set(selectedIds));
                            }
                          }}
                          className="flex-shrink-0"
                        >
                          {allSelected
                            ? <CheckSquare size={14} className="text-indigo-400" />
                            : <Square size={14} className="text-gray-600" />
                          }
                        </button>
                        <span className="text-base">{icon}</span>
                        <span className="text-[12px] font-semibold text-gray-200">{typeLabel}</span>
                        <span className="text-[10px] text-gray-600 font-mono bg-gray-800 px-1.5 py-0.5 rounded">{type}</span>
                        <span className="text-[10px] text-gray-500">({selectedCount}/{resources.length})</span>
                      </div>

                      <div className="space-y-1 ml-7">
                        {resources.map(r => {
                          const isSelected = selectedIds.has(r.id);
                          return (
                            <button
                              key={r.id}
                              onClick={() => toggleResource(r.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-all hover:bg-gray-800/50"
                              style={isSelected ? {
                                background: 'rgba(99,102,241,0.08)',
                                border: '1px solid rgba(99,102,241,0.2)',
                              } : {
                                border: '1px solid transparent',
                              }}
                            >
                              {isSelected
                                ? <CheckSquare size={13} className="text-indigo-400 flex-shrink-0" />
                                : <Square size={13} className="text-gray-600 flex-shrink-0" />
                              }
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-gray-200 truncate">{r.resourceName}</div>
                                {r.region && <div className="text-[9px] text-gray-600">{r.region}</div>}
                              </div>
                              {Object.keys(r.tags).length > 0 && (
                                <span className="text-[8px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">
                                  {Object.keys(r.tags).length} tags
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="px-5 py-3 border-t border-gray-700/50 bg-gray-950/30 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setStep('connect')}
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <ArrowLeft size={12} />
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep('preview')}
                    disabled={selectedIds.size === 0}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    style={{
                      background: selectedIds.size > 0 ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'rgba(99,102,241,0.2)',
                      color: 'white',
                    }}
                  >
                    Generate HCL ({selectedIds.size})
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col h-full">
              {/* Stats bar */}
              <div className="px-5 py-3 border-b border-gray-700/50 bg-gray-950/30 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Code size={14} className="text-indigo-400" />
                  <span className="text-[11px] text-gray-400">
                    Generated HCL for <span className="text-white font-bold">{selectedIds.size}</span> resources
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleDownloadCode}
                    className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800"
                  >
                    <Download size={10} className="inline mr-1" />
                    Download
                  </button>
                </div>
              </div>

              {/* Code preview */}
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-[11px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {generatedHCL}
                </pre>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-700/50 bg-gray-950/30 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setStep('select')}
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <ArrowLeft size={12} />
                  Back to Selection
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg bg-gray-800"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleAddToCanvas}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-4 py-1.5 rounded-lg transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: 'white',
                    }}
                  >
                    <Layers size={12} />
                    Add to Canvas ({selectedIds.size})
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'imported' && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 border-2 border-emerald-500/50">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Resources Imported!</h3>
              <p className="text-sm text-gray-400 mb-2">
                {selectedIds.size} resources have been added to your canvas
              </p>
              <p className="text-xs text-gray-600">
                You can now configure them, add dependencies, and generate Terraform code.
              </p>
            </div>
          )}
        </div>

        {/* Footer for connect step */}
        {step === 'connect' && (
          <div className="px-6 py-3 border-t border-gray-700 bg-gray-950/50 flex items-center justify-between">
            <p className="text-[10px] text-gray-500">
              <span className="text-indigo-400 font-semibold">Note:</span> Only read-only access is needed. Your credentials are not stored.
            </p>
            <button
              onClick={onClose}
              className="text-[11px] text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

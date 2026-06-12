import { useState, useMemo, useCallback, useRef } from 'react';
import {
  RefreshCw, Upload, Cloud, Globe, CheckCircle2, AlertTriangle,
  XCircle, HelpCircle, FileText,
  Eye, EyeOff,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import ProviderIcon from './ProviderIcon';
import { generateTerraform } from '../utils/terraformGenerator';
import { generateAzureTerraform } from '../utils/azureGenerator';
import { generateGCPTerraform } from '../utils/gcpGenerator';
import { detectDrift, DriftItem, DriftReport, ParsedResource } from '../utils/driftDetector';
import { fetchCloudState, CloudCredentials, CloudSource } from '../utils/cloudStateProvider';

type ConnectionMode = 'tfstate' | 'api' | 'paste';

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  aws:   { label: 'AWS',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  azure: { label: 'Azure', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  gcp:   { label: 'GCP',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  synced:    { icon: <CheckCircle2 size={14} />, label: 'Synced',    color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  drifted:   { icon: <AlertTriangle size={14} />, label: 'Drifted',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  missing:   { icon: <XCircle size={14} />,       label: 'Missing',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  untracked: { icon: <HelpCircle size={14} />,    label: 'Untracked',color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
};

function StatusBadge({ status }: { status: DriftItem['status'] }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: m.bg, color: m.color }}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function ResourceRow({
  item,
  selected,
  onClick,
}: {
  item: DriftItem;
  selected: boolean;
  onClick: () => void;
}) {
  const m = STATUS_META[item.status];
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all rounded-lg"
      style={selected ? {
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.3)',
      } : {
        background: 'transparent',
        border: '1px solid transparent',
      }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: m.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-200 truncate">{item.resourceName}</span>
        </div>
        <span className="text-[9px] text-gray-500 truncate block">{item.resourceType}</span>
      </div>
      <StatusBadge status={item.status} />
    </button>
  );
}

function DetailDiff({ item }: { item: DriftItem }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? item.diffAttrs : item.diffAttrs.filter(d => d.changed);

  if (item.diffAttrs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <CheckCircle2 size={24} className="text-green-400 mb-2" />
        <p className="text-[11px] text-gray-400">No attributes to compare</p>
      </div>
    );
  }

  const changedCount = item.diffAttrs.filter(d => d.changed).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-200">{item.resourceName}</span>
          <StatusBadge status={item.status} />
        </div>
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showAll ? <EyeOff size={11} /> : <Eye size={11} />}
          {showAll ? 'Changed only' : `All (${item.diffAttrs.length})`}
        </button>
      </div>

      <div className="px-3 py-2 border-b border-gray-700 bg-gray-900/50">
        <div className="flex text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
          <div className="flex-1">Generated (attribute)</div>
          <div className="flex-1 text-right">Real State (attribute)</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="font-mono text-[10px]">
          {visible.length === 0 && (
            <div className="flex items-center justify-center py-6 text-gray-500">
              No changes to display
            </div>
          )}
            {visible.map((attr) => (
            <div
              key={attr.key}
              className={`flex items-start px-3 py-1.5 border-b ${
                attr.changed ? 'bg-amber-950/20 border-amber-900/30' : 'border-gray-800/50'
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="text-gray-600 block text-[8px]">{attr.key}</span>
                <span className={attr.changed ? 'text-red-400' : 'text-gray-300'}>
                  {attr.generated || <span className="text-gray-600 italic">—</span>}
                </span>
              </div>
              <div className="flex-shrink-0 px-1">
                {attr.changed ? (
                  <span className="text-amber-400 font-bold text-[9px]">→</span>
                ) : (
                  <span className="text-gray-700 text-[9px]">=</span>
                )}
              </div>
              <div className="flex-1 min-w-0 pl-2 text-right">
                <span className="text-gray-600 block text-[8px]">{attr.key}</span>
                <span className={attr.changed ? 'text-green-400' : 'text-gray-300'}>
                  {attr.real || <span className="text-gray-600 italic">—</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {changedCount > 0 && (
        <div className="px-3 py-2 border-t border-gray-700 bg-gray-900/50">
          <p className="text-[9px] text-amber-400">
            {changedCount} attribute{changedCount !== 1 ? 's' : ''} differ
            {item.status === 'missing' ? ' — resource not found in cloud' : ''}
            {item.status === 'untracked' ? ' — resource exists in cloud only' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export default function DriftPanel() {
  const { nodes, providerRegion, providerProfile, cloudProvider } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('tfstate');
  const [apiCreds, setApiCreds] = useState<CloudCredentials>({ region: providerRegion });
  const [pasteInput, setPasteInput] = useState('');
  const [realResources, setRealResources] = useState<ParsedResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  const generatedCode = useMemo(() => {
    if (cloudProvider === 'aws') return generateTerraform(nodes, providerRegion, providerProfile);
    if (cloudProvider === 'azure') return generateAzureTerraform(nodes, providerRegion, providerProfile);
    if (cloudProvider === 'gcp') return generateGCPTerraform(nodes, providerRegion, providerProfile);
    return '';
  }, [nodes, providerRegion, providerProfile, cloudProvider]);

  const report: DriftReport = useMemo(() => {
    if (!connected || realResources.length === 0) {
      return { items: [], summary: { synced: 0, drifted: 0, missing: 0, untracked: 0, total: 0 } };
    }
    return detectDrift(nodes, realResources, generatedCode);
  }, [nodes, realResources, generatedCode, connected]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    try {
      const text = await file.text();
      const { parseTFState } = await import('../utils/driftDetector');
      const parsed = parseTFState(text);
      if (parsed.length === 0) {
        setError('No managed resources found in the state file.');
        return;
      }
      setRealResources(parsed);
      setConnected(true);
    } catch {
      setError('Failed to parse terraform state file. Make sure it is valid JSON.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConnectAPI = useCallback(async () => {
    if (!apiCreds.accessKey && !apiCreds.apiKey) {
      setError('Please provide credentials for the selected cloud provider.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const source = cloudProvider === 'aws' ? 'aws' : cloudProvider === 'gcp' ? 'gcp' : 'azure';
      if (source === 'gcp' || source === 'azure') {
        setError('Direct API connection for this provider requires a backend proxy. Use "Import tfstate" instead.');
        setIsLoading(false);
        return;
      }
      const parsed = await fetchCloudState(source as CloudSource, apiCreds);
      if (parsed.length === 0) {
        setError('No resources found. Check your credentials and region.');
        setIsLoading(false);
        return;
      }
      setRealResources(parsed);
      setConnected(true);
    } catch {
      setError('Failed to connect to cloud provider API.');
    } finally {
      setIsLoading(false);
    }
  }, [apiCreds, cloudProvider]);

  const handlePasteConnect = useCallback(async () => {
    if (!pasteInput.trim()) {
      setError('Please paste your cloud state JSON.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { parseTFState } = await import('../utils/driftDetector');
      const parsed = parseTFState(pasteInput);
      if (parsed.length === 0) {
        setError('No resources found in the pasted content. Make sure it is valid Terraform state JSON.');
        setIsLoading(false);
        return;
      }
      setRealResources(parsed);
      setConnected(true);
    } catch {
      setError('Failed to parse the pasted content.');
    } finally {
      setIsLoading(false);
    }
  }, [pasteInput]);

  const handleDisconnect = useCallback(() => {
    setRealResources([]);
    setConnected(false);
    setSelectedResource(null);
    setError('');
  }, []);

  const selectedItem = report.items.find(
    i => `${i.resourceType}.${i.resourceName}` === selectedResource,
  );

  const summary = report.summary;
  const hasData = connected && realResources.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-app)' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-700/50 bg-gradient-to-r from-indigo-950/40 to-gray-900/40">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={15} className="text-indigo-400" />
          <span className="text-sm font-bold text-white">Drift Detection</span>
          {isLoading && <RefreshCw size={12} className="text-indigo-400 animate-spin ml-auto" />}
        </div>
        <p className="text-[10px] text-gray-500">
          Compare generated Terraform against real cloud state
        </p>
      </div>

      {/* ── Connection Panel ─────────────────────────────────────────────────── */}
      {!connected && (
        <div className="px-3 py-3 border-b border-gray-700/50 bg-gray-900/30">
          {/* Mode selector */}
          <div className="flex gap-1 mb-3">
            {([
              { id: 'tfstate' as const, label: 'Import tfstate', icon: <Upload size={11} /> },
              { id: 'api' as const, label: 'Cloud API', icon: <Cloud size={11} /> },
              { id: 'paste' as const, label: 'Paste JSON', icon: <FileText size={11} /> },
            ]).map(mode => (
              <button
                key={mode.id}
                onClick={() => { setConnectionMode(mode.id); setError(''); }}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-colors flex-1 justify-center ${
                  connectionMode === mode.id
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {mode.icon}
                {mode.label}
              </button>
            ))}
          </div>

          {/* tfstate file upload */}
          {connectionMode === 'tfstate' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.tfstate"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold px-4 py-3 rounded-xl border-2 border-dashed transition-all disabled:opacity-50"
                style={{
                  borderColor: 'rgba(99,102,241,0.3)',
                  color: 'var(--text-secondary)',
                  background: 'rgba(99,102,241,0.05)',
                }}
              >
                <Upload size={14} className="text-indigo-400" />
                {isLoading ? 'Parsing...' : 'Click to upload terraform.tfstate'}
              </button>
              <p className="text-[9px] text-gray-600 mt-1.5 text-center">
                Download from your Terraform backend or run <code className="text-indigo-400 bg-indigo-950/40 px-1 rounded">terraform show -json</code>
              </p>
            </div>
          )}

          {/* Direct API connection */}
          {connectionMode === 'api' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                {PROVIDER_META[cloudProvider] && (
                  <>
                    <ProviderIcon provider={cloudProvider as any} size={20} />
                    <span className="text-[11px] font-semibold text-gray-200">{PROVIDER_META[cloudProvider]?.label ?? cloudProvider} API</span>
                    <span className="text-[8px] text-gray-500 ml-auto bg-gray-800 px-1.5 py-0.5 rounded">direct</span>
                  </>
                )}
              </div>

              {cloudProvider === 'aws' && (
                <>
                  <input
                    type="text"
                    placeholder="Access Key ID"
                    value={apiCreds.accessKey ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, accessKey: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                  <input
                    type="password"
                    placeholder="Secret Access Key"
                    value={apiCreds.secretKey ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, secretKey: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                  <input
                    type="text"
                    placeholder="Region (e.g. us-east-1)"
                    value={apiCreds.region ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, region: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                </>
              )}

              {cloudProvider === 'gcp' && (
                <>
                  <input
                    type="text"
                    placeholder="Project ID"
                    value={apiCreds.projectId ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, projectId: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                  <input
                    type="password"
                    placeholder="API Key"
                    value={apiCreds.apiKey ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, apiKey: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                </>
              )}

              {cloudProvider === 'azure' && (
                <>
                  <input
                    type="text"
                    placeholder="Subscription ID"
                    value={apiCreds.subscriptionId ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, subscriptionId: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                  <input
                    type="password"
                    placeholder="Bearer Token"
                    value={apiCreds.apiKey ?? ''}
                    onChange={e => setApiCreds(p => ({ ...p, apiKey: e.target.value }))}
                    className="w-full text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder:text-gray-600"
                  />
                </>
              )}

              <button
                onClick={handleConnectAPI}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: 'white',
                }}
              >
                {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
                {isLoading ? 'Connecting...' : 'Connect & Fetch State'}
              </button>

              <p className="text-[9px] text-amber-500/70 text-center">
                API keys are sent directly to the cloud provider and are not stored.
              </p>
            </div>
          )}

          {/* Paste JSON */}
          {connectionMode === 'paste' && (
            <div className="space-y-2">
              <textarea
                rows={6}
                placeholder={`Paste your Terraform state JSON here.\n\nYou can get this by running:\n  terraform show -json\n\nOr paste a .tfstate file contents directly.`}
                value={pasteInput}
                onChange={e => setPasteInput(e.target.value)}
                className="w-full text-[10px] font-mono bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder:text-gray-600 resize-none"
              />
              <button
                onClick={handlePasteConnect}
                disabled={isLoading || !pasteInput.trim()}
                className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: 'white',
                }}
              >
                {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />}
                {isLoading ? 'Parsing...' : 'Parse & Connect'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-950/30 px-3 py-2 rounded-lg border border-red-900/50">
              <AlertTriangle size={11} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Connected State ──────────────────────────────────────────────────── */}
      {hasData && (
        <>
          {/* Summary bar */}
          <div className="px-3 py-2 border-b border-gray-700/50 bg-gray-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Drift Summary</span>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <RefreshCw size={10} />
                Disconnect
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { status: 'synced' as const, count: summary.synced },
                { status: 'drifted' as const, count: summary.drifted },
                { status: 'missing' as const, count: summary.missing },
                { status: 'untracked' as const, count: summary.untracked },
              ]).map(({ status, count }) => {
                const m = STATUS_META[status];
                return (
                  <div
                    key={status}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-lg"
                    style={{ background: m.bg }}
                  >
                    <span className="text-[16px] font-bold" style={{ color: m.color }}>{count}</span>
                    <span className="text-[8px] text-gray-500">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resource list */}
          <div className="flex-1 overflow-y-auto py-1.5 px-2 space-y-0.5">
            <div className="px-1 py-1 flex items-center justify-between">
              <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
                Resources ({summary.total})
              </span>
            </div>
            {report.items.map(item => {
              const key = `${item.resourceType}.${item.resourceName}`;
              return (
                <ResourceRow
                  key={key}
                  item={item}
                  selected={selectedResource === key}
                  onClick={() => setSelectedResource(key)}
                />
              );
            })}
          </div>

          {/* Detail panel for selected resource */}
          {selectedItem && (
            <div
              className="border-t border-gray-700/50"
              style={{ height: '45%', minHeight: 200 }}
            >
              <DetailDiff item={selectedItem} />
            </div>
          )}

          {report.items.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
              <CheckCircle2 size={28} className="text-green-500 mb-2" />
              <p className="text-[12px] font-semibold text-gray-300">Everything is synced</p>
              <p className="text-[10px] text-gray-500 mt-1">
                No drift detected between your generated Terraform and cloud state.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Empty state (no connection, no data) ─────────────────────────────── */}
      {!hasData && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Globe size={32} className="text-gray-700 mb-3" />
          <p className="text-[13px] font-semibold text-gray-400 mb-1">No Cloud Connection</p>
          <p className="text-[10px] text-gray-600 leading-relaxed max-w-xs">
            Import a Terraform state file, paste JSON output from{' '}
            <code className="text-indigo-400 bg-indigo-950/40 px-1 rounded">terraform show -json</code>,
            or connect directly to a cloud provider API to detect drift.
          </p>
        </div>
      )}

      {/* Footer */}
      {hasData && (
        <div className="px-3 py-2 border-t border-gray-700/50 bg-gray-900/30">
          <p className="text-[8px] text-gray-600 text-center">
            Generated HCL vs {realResources.length} real resource{realResources.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// OzDeployBar.tsx
// ---------------
// The Design -> Deploy bridge of the merged product. A floating launcher that
// takes the current canvas design, generates its IaC, and hands it to an Oz
// agent (via the Oz control-plane API) for provisioning. Mounted globally so it
// is reachable from every InfraStudio dashboard without touching those screens.
import { useEffect, useMemo, useState } from 'react';
import { Node, Edge } from 'reactflow';
import { Rocket, X, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ResourceNodeData } from '../types/resources';
import { generateTerraform } from '../utils/terraformGenerator';
import { generateAnsiblePlaybook } from '../utils/ansibleGenerator';
import { deployToOz } from '../utils/ozClient';
import { toast } from '../store/toastStore';

const AGENTS = [
  { value: 'opencode', label: 'OpenCode (free, default)' },
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'gemini-cli', label: 'Gemini CLI' },
  { value: 'codex', label: 'Codex' },
];

export default function OzDeployBar() {
  const nodes = useStore((s) => s.nodes) as Node<ResourceNodeData>[];
  const edges = useStore((s) => s.edges) as Edge[];
  const region = useStore((s) => s.providerRegion);
  const profile = useStore((s) => s.providerProfile);
  const cloudProvider = useStore((s) => s.cloudProvider);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('infrastudio-design');
  const [agent, setAgent] = useState('opencode');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; id?: number } | null>(null);

  const iacType = cloudProvider === 'ansible' ? 'ansible' : 'terraform';

  // Generate IaC from the current canvas whenever the modal opens.
  const generated = useMemo(() => {
    if (!open) return '';
    try {
      return iacType === 'ansible'
        ? generateAnsiblePlaybook(nodes, edges)
        : generateTerraform(nodes, region, profile, false, edges);
    } catch (e) {
      return `# Failed to generate ${iacType}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [open, iacType, nodes, edges, region, profile]);

  const [iac, setIac] = useState('');
  // Sync the editable buffer to freshly generated code each time the modal opens.
  useEffect(() => { if (open) setIac(generated); }, [open, generated]);

  const onDeploy = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await deployToOz({ name, iac, iacType, agentType: agent });
      setResult({ ok: true, msg: res.message || 'Agent launched', id: res.id });
      toast.success(`Deploying "${name}" — agent run #${res.id} launched`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Deploy failed';
      setResult({ ok: false, msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => { setOpen(true); setResult(null); }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 30px rgba(99,102,241,0.4)' }}
        title="Deploy this design via an Oz agent"
      >
        <Rocket size={16} /> Deploy to Oz
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'var(--bg-overlay)' }} onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Rocket size={18} className="text-indigo-400" />
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Deploy design via Oz
                </h2>
              </div>
              <button onClick={() => !busy && setOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Design name
                  </label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Oz agent ({iacType})
                  </label>
                  <select value={agent} onChange={(e) => setAgent(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                    {AGENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Generated {iacType} (editable)
                </label>
                <textarea value={iac} onChange={(e) => setIac(e.target.value)} rows={12}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg resize-y"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
              </div>

              {result && (
                <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5"
                  style={result.ok
                    ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7' }
                    : { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
                  {result.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                  <div>
                    <div>{result.msg}{result.id != null ? ` (run #${result.id})` : ''}</div>
                    {result.ok && (
                      <a href="/agents"
                        className="inline-flex items-center gap-1 mt-1 underline" style={{ color: '#6ee7b7' }}>
                        View in Agents <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4"
              style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => !busy && setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-input)' }}>
                Close
              </button>
              <button onClick={onDeploy} disabled={busy || !iac.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                {busy ? 'Launching…' : 'Launch Oz agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

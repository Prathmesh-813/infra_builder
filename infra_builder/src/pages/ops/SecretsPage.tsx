// Secrets — encrypted credential vault (values are write-only; never returned).
import { useState } from 'react';
import { Plus, KeyRound, Trash2, Loader2 } from 'lucide-react';
import { listSecrets, createSecret, deleteSecret, type Secret } from '../../utils/ozClient';
import { PageShell, relTime, Spinner, ErrorState, EmptyState, RefreshButton, useAsync, inputStyle } from './OpsCommon';
import { Modal, Field, ModalActions } from './AgentsPage';
import { toast } from '../../store/toastStore';

export default function SecretsPage() {
  const { data: secrets, loading, error, reload } = useAsync<Secret[]>(() => listSecrets(), []);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <PageShell title="Secrets" subtitle="Encrypted credentials injected into agent runs (values are never displayed)"
      actions={<>
        <RefreshButton onClick={reload} busy={loading} />
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          <Plus size={13} /> Add secret
        </button>
      </>}>
      {loading && !secrets ? <Spinner />
        : error ? <ErrorState message={error} onRetry={reload} />
        : !secrets?.length ? <EmptyState message="No secrets stored yet." />
        : (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                {['Name', 'Scope', 'Created', ''].map((h) => <th key={h} className="text-left font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">{h}</th>)}
              </tr></thead>
              <tbody>
                {secrets.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5 font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><KeyRound size={13} className="text-amber-400" />{s.name}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{s.scope}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{relTime(s.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button aria-label={`Delete secret ${s.name}`} title="Delete"
                        onClick={() => deleteSecret(s.id).then(() => { toast.success(`Deleted ${s.name}`); reload(); }).catch((e) => toast.error(e.message))}
                        className="p-1.5 rounded-lg text-red-400" style={{ border: '1px solid rgba(248,113,113,0.25)' }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {showAdd && <AddSecretModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); reload(); }} />}
    </PageShell>
  );
}

function AddSecretModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('user');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await createSecret({ name, value, scope }); toast.success(`Saved secret "${name}"`); onAdded(); }
    catch (e) { setBusy(false); setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <Modal title="Add secret" icon={<KeyRound size={16} className="text-amber-400" />} onClose={onClose}>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-ssh-key" className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
      <Field label="Value"><textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="secret value / private key…" className="w-full text-sm px-3 py-2 rounded-lg font-mono resize-y" style={inputStyle} /></Field>
      <Field label="Scope">
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle}>
          <option value="user">user</option><option value="global">global</option>
        </select>
      </Field>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy || !name || !value} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save
        </button>
      </ModalActions>
    </Modal>
  );
}

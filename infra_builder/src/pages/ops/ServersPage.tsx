// Servers — registered SSH/Docker targets the agents act on.
import { useEffect, useState } from 'react';
import { Plus, Server as ServerIcon, Trash2, Loader2 } from 'lucide-react';
import {
  listServers, createServer, deleteServer, listSecrets,
  type Server, type Secret,
} from '../../utils/ozClient';
import { PageShell, relTime, Spinner, ErrorState, EmptyState, RefreshButton, useAsync, inputStyle, Tag } from './OpsCommon';
import { Modal, Field, ModalActions } from './AgentsPage';
import { toast } from '../../store/toastStore';

export default function ServersPage() {
  const { data: servers, loading, error, reload } = useAsync<Server[]>(() => listServers(), []);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <PageShell title="Servers" subtitle="SSH / Docker targets available to agents"
      actions={<>
        <RefreshButton onClick={reload} busy={loading} />
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <Plus size={13} /> Register server
        </button>
      </>}>
      {loading && !servers ? <Spinner />
        : error ? <ErrorState message={error} onRetry={reload} />
        : !servers?.length ? <EmptyState message="No servers registered yet." />
        : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {servers.map((s) => (
              <div key={s.id} className="rounded-xl p-4 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}><ServerIcon size={15} className="text-emerald-400" /></div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                      <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{s.username}@{s.host}:{s.port}</p>
                    </div>
                  </div>
                  <button aria-label={`Delete server ${s.name}`} title="Delete"
                    onClick={() => deleteServer(s.id).then(() => { toast.success(`Deleted ${s.name}`); reload(); }).catch((e) => toast.error(e.message))}
                    className="p-1.5 rounded-lg text-red-400" style={{ border: '1px solid rgba(248,113,113,0.25)' }}><Trash2 size={13} /></button>
                </div>
                {s.description && <p className="text-xs mt-2.5" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <Tag color="gray">{s.auth_type}</Tag>
                  {s.tags?.map((t) => <Tag key={t} color="cyan">{t}</Tag>)}
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>added {relTime(s.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); reload(); }} />}
    </PageShell>
  );
}

function AddServerModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ name: '', host: '', port: '22', username: 'root', auth_type: 'password', tags: '', description: '' });
  const [secretId, setSecretId] = useState('');
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { listSecrets().then(setSecrets).catch(() => setSecrets([])); }, []);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const sid = secretId ? Number(secretId) : null;
      await createServer({
        name: f.name, host: f.host, port: Number(f.port) || 22, username: f.username, auth_type: f.auth_type,
        ssh_key_secret_id: f.auth_type === 'key' ? sid : null,
        ssh_password_secret_id: f.auth_type === 'password' ? sid : null,
        tags: f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        description: f.description || null,
      });
      toast.success(`Registered ${f.name}`);
      onAdded();
    } catch (e) { setBusy(false); setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <Modal title="Register server" icon={<ServerIcon size={16} className="text-emerald-400" />} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input value={f.name} onChange={set('name')} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
        <Field label="Host / IP"><input value={f.host} onChange={set('host')} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
        <Field label="Port"><input value={f.port} onChange={set('port')} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
        <Field label="Username"><input value={f.username} onChange={set('username')} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
        <Field label="Auth type">
          <select value={f.auth_type} onChange={set('auth_type')} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle}>
            <option value="password">password</option><option value="key">key</option>
          </select>
        </Field>
        <Field label={`Credential secret (${f.auth_type})`}>
          <select value={secretId} onChange={(e) => setSecretId(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle}>
            <option value="">— none —</option>
            {secrets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Tags (comma-separated)"><input value={f.tags} onChange={set('tags')} placeholder="prod, web" className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
      <Field label="Description"><input value={f.description} onChange={set('description')} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy || !f.name || !f.host} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Register
        </button>
      </ModalActions>
    </Modal>
  );
}

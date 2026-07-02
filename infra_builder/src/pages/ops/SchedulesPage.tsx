// Schedules — cron-driven agent runs.
import { useState } from 'react';
import { Plus, CalendarClock, Loader2, Power } from 'lucide-react';
import { listSchedules, createSchedule, toggleSchedule, AGENT_TYPES, type Schedule } from '../../utils/ozClient';
import { PageShell, relTime, Spinner, ErrorState, EmptyState, RefreshButton, useAsync, inputStyle, Tag } from './OpsCommon';
import { Modal, Field, ModalActions } from './AgentsPage';
import { toast } from '../../store/toastStore';

export default function SchedulesPage() {
  const { data: schedules, loading, error, reload } = useAsync<Schedule[]>(() => listSchedules(), []);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <PageShell title="Schedules" subtitle="Run agents automatically on a cron schedule"
      actions={<>
        <RefreshButton onClick={reload} busy={loading} />
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
          <Plus size={13} /> New schedule
        </button>
      </>}>
      {loading && !schedules ? <Spinner />
        : error ? <ErrorState message={error} onRetry={reload} />
        : !schedules?.length ? <EmptyState message="No schedules yet." />
        : (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                {['Name', 'Cron', 'Agent', 'Last run', 'Active', ''].map((h) => <th key={h} className="text-left font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">{h}</th>)}
              </tr></thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5 font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><CalendarClock size={13} className="text-sky-400" />{s.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{s.cron_expr}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{s.agent_type}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{relTime(s.last_run_at)}</td>
                    <td className="px-4 py-2.5">
                      <Tag color={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'active' : 'paused'}</Tag>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button aria-label={s.is_active ? `Pause ${s.name}` : `Activate ${s.name}`} title={s.is_active ? 'Pause' : 'Activate'}
                        onClick={() => toggleSchedule(s.id, !s.is_active).then(() => { toast.info(`${s.name} ${s.is_active ? 'paused' : 'activated'}`); reload(); }).catch((e) => toast.error(e.message))}
                        className="p-1.5 rounded-lg" style={{ color: s.is_active ? '#fdba74' : '#6ee7b7', border: '1px solid var(--border-input)' }}><Power size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {showAdd && <AddScheduleModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); reload(); }} />}
    </PageShell>
  );
}

function AddScheduleModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [cron, setCron] = useState('0 * * * *');
  const [agentType, setAgentType] = useState('opencode');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await createSchedule({ name, cron_expr: cron, agent_type: agentType, prompt_template: prompt || null }); toast.success(`Created schedule "${name}"`); onAdded(); }
    catch (e) { setBusy(false); setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <Modal title="New schedule" icon={<CalendarClock size={16} className="text-sky-400" />} onClose={onClose}>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cron expression"><input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 * * * *" className="w-full text-sm px-3 py-2 rounded-lg font-mono" style={inputStyle} /></Field>
        <Field label="Agent type">
          <select value={agentType} onChange={(e) => setAgentType(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg" style={inputStyle}>
            {AGENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Prompt template (optional)"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full text-sm px-3 py-2 rounded-lg resize-y" style={inputStyle} /></Field>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy || !name || !cron} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create
        </button>
      </ModalActions>
    </Modal>
  );
}

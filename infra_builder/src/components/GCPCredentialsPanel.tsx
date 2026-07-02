import { useState, useEffect } from 'react';
import {
  Key, CheckCircle, XCircle, Loader,
  ChevronDown, ChevronUp, Trash2, Shield, Zap, AlertTriangle,
} from 'lucide-react';
import {
  getGCPCredentialsStatus,
  testGCPCredentials,
  saveGCPCredentials,
  deleteGCPCredentials,
  GCPCredentialsStatus,
} from '../utils/gcpPricingClient';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface GCPCredentialsPanelProps {
  onCredentialsChange?: (configured: boolean) => void;
}

export default function GCPCredentialsPanel({ onCredentialsChange }: GCPCredentialsPanelProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GCPCredentialsStatus>({
    configured: false, masked_email: '', masked_project: '', message: '',
  });
  const [jsonText, setJsonText] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getGCPCredentialsStatus().then(s => {
      setStatus(s);
      setBackendOnline(s.message !== 'Backend unreachable');
      onCredentialsChange?.(s.configured);
    });
  }, []);

  const resetTest = () => { setTestStatus('idle'); setTestMessage(''); };

  const handleTest = async () => {
    if (!jsonText.trim()) return;
    setTestStatus('testing');
    setTestMessage('');
    try {
      const result = await testGCPCredentials(jsonText.trim());
      setTestStatus(result.valid ? 'success' : 'error');
      setTestMessage(result.message);
    } catch (e: unknown) {
      setTestStatus('error');
      setTestMessage(e instanceof Error ? e.message : 'Could not reach backend');
    }
  };

  const handleSave = async (skipValidation = false) => {
    setSaving(true);
    try {
      const s = await saveGCPCredentials(jsonText.trim(), skipValidation);
      setStatus(s);
      setJsonText('');
      resetTest();
      setOpen(false);
      onCredentialsChange?.(true);
    } catch (e: unknown) {
      setTestMessage(e instanceof Error ? e.message : 'Failed to save');
      setTestStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const s = await deleteGCPCredentials();
    setStatus(s);
    resetTest();
    onCredentialsChange?.(false);
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
  };

  const canSave = testStatus === 'success';
  const canForce = testStatus === 'error' && jsonText.trim().includes('"private_key"');

  return (
    <div className="rounded-xl overflow-hidden border mt-2"
      style={{ borderColor: status.configured ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.2)' }}>

      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
        style={{ background: status.configured ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)' }}>

        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: status.configured ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }}>
          {status.configured
            ? <CheckCircle size={16} className="text-red-400" />
            : <Key size={16} className="text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: status.configured ? '#f87171' : '#fb923c' }}>
            {status.configured ? 'GCP Live Pricing Active' : 'Configure GCP Live Pricing'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {status.configured
              ? `Real-time prices · ${status.masked_email} · ${status.masked_project}`
              : 'Paste service-account JSON for Cloud Billing Catalog API'}
          </p>
        </div>

        {status.configured && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Zap size={8} /> LIVE
          </span>
        )}
        {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
               : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="px-4 py-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>

          {backendOnline === false && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">Backend not running</p>
                <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                  backend/.venv/bin/uvicorn backend.main:app --reload --port 8001
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Shield size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              JSON is stored locally only (<code>backend/config/gcp_settings.json</code>, git-ignored).
              Requires <strong className="text-indigo-300">Cloud Billing API</strong> enabled and
              <strong className="text-indigo-300"> Billing Account Viewer</strong> (or Catalog API access).
              Private key is never returned via any API.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Service Account JSON
            </label>
            <textarea
              value={jsonText}
              onChange={e => { setJsonText(e.target.value); resetTest(); }}
              placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "..."\n}'}
              rows={8}
              className="w-full text-[10px] px-3 py-2.5 rounded-xl font-mono outline-none resize-y"
              style={inputStyle}
            />
          </div>

          {testMessage && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{
                background: testStatus === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${testStatus === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: testStatus === 'success' ? '#34d399' : '#f87171',
              }}>
              {testStatus === 'success' ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
                : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{testMessage}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleTest}
              disabled={!jsonText.trim() || testStatus === 'testing' || !backendOnline}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {testStatus === 'testing'
                ? <><Loader size={13} className="animate-spin" /> Testing…</>
                : testStatus === 'success'
                ? <><CheckCircle size={13} className="text-emerald-400" /> Verified</>
                : <><Key size={13} /> Test Connection</>}
            </button>

            <button onClick={() => handleSave(false)}
              disabled={!canSave || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-40"
              style={{ background: canSave ? 'linear-gradient(135deg,#dc2626,#f87171)' : 'rgba(255,255,255,0.08)' }}>
              {saving ? <><Loader size={13} className="animate-spin" /> Saving…</> : <><CheckCircle size={13} /> Save Credentials</>}
            </button>
          </div>

          {canForce && (
            <button onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-xl transition-all"
              style={{ color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
              <AlertTriangle size={12} />
              Save without validating
            </button>
          )}

          {status.configured && (
            <button onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-xl transition-all"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <Trash2 size={12} className="text-red-400" />
              Remove saved credentials (revert to static pricing)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

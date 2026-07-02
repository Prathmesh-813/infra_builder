import { useState, useEffect } from 'react';
import {
  Key, Eye, EyeOff, CheckCircle, XCircle, Loader,
  ChevronDown, ChevronUp, Trash2, Shield, Zap, AlertTriangle, Wifi,
} from 'lucide-react';
import {
  getCredentialsStatus,
  testCredentials,
  saveCredentials,
  deleteCredentials,
  CredentialsStatus,
} from '../utils/awsPricingClient';

type TestStatus = 'idle' | 'testing' | 'success' | 'error' | 'network_error';

interface AWSCredentialsPanelProps {
  onCredentialsChange?: (configured: boolean) => void;
}

export default function AWSCredentialsPanel({ onCredentialsChange }: AWSCredentialsPanelProps) {
  const [open, setOpen]               = useState(false);
  const [status, setStatus]           = useState<CredentialsStatus>({ configured: false, masked_key: '', message: '' });
  const [accessKey, setAccessKey]     = useState('');
  const [secretKey, setSecretKey]     = useState('');
  const [showSecret, setShowSecret]   = useState(false);
  const [testStatus, setTestStatus]   = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_errorCode, setErrorCode]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getCredentialsStatus().then(s => {
      setStatus(s);
      setBackendOnline(s.message !== 'Backend unreachable');
      onCredentialsChange?.(s.configured);
    });
  }, []);

  const resetTest = () => { setTestStatus('idle'); setTestMessage(''); setErrorCode(''); };

  const handleTest = async () => {
    if (!accessKey.trim() || !secretKey.trim()) return;
    setTestStatus('testing');
    setTestMessage('');
    setErrorCode('');
    try {
      const result = await testCredentials(accessKey.trim(), secretKey.trim());
      const isNetworkErr = result.error_code === 'NETWORK_ERROR' || result.error_code === 'CONNECTION_ERROR';
      setTestStatus(result.valid ? 'success' : isNetworkErr ? 'network_error' : 'error');
      setTestMessage(result.message);
      setErrorCode(result.error_code ?? '');
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.message ?? 'Could not reach backend');
    }
  };

  const handleSave = async (skipValidation = false) => {
    setSaving(true);
    try {
      const s = await saveCredentials(accessKey.trim(), secretKey.trim(), skipValidation);
      setStatus(s);
      setAccessKey(''); setSecretKey('');
      resetTest();
      setOpen(false);
      onCredentialsChange?.(true);
    } catch (e: any) {
      setTestMessage(e.message ?? 'Failed to save');
      setTestStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const s = await deleteCredentials();
    setStatus(s);
    resetTest();
    onCredentialsChange?.(false);
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
  };

  const canSave    = testStatus === 'success';
  const canForce   = testStatus === 'network_error' && accessKey.trim().length > 15 && secretKey.trim().length > 20;

  return (
    <div className="rounded-xl overflow-hidden border"
      style={{ borderColor: status.configured ? 'rgba(16,185,129,0.35)' : 'rgba(249,115,22,0.25)' }}>

      {/* ── Toggle header ─────────────────────────────────────────────── */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
        style={{ background: status.configured ? 'rgba(16,185,129,0.06)' : 'rgba(249,115,22,0.06)' }}>

        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: status.configured ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)' }}>
          {status.configured
            ? <CheckCircle size={16} className="text-emerald-400" />
            : <Key size={16} className="text-orange-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold"
            style={{ color: status.configured ? '#34d399' : '#fb923c' }}>
            {status.configured ? 'AWS Live Pricing Active' : 'Configure AWS Live Pricing'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {status.configured
              ? `Real-time prices · Key: ${status.masked_key}`
              : 'Add credentials for region-specific live prices'}
          </p>
        </div>

        {status.configured && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Zap size={8} /> LIVE
          </span>
        )}
        {backendOnline === false && (
          <span className="text-[9px] text-amber-400 flex-shrink-0">backend offline</span>
        )}
        {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
               : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </button>

      {/* ── Collapsible body ──────────────────────────────────────────── */}
      {open && (
        <div className="px-4 py-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>

          {/* Backend offline warning */}
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

          {/* Security notice */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Shield size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Keys are stored locally only. Only
              <strong className="text-indigo-300"> pricing:GetProducts</strong> and
              <strong className="text-indigo-300"> sts:GetCallerIdentity</strong> permissions needed.
              Secret key is never returned via any API.
            </p>
          </div>

          {/* Access Key ID */}
          <div>
            <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              AWS Access Key ID
            </label>
            <input type="text" value={accessKey}
              onChange={e => { setAccessKey(e.target.value); resetTest(); }}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="w-full text-xs px-3 py-2.5 rounded-xl font-mono outline-none"
              style={inputStyle} />
            {accessKey && !accessKey.trim().startsWith('AKIA') && accessKey.trim().length > 3 && (
              <p className="text-[10px] text-amber-400 mt-1">
                ⚠ AWS access keys usually start with "AKIA"
              </p>
            )}
          </div>

          {/* Secret Access Key */}
          <div>
            <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              AWS Secret Access Key
            </label>
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={secretKey}
                onChange={e => { setSecretKey(e.target.value); resetTest(); }}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                className="w-full text-xs px-3 py-2.5 pr-10 rounded-xl font-mono outline-none"
                style={inputStyle} />
              <button onClick={() => setShowSecret(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2">
                {showSecret
                  ? <EyeOff size={14} style={{ color: 'var(--text-muted)' }} />
                  : <Eye size={14} style={{ color: 'var(--text-muted)' }} />}
              </button>
            </div>
          </div>

          {/* Test result message */}
          {testMessage && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{
                background: testStatus === 'success'
                  ? 'rgba(16,185,129,0.08)'
                  : testStatus === 'network_error'
                  ? 'rgba(245,158,11,0.08)'
                  : 'rgba(239,68,68,0.08)',
                border: `1px solid ${testStatus === 'success' ? 'rgba(16,185,129,0.25)' : testStatus === 'network_error' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: testStatus === 'success' ? '#34d399' : testStatus === 'network_error' ? '#fbbf24' : '#f87171',
              }}>
              {testStatus === 'success'    && <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />}
              {testStatus === 'error'      && <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
              {testStatus === 'network_error' && <Wifi size={13} className="flex-shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{testMessage}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {/* Test button */}
            <button onClick={handleTest}
              disabled={!accessKey.trim() || !secretKey.trim() || testStatus === 'testing' || !backendOnline}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {testStatus === 'testing'
                ? <><Loader size={13} className="animate-spin" /> Testing…</>
                : testStatus === 'success'
                ? <><CheckCircle size={13} className="text-emerald-400" /> Verified</>
                : <><Key size={13} /> Test Connection</>}
            </button>

            {/* Save (only after successful test) */}
            <button onClick={() => handleSave(false)}
              disabled={!canSave || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-40"
              style={{ background: canSave ? 'linear-gradient(135deg,#059669,#34d399)' : 'rgba(255,255,255,0.08)' }}>
              {saving ? <><Loader size={13} className="animate-spin" /> Saving…</> : <><CheckCircle size={13} /> Save Credentials</>}
            </button>
          </div>

          {/* Save without validating — shown when network error */}
          {canForce && (
            <button onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-xl transition-all"
              style={{ color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
              <AlertTriangle size={12} />
              Save without validating (network unreachable)
            </button>
          )}

          {/* Remove existing */}
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

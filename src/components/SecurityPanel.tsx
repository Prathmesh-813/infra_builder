import { useState } from 'react';
import { Shield, AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { runSecurityAudit, AuditFinding, Severity } from '../utils/securityAudit';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: { label: 'Critical', color: 'text-red-400',    bg: 'bg-red-950/50',    border: 'border-red-700',    icon: <XCircle size={13} className="text-red-400 flex-shrink-0" /> },
  high:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-950/50', border: 'border-orange-700', icon: <AlertCircle size={13} className="text-orange-400 flex-shrink-0" /> },
  medium:   { label: 'Medium',   color: 'text-yellow-400', bg: 'bg-yellow-950/50', border: 'border-yellow-700', icon: <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0" /> },
  low:      { label: 'Low',      color: 'text-blue-400',   bg: 'bg-blue-950/50',   border: 'border-blue-700',   icon: <Info size={13} className="text-blue-400 flex-shrink-0" /> },
  info:     { label: 'Info',     color: 'text-gray-400',   bg: 'bg-gray-800/50',   border: 'border-gray-600',   icon: <Info size={13} className="text-gray-400 flex-shrink-0" /> },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white leading-none">{score}</span>
        <span className="text-[9px] text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

function FindingCard({ f }: { f: AuditFinding }) {
  const [open, setOpen] = useState(false);
  const cfg = SEVERITY_CONFIG[f.severity];

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:brightness-110 transition-all"
      >
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[9px] text-gray-500">·</span>
            <span className="text-[9px] text-gray-400">{f.icon} {f.resourceName}</span>
            {f.cis && <span className="text-[8px] bg-gray-700 text-gray-400 px-1 py-0.5 rounded">{f.cis}</span>}
          </div>
          <p className="text-xs font-medium text-gray-200 mt-0.5 leading-tight">{f.title}</p>
        </div>
        {open ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0 mt-0.5" /> : <ChevronDown size={12} className="text-gray-500 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5">
          <p className="text-[11px] text-gray-400 leading-relaxed mt-2">{f.description}</p>
          <div className="bg-black/30 rounded p-2">
            <p className="text-[9px] font-bold text-green-400 uppercase mb-1">Recommendation</p>
            <p className="text-[11px] text-gray-300 leading-relaxed">{f.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecurityPanel() {
  const { nodes } = useStore();
  const [filter, setFilter] = useState<Severity | 'all'>('all');

  if (nodes.length === 0) return null;

  const result = runSecurityAudit(nodes);
  const scoreColor = result.score >= 80 ? 'text-green-400' : result.score >= 60 ? 'text-yellow-400' : 'text-red-400';

  const filtered = filter === 'all'
    ? result.findings
    : result.findings.filter(f => f.severity === filter);

  const severities: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low', 'info'];
  const counts: Record<string, number> = {
    all: result.findings.length,
    critical: result.critical,
    high: result.high,
    medium: result.medium,
    low: result.low,
    info: result.findings.filter(f => f.severity === 'info').length,
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gradient-to-r from-red-950/50 to-gray-900">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-red-400" />
          <span className="text-sm font-bold text-white">Security Audit</span>
          {result.findings.length === 0 && (
            <span className="text-[9px] bg-green-700/70 text-green-200 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1">
              <CheckCircle2 size={9} /> All clear
            </span>
          )}
        </div>

        {/* Score + stats */}
        <div className="flex items-center gap-3">
          <ScoreRing score={result.score} />
          <div className="flex-1 space-y-1">
            <div className={`text-sm font-bold ${scoreColor}`}>
              {result.score >= 80 ? 'Good' : result.score >= 60 ? 'Needs Work' : result.score >= 40 ? 'Poor' : 'Critical'}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {result.critical > 0 && <span className="text-[10px] text-red-400">🔴 {result.critical} critical</span>}
              {result.high > 0 && <span className="text-[10px] text-orange-400">🟠 {result.high} high</span>}
              {result.medium > 0 && <span className="text-[10px] text-yellow-400">🟡 {result.medium} medium</span>}
              {result.low > 0 && <span className="text-[10px] text-blue-400">🔵 {result.low} low</span>}
              <span className="text-[10px] text-green-400">✅ {result.passed} passed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      {result.findings.length > 0 && (
        <div className="flex gap-1 p-2 border-b border-gray-700 flex-wrap">
          {severities.map(s => {
            const count = counts[s];
            if (s !== 'all' && count === 0) return null;
            const cfg = s === 'all' ? null : SEVERITY_CONFIG[s as Severity];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-[9px] px-2 py-1 rounded transition-colors capitalize ${
                  filter === s
                    ? (cfg ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'bg-gray-700 text-white')
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 && result.findings.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-green-400 font-semibold">No issues found!</p>
            <p className="text-xs text-gray-500 mt-1">Your infrastructure looks secure.</p>
          </div>
        )}
        {filtered.length === 0 && result.findings.length > 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No {filter} findings</p>
        )}
        {filtered.map((f, i) => (
          <FindingCard key={`${f.id}-${i}`} f={f} />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-700">
        <p className="text-[9px] text-gray-600 text-center">
          Based on AWS security best practices & CIS benchmarks
        </p>
      </div>
    </div>
  );
}

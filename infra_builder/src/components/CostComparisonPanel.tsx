import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  X, BarChart3, Trophy, Zap, Trash2, Download,
  ChevronDown, ChevronUp, Settings2, RefreshCw, Info, TrendingDown, Loader, FileText, FileSpreadsheet,
} from 'lucide-react';
import {
  COMPARISON_SERVICES, ComparisonProvider, ProviderPricing, InstanceOption, PROVIDER_META,
} from '../data/costComparisonData';
import { computeComparison, getDefaultConfigs, ComparisonResult } from '../utils/costComparisonEngine';
import AWSCredentialsPanel from './AWSCredentialsPanel';
import GCPCredentialsPanel from './GCPCredentialsPanel';
import LivePriceBadge from './LivePriceBadge';
import { applyLivePrices, clearLivePriceCache, ProviderLivePrices, resolveAllLivePrices } from '../utils/livePricingEngine';
import { useCompareCardLivePrices } from '../hooks/useCompareCardLivePrice';
import AzurePricingPanel from './AzurePricingPanel';
import ProviderIcon from './ProviderIcon';
import { buildExportData, exportToPDF, exportToExcel, type ExportServiceConfig } from '../utils/costReportExport';

interface AddedService {
  uid: string;
  serviceId: string;
  configs: Record<ComparisonProvider, Record<string, string | number | boolean>>;
}

// ─── Instance Selector ────────────────────────────────────────────────────────
function InstanceSelector({ instances, value, onChange, color }: {
  instances: InstanceOption[]; value: string; onChange: (v: string) => void; color: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sel = instances.find(i => i.value === value) ?? instances[0];
  const cats = Array.from(new Set(instances.map(i => i.category ?? 'Other')));
  const rows = search
    ? instances.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
    : instances;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all hover:border-white/20"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color }}>{sel?.label ?? value}</p>
          {sel && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sel.vcpu} vCPU · {sel.memory} GB RAM · <span className="font-semibold" style={{ color }}>${sel.price.toFixed(0)}/mo</span></p>}
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
          <div className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', maxHeight: 280 }}>
            <div className="p-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <input autoFocus type="text" placeholder="Filter instance types…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
              {(search ? [{ name: '', items: rows }] : cats.map(c => ({ name: c, items: instances.filter(i => (i.category ?? 'Other') === c) }))).map(group => (
                <div key={group.name}>
                  {group.name && (
                    <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest sticky top-0"
                      style={{ color: 'var(--text-faint)', background: 'var(--bg-surface-2)' }}>{group.name}</div>
                  )}
                  {group.items.map(inst => (
                    <button key={inst.value}
                      onClick={() => { onChange(inst.value); setOpen(false); setSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                      style={inst.value === value ? { background: 'rgba(255,255,255,0.06)' } : {}}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: inst.value === value ? color : 'var(--text-primary)' }}>{inst.label}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{inst.vcpu} vCPU · {inst.memory} GB RAM</p>
                      </div>
                      <p className="text-xs font-bold flex-shrink-0" style={{ color: inst.value === value ? color : 'var(--text-secondary)' }}>${inst.price.toFixed(0)}/mo</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Field Input ──────────────────────────────────────────────────────────────
function FieldInput({ field, value, onChange, color }: {
  field: ProviderPricing['fields'][number];
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  color: string;
}) {
  const inputCls = 'w-full text-xs rounded-xl px-3 py-2 border transition-all outline-none focus:ring-2 focus:ring-offset-0';
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' };

  if (field.instanceOptions?.length)
    return <InstanceSelector instances={field.instanceOptions} value={String(value ?? field.default ?? '')} onChange={onChange} color={color} />;

  if (field.type === 'select')
    return (
      <select className={`${inputCls} cursor-pointer`} style={inputStyle}
        value={String(value ?? field.default ?? '')} onChange={e => onChange(e.target.value)}>
        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );

  if (field.type === 'boolean') {
    const on = Boolean(value ?? field.default ?? false);
    return (
      <button onClick={() => onChange(!on)} className="flex items-center gap-3 py-1">
        <div className="w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0"
          style={{ background: on ? `linear-gradient(135deg,${color},${color}aa)` : 'rgba(255,255,255,0.1)' }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow"
            style={{ left: on ? 'calc(100% - 18px)' : '2px' }} />
        </div>
        <span className="text-xs font-medium" style={{ color: on ? color : 'var(--text-muted)' }}>{on ? 'Enabled' : 'Disabled'}</span>
      </button>
    );
  }

  if (field.type === 'number')
    return <input type="number" className={inputCls} style={inputStyle}
      value={Number(value ?? field.default ?? 0)} onChange={e => onChange(Number(e.target.value))} />;

  return <input type="text" className={inputCls} style={inputStyle}
    value={String(value ?? field.default ?? '')} onChange={e => onChange(e.target.value)} />;
}

// ─── Config Modal ─────────────────────────────────────────────────────────────
function ConfigModal({ serviceId, configs, onSave, onCancel }: {
  serviceId: string;
  configs: Record<ComparisonProvider, Record<string, string | number | boolean>>;
  onSave: (c: Record<ComparisonProvider, Record<string, string | number | boolean>>) => void;
  onCancel: () => void;
}) {
  const service = COMPARISON_SERVICES.find(s => s.id === serviceId)!;
  const [local, setLocal] = useState<Record<ComparisonProvider, Record<string, string | number | boolean>>>(
    JSON.parse(JSON.stringify(configs))
  );

  const update = (p: ComparisonProvider, k: string, v: string | number | boolean) =>
    setLocal(prev => ({ ...prev, [p]: { ...prev[p], [k]: v } }));

  const preview = service.providers
    .map(p => { const e = p.estimate(local[p.provider] || {}); return { ...p, avg: (e.min + e.max) / 2, basis: e.basis }; })
    .sort((a, b) => a.avg - b.avg);
  const minCost = preview[0]?.avg ?? 0;
  const maxCost = preview[preview.length - 1]?.avg ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={onCancel}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(139,92,246,0.4)',
          boxShadow: '0 0 80px rgba(139,92,246,0.15), 0 25px 50px rgba(0,0,0,0.5)',
          maxHeight: '88vh',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            {service.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{service.serviceName}</h2>
            <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
              {service.category} · Configure per-provider settings, then compare costs
            </p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10">
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Live preview bar */}
        <div className="px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Live Cost Preview</p>
          <div className="grid grid-cols-4 gap-3">
            {preview.map((p, i) => {
              const meta = PROVIDER_META[p.provider as ComparisonProvider];
              const isBest = i === 0;
              const savings = maxCost > 0 && isBest ? Math.round((1 - p.avg / maxCost) * 100) : 0;
              return (
                <div key={p.provider} className="rounded-xl p-3 text-center transition-all"
                  style={{
                    background: isBest ? 'rgba(16,185,129,0.1)' : meta.bg,
                    border: `1px solid ${isBest ? 'rgba(16,185,129,0.4)' : meta.border}`,
                    boxShadow: isBest ? '0 0 20px rgba(16,185,129,0.1)' : 'none',
                  }}>
                  <p className="text-lg mb-0.5 flex items-center justify-center"><ProviderIcon provider={meta.icon as any} size={24} /></p>
                  <p className="text-lg font-bold leading-none" style={{ color: isBest ? '#34d399' : meta.color }}>
                    ${p.avg.toFixed(0)}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-faint)' }}>/month</p>
                  {isBest && savings > 0 && (
                    <p className="text-[9px] font-bold mt-1 text-emerald-400">BEST — {savings}% cheaper</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider config panels */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-2 gap-5">
            {service.providers.map(p => {
              const meta = PROVIDER_META[p.provider as ComparisonProvider];
              const est = p.estimate(local[p.provider] || {});
              const avg = (est.min + est.max) / 2;
              const isBest = Math.abs(avg - minCost) < 0.5;
              return (
                <div key={p.provider} className="rounded-2xl overflow-hidden"
                  style={{
                    border: `1px solid ${isBest ? 'rgba(16,185,129,0.4)' : meta.border}`,
                    background: isBest ? 'rgba(16,185,129,0.05)' : meta.bg,
                  }}>
                  {/* Provider card header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: isBest ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <ProviderIcon provider={meta.icon as any} size={28} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold" style={{ color: isBest ? '#34d399' : meta.color }}>{meta.label}</p>
                          {isBest && <Trophy size={12} className="text-emerald-400" />}
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.serviceLabel}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold" style={{ color: isBest ? '#34d399' : meta.color }}>
                        ${avg.toFixed(0)}<span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
                      </p>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="p-4 space-y-3">
                    {p.fields.map(field => (
                      <div key={field.key}>
                        <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
                        <FieldInput field={field} value={local[p.provider]?.[field.key] ?? field.default ?? ''} onChange={v => update(p.provider as ComparisonProvider, field.key, v)} color={meta.color} />
                      </div>
                    ))}

                    {/* Cost basis */}
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg mt-1"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }} />
                      <p className="text-[9px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{est.basis}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {minCost > 0 && maxCost > minCost && (
            <p className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
              <TrendingDown size={12} className="inline text-emerald-400 mr-1" />
              Best option saves <span className="font-bold text-emerald-400">${(maxCost - minCost).toFixed(0)}/mo</span> vs most expensive
            </p>
          )}
          <button onClick={onCancel} className="px-5 py-2.5 text-sm rounded-xl transition-all"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={() => onSave(local)} className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 16px rgba(109,40,217,0.4)' }}>
            Add to Comparison →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Horizontal cost bar ──────────────────────────────────────────────────────
function CostBar({ label, icon, color, amount, max, isWinner }: {
  label: string; icon: string; color: string; amount: number; max: number; isWinner: boolean;
}) {
  const pct = max > 0 ? Math.max(4, (amount / max) * 100) : 4;
  return (
    <div className="flex items-center gap-3 py-1">
      {/* Label */}
      <div className="w-24 flex items-center gap-2 flex-shrink-0">
        <ProviderIcon provider={icon as any} size={18} />
        <span className="text-xs font-semibold truncate" style={{ color: isWinner ? '#34d399' : 'var(--text-secondary)' }}>{label}</span>
        {isWinner && <Trophy size={10} className="text-emerald-400 flex-shrink-0" />}
      </div>
      {/* Bar */}
      <div className="flex-1 h-7 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-xl flex items-center px-3 transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isWinner
              ? 'linear-gradient(90deg,#059669,#34d399)'
              : `linear-gradient(90deg,${color}80,${color}40)`,
          }}>
          {pct > 20 && (
            <span className="text-[10px] font-bold text-white drop-shadow">${amount.toFixed(0)}</span>
          )}
        </div>
      </div>
      {/* Amount */}
      <div className="w-20 text-right flex-shrink-0">
        <span className="text-sm font-bold" style={{ color: isWinner ? '#34d399' : 'var(--text-primary)' }}>
          ${amount.toFixed(0)}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>/mo</span>
      </div>
    </div>
  );
}

// ─── Compare Card ─────────────────────────────────────────────────────────────
function CompareCard({ added, onRemove, onReconfigure, awsLiveEnabled, azureLiveEnabled, gcpLiveEnabled, awsRegion, azureRegion, gcpRegion }: {
  added: AddedService;
  onRemove: () => void;
  onReconfigure: () => void;
  awsLiveEnabled: boolean;
  azureLiveEnabled: boolean;
  gcpLiveEnabled: boolean;
  awsRegion?: string;
  azureRegion?: string;
  gcpRegion?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const staticResult = useMemo(
    () => computeComparison({ serviceId: added.serviceId, providerConfigs: added.configs }),
    [added.serviceId, added.configs],
  );
  const { prices: livePrices, loading: liveLoading, awsEnabled, azureEnabled, gcpEnabled } = useCompareCardLivePrices(
    added.serviceId,
    added.configs,
    { awsEnabled: awsLiveEnabled, azureEnabled: azureLiveEnabled, gcpEnabled: gcpLiveEnabled, awsRegion, azureRegion, gcpRegion },
  );
  const result: ComparisonResult = useMemo(
    () => applyLivePrices(staticResult, livePrices),
    [staticResult, livePrices],
  );
  const anyLive = awsEnabled || azureEnabled || gcpEnabled;
  if (result.providers.length === 0) return null;

  const avgs = result.providers.map(p => ({ ...p, avg: (p.monthlyMin + p.monthlyMax) / 2 }))
    .sort((a, b) => a.avg - b.avg);
  const minAvg = avgs[0].avg;
  const maxAvg = avgs[avgs.length - 1].avg;
  const savings = maxAvg > 0 ? Math.round((1 - minAvg / maxAvg) * 100) : 0;

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>

      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {result.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{result.serviceName}</p>
            {anyLive && liveLoading && <Loader size={12} className="animate-spin text-emerald-400 flex-shrink-0" />}
            {awsEnabled && livePrices.aws && !liveLoading && (
              <LivePriceBadge source={livePrices.aws.source} compact />
            )}
            {azureEnabled && livePrices.azure && !liveLoading && (
              <LivePriceBadge source={livePrices.azure.source} compact />
            )}
            {gcpEnabled && livePrices.gcp && !liveLoading && (
              <LivePriceBadge source={livePrices.gcp.source} compact />
            )}
          </div>
          <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>{result.category}</p>
        </div>

        {/* Savings badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {savings > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
              <TrendingDown size={11} /> Save {savings}%
            </span>
          )}
          <button onClick={e => { e.stopPropagation(); onReconfigure(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            title="Edit configuration">
            <Settings2 size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/15"
            title="Remove">
            <Trash2 size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
          <div className="w-8 h-8 flex items-center justify-center">
            {expanded
              ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-4 space-y-4">

          {/* Bar chart */}
          <div className="space-y-1">
            {avgs.map(p => {
              const meta = PROVIDER_META[p.provider as ComparisonProvider];
              return (
                <CostBar key={p.provider} label={meta.label} icon={meta.icon}
                  color={meta.color} amount={p.avg} max={maxAvg} isWinner={p.avg === minAvg} />
              );
            })}
          </div>

          {/* Detail table */}
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>
              <div className="col-span-1" />
              <div className="col-span-3">Provider</div>
              <div className="col-span-5">Configuration</div>
              <div className="col-span-3 text-right">Monthly Cost</div>
            </div>
            {/* Table rows */}
            {avgs.map((p, i) => {
              const meta = PROVIDER_META[p.provider as ComparisonProvider];
              const isWinner = p.avg === minAvg;
              return (
                <div key={p.provider}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
                  style={{
                    background: isWinner ? 'rgba(16,185,129,0.05)' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    borderBottom: i < avgs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                  {/* Rank */}
                  <div className="col-span-1">
                    <span className="text-xs font-bold" style={{ color: isWinner ? '#34d399' : 'var(--text-faint)' }}>#{i + 1}</span>
                  </div>
                  {/* Provider */}
                  <div className="col-span-3 flex items-center gap-2">
                    <ProviderIcon provider={meta.icon as any} size={20} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold leading-tight" style={{ color: isWinner ? '#34d399' : meta.color }}>{p.serviceLabel}</p>
                        {p.provider === 'aws' && awsEnabled && livePrices.aws && (
                          <LivePriceBadge source={livePrices.aws.source} loading={liveLoading} />
                        )}
                        {p.provider === 'azure' && azureEnabled && livePrices.azure && (
                          <LivePriceBadge source={livePrices.azure.source} loading={liveLoading} />
                        )}
                        {p.provider === 'gcp' && gcpEnabled && livePrices.gcp && (
                          <LivePriceBadge source={livePrices.gcp.source} loading={liveLoading} />
                        )}
                      </div>
                      {isWinner && <p className="text-[9px] text-emerald-400 font-bold">Best value</p>}
                    </div>
                  </div>
                  {/* Config basis */}
                  <div className="col-span-5">
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p.basis}</p>
                  </div>
                  {/* Cost */}
                  <div className="col-span-3 text-right">
                    <p className="text-sm font-bold" style={{ color: isWinner ? '#34d399' : 'var(--text-primary)' }}>
                      ${p.monthlyMin === p.monthlyMax
                        ? p.monthlyMin.toFixed(0)
                        : `${p.monthlyMin.toFixed(0)}–${p.monthlyMax.toFixed(0)}`}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>/month</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Configuration summary */}
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>
              <Settings2 size={11} /> Per-Provider Configuration
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {avgs.map((p, i) => {
                const meta = PROVIDER_META[p.provider as ComparisonProvider];
                const cfg = added.configs[p.provider as ComparisonProvider] ?? {};
                const cfgKeys = Object.keys(cfg);
                return (
                  <div key={p.provider} className="px-4 py-2.5 flex items-start gap-3"
                    style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <ProviderIcon provider={meta.icon as any} size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: meta.color }}>{p.serviceLabel}</p>
                      {cfgKeys.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {cfgKeys.map(k => (
                            <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-md"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                              {k}: <span className="font-semibold" style={{ color: meta.color }}>{String(cfg[k])}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-faint)' }}>Default configuration</p>
                      )}
                    </div>
                    <p className="text-xs font-bold flex-shrink-0" style={{ color: p.avg === minAvg ? '#34d399' : 'var(--text-primary)' }}>
                      ${p.avg.toFixed(0)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Savings callout */}
          {savings > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Zap size={14} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-300">
                Switch from <span className="font-bold">{PROVIDER_META[avgs[avgs.length - 1].provider as ComparisonProvider].label}</span> to{' '}
                <span className="font-bold">{PROVIDER_META[avgs[0].provider as ComparisonProvider].label}</span> and save{' '}
                <span className="font-bold">${(maxAvg - minAvg).toFixed(0)}/month</span> ({savings}%)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function CostComparisonPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [addedServices, setAddedServices] = useState<AddedService[]>([]);
  const [pendingDrop, setPendingDrop] = useState<{ serviceId: string } | null>(null);
  const [reconfiguringUid, setReconfiguringUid] = useState<string | null>(null);
  const [awsLiveEnabled, setAwsLiveEnabled] = useState(false);
  const [azureLiveEnabled, setAzureLiveEnabled] = useState(false);
  const [gcpLiveEnabled, setGcpLiveEnabled] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [projectionYears, setProjectionYears] = useState<1 | 3 | 5>(1);

  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [azureRegion, setAzureRegion] = useState('eastus');
  const [gcpRegion, setGcpRegion] = useState('us-central1');

  const handleAzureAvailabilityChange = useCallback((available: boolean) => {
    setAzureLiveEnabled(available);
    if (available) clearLivePriceCache();
  }, []);

  const handleAwsCredentialsChange = useCallback((configured: boolean) => {
    setAwsLiveEnabled(configured);
    if (configured) clearLivePriceCache();
  }, []);

  const handleGcpCredentialsChange = useCallback((configured: boolean) => {
    setGcpLiveEnabled(configured);
    if (configured) clearLivePriceCache();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const serviceId =
      e.dataTransfer.getData('application/compareServiceId') ||
      e.dataTransfer.getData('application/resourceType');
    if (!serviceId) return;
    if (!COMPARISON_SERVICES.find(s => s.id === serviceId)) return;
    setPendingDrop({ serviceId });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const confirmAdd = useCallback((serviceId: string, configs: Record<ComparisonProvider, Record<string, string | number | boolean>>) => {
    setAddedServices(prev => [...prev, { uid: `svc_${Date.now()}`, serviceId, configs }]);
    setPendingDrop(null);
  }, []);

  const confirmReconfigure = useCallback((uid: string, configs: Record<ComparisonProvider, Record<string, string | number | boolean>>) => {
    setAddedServices(prev => prev.map(s => s.uid === uid ? { ...s, configs } : s));
    setReconfiguringUid(null);
  }, []);

  const removeService = useCallback((uid: string) => {
    setAddedServices(prev => prev.filter(s => s.uid !== uid));
  }, []);

  // Live price overrides for summary totals (fetched once for all services)
  const [liveOverrides, setLiveOverrides] = useState<Record<string, ProviderLivePrices>>({});

  useEffect(() => {
    if ((!awsLiveEnabled && !azureLiveEnabled && !gcpLiveEnabled) || addedServices.length === 0) {
      setLiveOverrides({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        addedServices.map(async s => {
          const prices = await resolveAllLivePrices(s.serviceId, s.configs, {
            aws: awsLiveEnabled,
            azure: azureLiveEnabled,
            gcp: gcpLiveEnabled,
            awsRegion,
            azureRegion,
            gcpRegion,
          });
          return [s.uid, prices] as const;
        }),
      );
      if (!cancelled) setLiveOverrides(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [awsLiveEnabled, azureLiveEnabled, gcpLiveEnabled, awsRegion, azureRegion, gcpRegion, addedServices]);

  const results = addedServices.map(s => {
    const base = computeComparison({ serviceId: s.serviceId, providerConfigs: s.configs });
    return applyLivePrices(base, liveOverrides[s.uid] ?? {});
  });
  const providerTotals = (Object.keys(PROVIDER_META) as ComparisonProvider[]).map(id => {
    const total = results.reduce((sum, r) => {
      const p = r.providers.find(pr => pr.provider === id);
      return sum + (p ? (p.monthlyMin + p.monthlyMax) / 2 : 0);
    }, 0);
    return { id, total, ...PROVIDER_META[id] };
  }).sort((a, b) => a.total - b.total);

  const cheapest = providerTotals[0];
  const mostExpensive = providerTotals[providerTotals.length - 1];
  const grandTotalMonthly = providerTotals.reduce((s, t) => s + t.total, 0);

  const configDetails: ExportServiceConfig[] = addedServices.map((svc, i) => {
    const r = results[i];
    return {
      serviceId: svc.serviceId,
      serviceName: r?.serviceName ?? svc.serviceId,
      category: r?.category ?? '',
      configs: (Object.keys(PROVIDER_META) as ComparisonProvider[]).map(pid => ({
        provider: pid,
        providerLabel: PROVIDER_META[pid].label,
        fields: svc.configs[pid] ?? {},
      })),
    };
  });

  const handleExportPDF = useCallback(async () => {
    if (!containerRef.current) return;
    setExporting('pdf');
    try {
      await exportToPDF(containerRef.current, `cost-comparison-${Date.now()}`);
    } catch (e) {
      console.error('PDF export failed:', e);
    }
    setExporting(null);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (results.length === 0) return;
    setExporting('excel');
    try {
      const data = buildExportData(results, providerTotals, configDetails);
      exportToExcel(data, `cost-comparison-${Date.now()}`);
    } catch (e) {
      console.error('Excel export failed:', e);
    }
    setExporting(null);
  }, [results, providerTotals, configDetails]);

  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div ref={containerRef} style={{ background: 'var(--bg-app)' }}>

      {/* ── Live Pricing credentials ────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 space-y-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <AzurePricingPanel onAvailabilityChange={handleAzureAvailabilityChange} />
        <AWSCredentialsPanel onCredentialsChange={handleAwsCredentialsChange} />
        <GCPCredentialsPanel onCredentialsChange={handleGcpCredentialsChange} />

        {/* Per-provider region selectors */}
        <div className="flex items-center gap-3 pt-1 pb-0.5 px-0.5">
          <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--text-faint)' }}>Regions</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <ProviderIcon provider="aws" size={14} />
              <select value={awsRegion} onChange={e => setAwsRegion(e.target.value)}
                className="text-[10px] px-2 py-1 rounded-md border transition-all cursor-pointer"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
                {['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-west-2','eu-central-1','ap-south-1','ap-southeast-1','ap-northeast-1','ca-central-1','sa-east-1'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <ProviderIcon provider="azure" size={14} />
              <select value={azureRegion} onChange={e => setAzureRegion(e.target.value)}
                className="text-[10px] px-2 py-1 rounded-md border transition-all cursor-pointer"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
                {['eastus','eastus2','westus','westus2','westeurope','northeurope','uksouth','southeastasia','centralindia','japaneast','canadacentral','brazilsouth'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <ProviderIcon provider="gcp" size={14} />
              <select value={gcpRegion} onChange={e => setGcpRegion(e.target.value)}
                className="text-[10px] px-2 py-1 rounded-md border transition-all cursor-pointer"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
                {['us-central1','us-east1','us-west1','us-west2','europe-west1','europe-west2','europe-west3','asia-east1','asia-southeast1','asia-northeast1','australia-southeast1'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top summary bar ──────────────────────────────────────────────────── */}
      {addedServices.length > 0 && (
        <div className="px-5 py-4 border-b"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-purple-400" />
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Total Cost — {addedServices.length} service{addedServices.length !== 1 ? 's' : ''}
              </span>
              {/* Projection toggle */}
              <div className="flex items-center gap-0.5 ml-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                {([1, 3, 5] as const).map(y => (
                  <button key={y} onClick={() => setProjectionYears(y)}
                    className="text-[10px] font-semibold px-2.5 py-1 transition-all"
                    style={{
                      background: projectionYears === y ? 'var(--accent)' : 'transparent',
                      color: projectionYears === y ? '#fff' : 'var(--text-muted)',
                    }}>
                    {y}Y
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Export dropdown */}
              <div className="relative">
                <button onClick={() => setShowExportMenu(m => !m)}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-50"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  <Download size={11} />
                  {exporting === 'pdf' ? 'Exporting PDF...' : exporting === 'excel' ? 'Exporting Excel...' : 'Export'}
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl overflow-hidden shadow-2xl"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
                      <button onClick={() => { setShowExportMenu(false); handleExportPDF(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/5 text-left"
                        style={{ color: 'var(--text-primary)' }}>
                        <FileText size={14} className="text-red-400" />
                        Export as PDF
                      </button>
                      <button onClick={() => { setShowExportMenu(false); handleExportExcel(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/5 text-left"
                        style={{ color: 'var(--text-primary)' }}>
                        <FileSpreadsheet size={14} className="text-emerald-400" />
                        Export as Excel (.xlsx)
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setAddedServices([])}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                <RefreshCw size={11} /> Clear all
              </button>
            </div>
          </div>

          {/* Provider cost tiles */}
          <div className="grid grid-cols-4 gap-3">
            {providerTotals.map((t, i) => {
              const isBest = i === 0;
              const savings = mostExpensive.total > 0 && isBest
                ? Math.round((1 - t.total / mostExpensive.total) * 100) : 0;
              const projected = t.total * projectionYears * 12;
              return (
                <div key={t.id} className="rounded-xl p-3 transition-all"
                  style={{
                    background: isBest ? 'rgba(16,185,129,0.08)' : t.bg,
                    border: `1px solid ${isBest ? 'rgba(16,185,129,0.35)' : t.border}`,
                    boxShadow: isBest ? '0 0 20px rgba(16,185,129,0.08)' : 'none',
                  }}>
                  <div className="flex items-center gap-2 mb-2">
                    <ProviderIcon provider={t.icon as any} size={22} />
                    <span className="text-xs font-semibold" style={{ color: isBest ? '#34d399' : t.color }}>{t.label}</span>
                    {isBest && <Trophy size={11} className="text-emerald-400 ml-auto" />}
                  </div>
                  <p className="text-xl font-bold leading-none" style={{ color: isBest ? '#34d399' : t.color }}>
                    ${t.total.toFixed(0)}
                    <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-faint)' }}>/mo</span>
                  </p>
                  <p className="text-sm font-bold mt-1.5" style={{ color: isBest ? '#34d399' : t.color }}>
                    ${projected.toFixed(0)}
                    <span className="text-[10px] font-medium ml-0.5" style={{ color: 'var(--text-muted)' }}>/{projectionYears}yr</span>
                  </p>
                  {isBest && savings > 0 && (
                    <p className="text-[9px] font-bold text-emerald-400 mt-1">Saves {savings}% vs most expensive</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Winner callout */}
          {cheapest.total > 0 && mostExpensive.total > cheapest.total && (
            <div className="flex items-center gap-3 mt-3 px-4 py-2.5 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Trophy size={14} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-300">
                <span className="font-bold inline-flex items-center gap-1.5"><ProviderIcon provider={cheapest.icon as any} size={16} /> {cheapest.label}</span> is the most cost-effective at{' '}
                <span className="font-bold">${cheapest.total.toFixed(0)}/mo</span> — saves{' '}
                <span className="font-bold">${(mostExpensive.total - cheapest.total).toFixed(0)}/mo</span> vs {mostExpensive.label}
              </p>
            </div>
          )}

          {/* Insight cards */}
          {addedServices.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <p className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1" style={{ color: '#a78bfa' }}>
                  <BarChart3 size={11} /> Services Compared
                </p>
                <p className="text-lg font-bold" style={{ color: '#a78bfa' }}>{addedServices.length}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>across {providerTotals.filter(t => t.total > 0).length} providers</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <p className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1" style={{ color: '#34d399' }}>
                  <TrendingDown size={11} /> Potential Savings
                </p>
                <p className="text-lg font-bold" style={{ color: '#34d399' }}>
                  ${(mostExpensive.total - cheapest.total).toFixed(0)}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>/month by switching to {cheapest.label}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <p className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1" style={{ color: '#fbbf24' }}>
                  <Zap size={11} /> Annual Spend
                </p>
                <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                  ${(grandTotalMonthly * 12).toFixed(0)}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>projected · {addedServices.length} services</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Drop / results area ───────────────────────────────────────────────── */}
      <div style={{ padding: addedServices.length > 0 ? '16px' : 0 }}
        onDrop={handleDrop} onDragOver={handleDragOver}>

        {addedServices.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center"
            style={{ minHeight: 'calc(100vh - 200px)' }}>
            <div className="text-center px-8">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
                style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  boxShadow: '0 0 40px rgba(139,92,246,0.08)',
                }}>
                📊
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Drop a service to compare costs
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Select a cloud provider in the left panel, then drag any service into this area.
                A configuration dialog lets you choose the exact instance type before comparing.
              </p>
              <div className="flex items-center justify-center gap-4 mt-6">
                {(Object.values(PROVIDER_META) as typeof PROVIDER_META[ComparisonProvider][]).map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}>
                    <ProviderIcon provider={m.icon as any} size={16} /> {m.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {addedServices.map(s => (
              <CompareCard key={s.uid} added={s}
                awsLiveEnabled={awsLiveEnabled} azureLiveEnabled={azureLiveEnabled} gcpLiveEnabled={gcpLiveEnabled}
                awsRegion={awsRegion} azureRegion={azureRegion} gcpRegion={gcpRegion}
                onRemove={() => removeService(s.uid)}
                onReconfigure={() => setReconfiguringUid(s.uid)} />
            ))}
          </div>
        )}
      </div>

      {/* Config modals */}
      {pendingDrop && (
        <ConfigModal serviceId={pendingDrop.serviceId}
          configs={getDefaultConfigs(pendingDrop.serviceId)}
          onSave={cfg => confirmAdd(pendingDrop.serviceId, cfg)}
          onCancel={() => setPendingDrop(null)} />
      )}
      {reconfiguringUid && (() => {
        const svc = addedServices.find(s => s.uid === reconfiguringUid);
        if (!svc) return null;
        return (
          <ConfigModal serviceId={svc.serviceId} configs={svc.configs}
            onSave={cfg => confirmReconfigure(reconfiguringUid, cfg)}
            onCancel={() => setReconfiguringUid(null)} />
        );
      })()}
    </div>
  );
}

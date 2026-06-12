import { useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp, TrendingUp, Info } from 'lucide-react';
import { useStore } from '../store/useStore';
import { estimateCosts, CostItem } from '../utils/costEstimator';

function CostRow({ item }: { item: CostItem }) {
  const [open, setOpen] = useState(false);
  const isFree = item.monthlyMax === 0;
  const isVariable = item.monthlyMin !== item.monthlyMax;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-200 truncate">{item.label}</div>
          <div className="text-[10px] text-gray-500 truncate">{item.resourceName}</div>
        </div>
        <div className="text-right flex-shrink-0">
          {isFree ? (
            <span className="text-[10px] text-green-400 font-semibold">FREE</span>
          ) : isVariable ? (
            <span className="text-[10px] text-yellow-300 font-semibold">
              ${item.monthlyMin}–${item.monthlyMax}
            </span>
          ) : (
            <span className="text-[10px] text-white font-semibold">${item.monthlyMax}</span>
          )}
        </div>
        {open ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-2 bg-gray-800/30 border-t border-gray-700/50">
          <p className="text-[10px] text-gray-400 mt-1.5 flex items-start gap-1">
            <Info size={10} className="flex-shrink-0 mt-0.5 text-blue-400" />
            {item.basis}
          </p>
        </div>
      )}
    </div>
  );
}

export default function CostPanel() {
  const { nodes } = useStore();
  const summary = estimateCosts(nodes);

  if (nodes.length === 0) return null;

  const freeCount = summary.items.filter(i => i.monthlyMax === 0).length;
  const paidCount = summary.items.length - freeCount;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gradient-to-r from-green-950 to-gray-900">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={16} className="text-green-400" />
          <span className="text-sm font-bold text-white">Cost Estimate</span>
          <span className="text-[9px] bg-yellow-600/70 text-yellow-200 px-1.5 py-0.5 rounded ml-auto">
            Approximate
          </span>
        </div>
        {/* Total */}
        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 mb-1">Estimated Monthly Cost</div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-white">
              ${summary.totalMin === summary.totalMax
                ? summary.totalMin.toFixed(2)
                : `${summary.totalMin.toFixed(0)}–${summary.totalMax.toFixed(0)}`}
            </span>
            <span className="text-xs text-gray-400 mb-0.5">/mo</span>
          </div>
          <div className="flex gap-3 mt-2">
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-green-400" />
              <span className="text-[10px] text-gray-400">{freeCount} free</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign size={10} className="text-yellow-400" />
              <span className="text-[10px] text-gray-400">{paidCount} paid</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-resource breakdown */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <p className="text-[10px] text-gray-500 mb-2">Click a resource to see pricing basis</p>
        {summary.items.map((item, i) => (
          <CostRow key={`${item.resourceName}-${i}`} item={item} />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-700">
        <p className="text-[9px] text-gray-600 text-center leading-relaxed">
          Estimates based on us-east-1 on-demand pricing. Actual costs vary by usage, region, and reserved pricing.
        </p>
      </div>
    </div>
  );
}

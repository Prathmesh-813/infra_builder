import { useState } from 'react';
import { X, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { BLUEPRINTS, generateBlueprintNodes } from '../data/blueprints';
import { useStore } from '../store/useStore';

interface Props {
  onClose: () => void;
  idOffset: number;
  onUsed: (count: number) => void;
}

export default function BlueprintModal({ onClose, idOffset, onUsed }: Props) {
  const { addBlueprint } = useStore();
  const [applied, setApplied] = useState<string | null>(null);

  const handleApply = (blueprintId: string) => {
    const { nodes, edges } = generateBlueprintNodes(
      blueprintId,
      { x: 80, y: 120 },
      idOffset
    );
    addBlueprint(nodes, edges);
    setApplied(blueprintId);
    onUsed(nodes.length);
    setTimeout(onClose, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-blue-950 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Quick Setup Blueprints</h2>
              <p className="text-gray-400 text-xs">
                Auto-create all required resources, pre-wired and ready to configure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Blueprint cards */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {BLUEPRINTS.map((bp) => {
            const isApplied = applied === bp.id;
            return (
              <button
                key={bp.id}
                onClick={() => handleApply(bp.id)}
                disabled={!!applied}
                className={`
                  group text-left rounded-xl border-2 p-4 transition-all
                  ${bp.bgColor} ${bp.borderColor}
                  ${isApplied
                    ? 'opacity-100 scale-[1.02]'
                    : applied
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:brightness-125 hover:scale-[1.02] cursor-pointer'
                  }
                `}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{bp.icon}</span>
                    <div>
                      <div className={`font-bold text-sm ${bp.color}`}>{bp.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {bp.tags.length} resources
                      </div>
                    </div>
                  </div>
                  {isApplied ? (
                    <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="text-gray-500 group-hover:text-white transition-colors flex-shrink-0 mt-1"
                    />
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  {bp.description}
                </p>

                {/* Resource tags */}
                <div className="flex flex-wrap gap-1">
                  {bp.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] bg-black/40 text-gray-300 px-2 py-0.5 rounded-full border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {isApplied && (
                  <div className="mt-3 text-xs text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Added to canvas!
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-950/50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            All resources are pre-configured with sensible defaults. Click any resource to customise.
          </p>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

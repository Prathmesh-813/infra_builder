import { useState } from 'react';
import { X, Layout, CheckCircle2, ChevronRight, Tag } from 'lucide-react';
import { useStore } from '../store/useStore';
import { TEMPLATES } from '../data/architectureTemplates';
import type { ArchTemplate } from '../data/architectureTemplates';

interface Props {
  onClose: () => void;
  idOffset: number;
  onUsed: (count: number) => void;
}

export default function TemplatesModal({ onClose, idOffset, onUsed }: Props) {
  const { addBlueprint } = useStore();
  const [applied, setApplied] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories: string[] = ['All', ...Array.from(new Set(TEMPLATES.map((t: ArchTemplate) => t.category)))];
  const filtered: ArchTemplate[] = activeCategory === 'All' ? TEMPLATES : TEMPLATES.filter((t: ArchTemplate) => t.category === activeCategory);

  const handleApply = (template: ArchTemplate) => {
    const { nodes, edges } = template.generate(idOffset);
    addBlueprint(nodes, edges);
    setApplied(template.id);
    onUsed(nodes.length);
    setTimeout(onClose, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-indigo-950 to-gray-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Layout size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Architecture Templates</h2>
              <p className="text-gray-400 text-xs">Production-ready AWS patterns, fully wired</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 px-5 py-3 border-b border-gray-700 flex-wrap flex-shrink-0">
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((template: ArchTemplate) => {
            const isApplied = applied === template.id;
            return (
              <button
                key={template.id}
                onClick={() => handleApply(template)}
                disabled={!!applied}
                className={`text-left rounded-xl border-2 p-4 transition-all ${template.borderColor} ${template.bgColor} ${
                  isApplied ? 'scale-[1.02]' : applied ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125 hover:scale-[1.01] cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{template.icon}</span>
                    <div>
                      <div className={`font-bold text-sm ${template.color}`}>{template.name}</div>
                      <div className="text-[10px] text-gray-400">{template.category} · {template.resourceCount} resources</div>
                    </div>
                  </div>
                  {isApplied
                    ? <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                    : <ChevronRight size={16} className="text-gray-500 flex-shrink-0 mt-1" />
                  }
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">{template.description}</p>
                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tag: string) => (
                    <span key={tag} className="inline-flex items-center gap-0.5 text-[9px] bg-black/40 text-gray-300 px-1.5 py-0.5 rounded-full border border-white/10">
                      <Tag size={7} />
                      {tag}
                    </span>
                  ))}
                </div>
                {isApplied && (
                  <div className="mt-2 text-xs text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> Added to canvas!
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-gray-700 bg-gray-950/50 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500">All resources pre-configured. Click any resource to customise.</p>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

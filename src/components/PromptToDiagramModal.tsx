import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function PromptToDiagramModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.3)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-300">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-white mb-4">AI Prompt to Diagram</h2>
        <p className="text-sm text-gray-400 mb-4">
          Describe your infrastructure in natural language, and we'll generate a diagram for you.
        </p>
        <textarea
          className="w-full h-32 rounded-xl p-3 text-sm text-gray-200"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
          placeholder="e.g. A web application with an EC2 instance, RDS database, and an ALB..."
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600">
            Cancel
          </button>
          <button className="text-xs px-4 py-2 rounded-lg font-semibold text-white" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

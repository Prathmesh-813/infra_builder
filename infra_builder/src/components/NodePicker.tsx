// n8n-style command-palette for adding a resource: search, keyboard-driven,
// click or Enter to add. Used by the canvas "+" FAB and the on-edge "+" button.
import { useEffect, useMemo, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { ResourceDefinition } from '../types/resources';

export default function NodePicker({
  definitions, onPick, onClose, title = 'Add resource',
}: {
  definitions: ResourceDefinition[];
  onPick: (def: ResourceDefinition) => void;
  onClose: () => void;
  title?: string;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s ? definitions : definitions.filter((d) =>
      d.label.toLowerCase().includes(s) ||
      d.type.toLowerCase().includes(s) ||
      (d.category || '').toLowerCase().includes(s));
    return list.slice(0, 60);
  }, [q, definitions]);

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); onPick(filtered[active]); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [filtered, active, onPick, onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4" style={{ background: 'var(--bg-overlay)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 h-12 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`${title}…`}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-faint)', border: '1px solid var(--border-input)' }}>esc</kbd>
        </div>

        <div className="max-h-[56vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-10" style={{ color: 'var(--text-muted)' }}>No resources match “{q}”.</p>
          ) : filtered.map((d, i) => (
            <button
              key={d.type + d.label}
              onClick={() => onPick(d)}
              onMouseEnter={() => setActive(i)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
              style={{ background: i === active ? 'var(--bg-card-hover)' : 'transparent' }}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base leading-none"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-input)' }}>
                {d.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${d.color || ''}`}>{d.label}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{d.category}</p>
              </div>
              {i === active && <CornerDownLeft size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

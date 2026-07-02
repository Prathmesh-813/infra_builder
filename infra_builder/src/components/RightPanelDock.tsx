// Shared, collapsible & resizable right-hand panel dock used by the Terraform,
// Ansible and Crossplane builders. Encapsulates: a clean icon tab-strip, a
// titled content header, collapse/expand (remembered), and drag-to-resize width
// (remembered). Replaces three duplicated, fixed-40%-wide inline panels.
import { useRef, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

export interface DockTab {
  id: string;
  icon: ReactNode;
  label: string;
  title: string;
  content: ReactNode;
}

const MIN_W = 340;
const maxW = () => Math.round(window.innerWidth * 0.72);

export default function RightPanelDock({ tabs, storageKey }: { tabs: DockTab[]; storageKey: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(`${storageKey}_open`) !== '0'; } catch { return true; }
  });
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`${storageKey}_w`));
      if (saved && saved >= MIN_W) return Math.min(saved, maxW());
    } catch { /* ignore */ }
    return Math.min(Math.max(Math.round(window.innerWidth * 0.38), MIN_W), maxW());
  });
  const dockRef = useRef<HTMLDivElement>(null);

  const persist = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
  const toggle = () => setOpen((v) => { persist(`${storageKey}_open`, v ? '0' : '1'); return !v; });
  const selectTab = (id: string) => {
    setActive(id);
    if (!open) { setOpen(true); persist(`${storageKey}_open`, '1'); }
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const rightEdge = dockRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    let last = width;
    const onMove = (ev: MouseEvent) => {
      last = Math.min(Math.max(rightEdge - ev.clientX, MIN_W), maxW());
      setWidth(last);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persist(`${storageKey}_w`, String(Math.round(last)));
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div ref={dockRef} className="flex flex-shrink-0 overflow-hidden relative" style={{ width: open ? width : undefined }}>
      {/* Drag-to-resize handle */}
      {open && (
        <div onMouseDown={startResize} title="Drag to resize"
          className="w-1.5 shrink-0 cursor-col-resize transition-colors"
          style={{ background: 'var(--border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border)')} />
      )}

      {/* Icon tab strip */}
      <div className="flex flex-col w-12 flex-shrink-0 border-r" style={{ background: 'var(--bg-surface)', borderRightColor: 'var(--border)' }}>
        <button onClick={toggle} title={open ? 'Collapse panel' : 'Expand panel'}
          aria-label={open ? 'Collapse panel' : 'Expand panel'}
          className="flex items-center justify-center h-11 shrink-0 transition-colors hover:bg-white/5"
          style={{ color: 'var(--tab-inactive)', borderBottom: '1px solid var(--border)' }}>
          {open ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
        {tabs.map((tab) => {
          const isActive = open && tab.id === active;
          return (
            <button key={tab.id} onClick={() => selectTab(tab.id)} title={tab.title}
              aria-label={tab.title}
              className="flex items-center justify-center h-12 relative transition-colors hover:bg-white/[0.03]"
              style={isActive
                ? { background: 'var(--tab-active-bg)', color: 'var(--accent-light)' }
                : { color: 'var(--tab-inactive)' }}>
              {tab.icon}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Titled content */}
      {open && activeTab && (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex items-center justify-between px-4 h-11 shrink-0 border-b"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 flex items-center" style={{ color: 'var(--accent-light)' }}>{activeTab.icon}</span>
              <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{activeTab.title}</span>
            </div>
            <button onClick={toggle} title="Collapse panel" aria-label="Collapse panel"
              className="shrink-0 p-1 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              <PanelRightClose size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <div key={active} className="fade-in h-full">{activeTab.content}</div>
          </div>
        </div>
      )}
    </div>
  );
}

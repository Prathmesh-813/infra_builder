// Renders the global toast stack (top-right). Mount once near the app root.
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToastStore, type ToastKind } from '../store/toastStore';

const SPEC: Record<ToastKind, { tint: string; dark: string; light: string; Icon: typeof Info }> = {
  success: { tint: '52,211,153', dark: '#6ee7b7', light: '#047857', Icon: CheckCircle2 },
  error:   { tint: '248,113,113', dark: '#fca5a5', light: '#b91c1c', Icon: AlertCircle },
  info:    { tint: '56,189,248',  dark: '#7dd3fc', light: '#0369a1', Icon: Info },
};

export default function Toaster() {
  const { isDark } = useTheme();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const c = SPEC[t.kind];
        return (
          <div key={t.id} role="status"
            className="toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-3 shadow-2xl"
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid rgba(${c.tint},${isDark ? 0.35 : 0.3})`,
              boxShadow: `0 10px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(${c.tint},0.08)`,
              backdropFilter: 'blur(12px)',
            }}>
            <c.Icon size={16} className="shrink-0 mt-0.5" style={{ color: isDark ? c.dark : c.light }} />
            <p className="text-sm flex-1 leading-snug" style={{ color: 'var(--text-primary)' }}>{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

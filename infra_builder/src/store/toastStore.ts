// Lightweight global toast system backed by zustand (already a dependency).
// Any module can fire one via the `toast` helper without prop-drilling or a
// provider: `toast.success('Saved')`, `toast.error(err.message)`.
import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const TTL_MS = 4500;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), TTL_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

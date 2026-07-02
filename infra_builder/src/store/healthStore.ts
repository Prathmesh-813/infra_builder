// Shared system-health state so the nav dropdown and the canvas status badge
// read the same data from a single poll (no duplicate network calls).
import { create } from 'zustand';
import { getSystemHealth, type HealthComponent } from '../utils/healthClient';

interface HealthState {
  components: HealthComponent[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  components: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      set({ components: await getSystemHealth() });
    } catch {
      set({ components: [] });
    } finally {
      set({ loading: false });
    }
  },
}));

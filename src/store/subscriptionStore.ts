import { create } from 'zustand';
import { SubscriptionTier } from '../data/subscription';

interface SubscriptionState {
  tier: SubscriptionTier;
  isAnnual: boolean;
  setTier: (tier: SubscriptionTier) => void;
  setIsAnnual: (annual: boolean) => void;
  upgrade: (tier: SubscriptionTier) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: (localStorage.getItem('infrastudio_tier') as SubscriptionTier) || 'free',
  isAnnual: localStorage.getItem('infrastudio_annual') === 'true',
  setTier: (tier) => {
    localStorage.setItem('infrastudio_tier', tier);
    set({ tier });
  },
  setIsAnnual: (annual) => {
    localStorage.setItem('infrastudio_annual', String(annual));
    set({ isAnnual: annual });
  },
  upgrade: (tier) => {
    localStorage.setItem('infrastudio_tier', tier);
    set({ tier });
  },
}));

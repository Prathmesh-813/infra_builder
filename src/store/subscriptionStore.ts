import { create } from 'zustand';
import { SubscriptionTier } from '../data/subscription';

export type FeatureFlag = 'ai-assistant' | 'live-pricing' | 'unlimited-projects' | 'collaboration' | 'sso' | 'audit-logs';

const PRO_FEATURES: FeatureFlag[] = ['ai-assistant', 'live-pricing', 'unlimited-projects'];
const ENTERPRISE_FEATURES: FeatureFlag[] = [...PRO_FEATURES, 'collaboration', 'sso', 'audit-logs'];

interface SubscriptionState {
  tier: SubscriptionTier;
  isAnnual: boolean;
  setTier: (tier: SubscriptionTier) => void;
  setIsAnnual: (annual: boolean) => void;
  upgrade: (tier: SubscriptionTier) => void;
  hasFeature: (feature: FeatureFlag) => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
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
  hasFeature: (feature) => {
    const { tier: currentTier } = get();
    if (currentTier === 'enterprise') return ENTERPRISE_FEATURES.includes(feature);
    if (currentTier === 'pro') return PRO_FEATURES.includes(feature);
    return false;
  },
}));

export function isProOrAbove(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'enterprise';
}

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  color: string;
  accent: string;
  gradient: string;
  glow: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    description: 'Get started with basic infrastructure design tools.',
    color: '#94a3b8',
    accent: '#64748b',
    gradient: 'linear-gradient(135deg, #64748b, #94a3b8)',
    glow: 'rgba(148,163,184,0.2)',
    features: [
      'Access to all design tools (Terraform, Ansible, Crossplane)',
      'Basic cost estimation (static pricing)',
      '1 active project per tool',
      'Community support',
      'Standard export (HCL only)',
    ],
    cta: 'Get Started Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    priceLabel: '/month per user',
    description: 'Unlock advanced features for professional infrastructure management.',
    color: '#818cf8',
    accent: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
    glow: 'rgba(99,102,241,0.35)',
    highlighted: true,
    features: [
      'Everything in Free',
      'Live cloud pricing (AWS, Azure, GCP)',
      'Unlimited projects per tool',
      'Cost comparison across providers',
      'PDF & Excel export with cost reports',
      'AI-powered compute optimization',
      'AI infrastructure generation from text',
      'Infrastructure monitoring & drift detection',
      'Priority email support',
    ],
    cta: 'Start Pro Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    priceLabel: '/month per user',
    description: 'Full platform power with team collaboration and dedicated support.',
    color: '#f97316',
    accent: '#ea580c',
    gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
    glow: 'rgba(249,115,22,0.3)',
    features: [
      'Everything in Pro',
      'Team collaboration & shared workspaces',
      'SSO / SAML authentication',
      'Role-based access control (RBAC)',
      'Custom integration & webhooks',
      'Audit logs & compliance reporting',
      'Dedicated account manager',
      '99.99% SLA guarantee',
    ],
    cta: 'Contact Sales',
  },
];

export function getPlan(tier: SubscriptionTier): SubscriptionPlan {
  return SUBSCRIPTION_PLANS.find(p => p.id === tier)!;
}

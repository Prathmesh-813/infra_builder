import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, ArrowLeft, Zap, Shield, Cloud, RefreshCw, ArrowRight, Crown } from 'lucide-react';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../data/subscription';
import { useSubscriptionStore } from '../store/subscriptionStore';

const TIER_ICONS: Record<string, typeof Zap> = {
  free: Zap,
  pro: Crown,
  enterprise: Shield,
};

const COMPARISON_ROWS = [
  { label: 'Terraform Designer', free: true, pro: true, enterprise: true },
  { label: 'Ansible Playbook Builder', free: true, pro: true, enterprise: true },
  { label: 'Crossplane Compositions', free: true, pro: true, enterprise: true },
  { label: 'Live Cloud Pricing', free: false, pro: true, enterprise: true },
  { label: 'Cost Comparison', free: true, pro: true, enterprise: true },
  { label: 'AI Infra Generation', free: false, pro: true, enterprise: true },
  { label: 'Compute Optimizer', free: false, pro: true, enterprise: true },
  { label: 'Monitoring & Drift Detection', free: false, pro: true, enterprise: true },
  { label: 'PDF / Excel Export', free: false, pro: true, enterprise: true },
  { label: 'Unlimited Projects', free: false, pro: true, enterprise: true },
  { label: 'Team Collaboration', free: false, pro: false, enterprise: true },
  { label: 'SSO / SAML', free: false, pro: false, enterprise: true },
  { label: 'RBAC', free: false, pro: false, enterprise: true },
  { label: 'Audit Logs', free: false, pro: false, enterprise: true },
  { label: 'Dedicated Support', free: false, pro: false, enterprise: true },
  { label: '99.99% SLA', free: false, pro: false, enterprise: true },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { tier, isAnnual, setIsAnnual, upgrade } = useSubscriptionStore();

  const handleUpgrade = (planId: SubscriptionTier) => {
    upgrade(planId);
  };

  const annualPrice = (monthly: number) => Math.round(monthly * 12 * 0.8);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-app)' }}>

      {/* ── Decorative background ─────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)', animation: 'float-slower 12s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)', animation: 'float-slow 10s ease-in-out infinite' }} />
        <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] rounded-full opacity-[0.02]"
          style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)', animation: 'float-slower 15s ease-in-out infinite' }} />
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-8 py-5 flex-shrink-0 z-10"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-extrabold gradient-text tracking-tight">Pricing</h1>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Choose the plan that fits your infrastructure needs</p>
          </div>
        </div>

        {/* Current plan badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
          <Sparkles size={14} className="text-indigo-400" />
          <span className="text-xs font-semibold" style={{ color: 'var(--accent-light)' }}>
            Current: {SUBSCRIPTION_PLANS.find(p => p.id === tier)?.name || 'Free'}
          </span>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">

          {/* ── Billing toggle ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-white' : ''}`}
              style={{ color: !isAnnual ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-7 rounded-full transition-all duration-300"
              style={{
                background: isAnnual ? 'linear-gradient(135deg, #818cf8, #6366f1)' : 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                boxShadow: isAnnual ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
              }}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all duration-300 shadow-lg ${isAnnual ? 'translate-x-7' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-white' : ''}`}
              style={{ color: isAnnual ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              Annual <span className="text-[10px] text-emerald-400 font-semibold">Save 20%</span>
            </span>
          </div>

          {/* ── Plan cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {SUBSCRIPTION_PLANS.map((plan, idx) => {
              const Icon = TIER_ICONS[plan.id as keyof typeof TIER_ICONS] || Zap;
              const isCurrent = tier === plan.id;
              const displayPrice = isAnnual ? annualPrice(plan.price) : plan.price;
              const priceSuffix = isAnnual ? '/month, billed annually' : plan.priceLabel;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl transition-all duration-500 hover:scale-[1.02] ${plan.highlighted ? 'ring-2 ring-indigo-500 shadow-2xl' : ''}`}
                  style={{
                    animation: `dash-card-in 0.5s ease ${idx * 0.1}s forwards`,
                    opacity: 0,
                  }}
                >
                  {/* Highlighted badge */}
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1.5 px-4 py-1 rounded-full text-[10px] font-bold text-white"
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          boxShadow: '0 0 20px rgba(99,102,241,0.4)',
                        }}>
                        <Crown size={12} /> Most Popular
                      </div>
                    </div>
                  )}

                  {/* Card */}
                  <div
                    className="relative h-full rounded-2xl p-[1px] overflow-hidden"
                    style={{
                      background: plan.highlighted
                        ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.3), rgba(99,102,241,0.5))'
                        : 'transparent',
                    }}>
                    <div
                      className="relative h-full rounded-2xl p-6 flex flex-col"
                      style={{
                        background: plan.highlighted ? 'var(--bg-surface-2)' : 'var(--bg-surface-2)',
                        border: plan.highlighted ? 'none' : '1px solid var(--border)',
                        backdropFilter: 'blur(12px)',
                      }}>

                      {/* Plan header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: plan.gradient,
                            boxShadow: `0 0 16px ${plan.glow}`,
                          }}>
                          <Icon size={18} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          {plan.price > 0 && <span className="text-lg font-semibold" style={{ color: plan.color }}>$</span>}
                          <span className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            {plan.price === 0 ? 'Free' : displayPrice}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{priceSuffix}</span>
                          )}
                        </div>
                        {isAnnual && plan.price > 0 && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            <span className="line-through opacity-50">${plan.price}/mo</span>
                            {' '}Save ${(plan.price * 12 - annualPrice(plan.price) * 12).toFixed(0)}/yr
                          </p>
                        )}
                      </div>

                      {/* CTA button */}
                      {isCurrent ? (
                        <div className="w-full py-2.5 rounded-xl text-xs font-bold text-center mb-5"
                          style={{
                            background: 'rgba(34,197,94,0.15)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            color: '#4ade80',
                          }}>
                          <Check size={14} className="inline mr-1.5" />Current Plan
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] mb-5 relative overflow-hidden group"
                          style={{
                            background: plan.highlighted ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--bg-elevated)',
                            border: plan.highlighted ? 'none' : '1px solid var(--border)',
                            boxShadow: plan.highlighted ? '0 4px 20px rgba(99,102,241,0.35)' : 'none',
                          }}>
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: plan.highlighted ? 'linear-gradient(135deg, #818cf8, #a78bfa)' : 'rgba(255,255,255,0.05)' }} />
                          <span className="relative flex items-center gap-2">
                            {plan.id === 'enterprise' ? 'Contact Sales' : `Upgrade to ${plan.name}`}
                            <ArrowRight size={13} />
                          </span>
                        </button>
                      )}

                      {/* Features */}
                      <div className="flex-1 space-y-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Features
                        </p>
                        {plan.features.map((feat, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <Check size={13} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Feature comparison table ────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden mb-8"
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border)',
            }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Full Feature Comparison
              </h3>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                See exactly what each plan includes
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Feature
                    </th>
                    {SUBSCRIPTION_PLANS.map(plan => (
                      <th key={plan.id} className="px-4 py-3 text-center">
                        <span className="text-xs font-bold" style={{ color: plan.color }}>{plan.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-6 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.label}</td>
                      {(['free', 'pro', 'enterprise'] as const).map(tierKey => (
                        <td key={tierKey} className="px-4 py-3 text-center">
                          {row[tierKey] ? (
                            <Check size={15} className="inline text-emerald-400" />
                          ) : (
                            <X size={13} className="inline" style={{ color: 'var(--text-faint)' }} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── FAQ / Enterprise CTA ────────────────────────────────────────── */}
          <div className="text-center py-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Need a custom plan?{' '}
              <button className="font-semibold hover:underline" style={{ color: 'var(--accent-light)' }}>
                Contact our sales team
              </button>
            </p>
            <div className="flex items-center justify-center gap-6 mt-4 text-[10px]" style={{ color: 'var(--text-faint)' }}>
              <span className="flex items-center gap-1.5"><Shield size={12} />Enterprise-grade security</span>
              <span className="flex items-center gap-1.5"><RefreshCw size={12} />Cancel anytime</span>
              <span className="flex items-center gap-1.5"><Cloud size={12} />Multi-cloud support</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

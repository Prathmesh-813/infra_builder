import { useEffect } from 'react';
import { TrendingUp, Zap, Gauge } from 'lucide-react';
import { useStore } from '../store/useStore';
import OptimizationPanel from '../components/OptimizationPanel';

export default function OptimizationDashboard() {
  useEffect(() => {
    useStore.getState().setCloudProvider('aws');
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden page-enter" style={{ background: 'var(--bg-app)' }}>
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary large orbs */}
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, #f97316 0%, #f59e0b 30%, transparent 70%)',
            animation: 'drift-orb 18s ease-in-out infinite',
          }} />
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #a855f7 0%, #6366f1 30%, transparent 70%)',
            animation: 'drift-orb 22s ease-in-out infinite reverse',
          }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.015]"
          style={{
            background: 'radial-gradient(circle, #34d399 0%, transparent 60%)',
            animation: 'float-slower 20s ease-in-out infinite',
          }} />

        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249,115,22,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249,115,22,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }} />

        {/* Secondary accent orbs */}
        <div className="absolute top-3/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 60%)',
            animation: 'float-slow 15s ease-in-out infinite',
          }} />
        <div className="absolute bottom-1/3 left-1/4 w-[250px] h-[250px] rounded-full opacity-[0.015]"
          style={{
            background: 'radial-gradient(circle, #8b5cf6 0%, transparent 60%)',
            animation: 'float-slower 25s ease-in-out infinite',
          }} />
      </div>

      {/* Header with glass effect */}
      <div className="relative flex-shrink-0 z-10"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
        }}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500 via-amber-500 to-purple-500 opacity-80" />
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(168,85,247,0.15))',
                border: '1px solid rgba(249,115,22,0.35)',
                boxShadow: '0 0 24px rgba(249,115,22,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              <div className="absolute inset-0 opacity-20"
                style={{
                  background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                  animation: 'shimmer-sweep 3s ease-in-out infinite',
                }} />
              <TrendingUp size={20} className="text-orange-400 relative z-10" />
            </div>
            <div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Compute <span className="gradient-text">Optimizer</span>
              </h1>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Right-size across AWS &middot; Azure &middot; GCP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                backdropFilter: 'blur(8px)',
              }}>
              <Gauge size={11} />
              <span>AI-powered right-sizing engine</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium"
              style={{
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.25)',
                color: '#f97316',
              }}>
              <Zap size={11} />
              <span>8 demo scenarios</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <OptimizationPanel />
      </div>
    </div>
  );
}

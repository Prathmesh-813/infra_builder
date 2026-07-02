import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardNav from './components/DashboardNav';
import LoginPage from './pages/LoginPage';
import AssistantPanel from './components/AssistantPanel';
import Toaster from './components/Toaster';
import { isAuthenticated } from './utils/ozClient';
import { useHealthStore } from './store/healthStore';
import { routeImporters } from './pages/lazyRoutes';

// Route pages are code-split so heavy screens (and their deps: pdf, ocr, editor)
// only download when first visited — keeps the initial bundle lean. The same
// importers power hover-prefetch in the nav (see lazyRoutes.ts).
const DashboardPage = lazy(routeImporters['/dashboard']);
const TerraformDashboard = lazy(routeImporters['/terraform']);
const AnsibleDashboard = lazy(routeImporters['/ansible']);
const CrossplaneDashboard = lazy(routeImporters['/crossplane']);
const OptimizationDashboard = lazy(routeImporters['/optimization']);
const MonitoringDashboard = lazy(routeImporters['/monitoring']);
const AnalyticsDashboard = lazy(routeImporters['/analytics']);
const PricingPage = lazy(routeImporters['/pricing']);
const AgentsPage = lazy(routeImporters['/agents']);
const ServersPage = lazy(routeImporters['/servers']);
const SecretsPage = lazy(routeImporters['/secrets']);
const SchedulesPage = lazy(routeImporters['/schedules']);
const CostComparisonDashboard = lazy(routeImporters['/cost-comparison']);
const CostingPage = lazy(routeImporters['/costing']);
const DeployPage = lazy(routeImporters['/deploy']);

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--text-muted)' }}>
      <Loader2 size={18} className="animate-spin" /> <span className="text-sm">Loading…</span>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => isAuthenticated());
  const refreshHealth = useHealthStore((s) => s.refresh);

  // Single shared poll for system health (nav dropdown + canvas badge read it).
  useEffect(() => {
    if (!isLoggedIn) return;
    refreshHealth();
    const t = setInterval(refreshHealth, 30000);
    return () => clearInterval(t);
  }, [isLoggedIn, refreshHealth]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div
      className="h-screen flex overflow-hidden relative"
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      {/* ── Global animated background orbs ─────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
            animation: 'drift-orb 20s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.025]"
          style={{
            background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)',
            animation: 'drift-orb 25s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.015]"
          style={{
            background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
            animation: 'drift-orb 30s ease-in-out infinite 5s',
          }}
        />
        <div
          className="absolute top-2/3 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, #34d399 0%, transparent 70%)',
            animation: 'drift-orb 22s ease-in-out infinite 2s',
          }}
        />
      </div>

      <DashboardNav />
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/terraform" element={<TerraformDashboard />} />
          <Route path="/ansible" element={<AnsibleDashboard />} />
          <Route path="/crossplane" element={<CrossplaneDashboard />} />
          <Route path="/optimization" element={<OptimizationDashboard />} />
          <Route path="/monitoring" element={<MonitoringDashboard />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/pricing" element={<PricingPage />} />
          {/* Operations (Oz) */}
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/secrets" element={<SecretsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/cost-comparison" element={<CostComparisonDashboard />} />
          {/* Deploy & Costing */}
          <Route path="/deploy" element={<DeployPage />} />
          <Route path="/costing" element={<CostingPage />} />
        </Routes>
        </Suspense>
      </div>
      <AssistantPanel />
      <Toaster />
    </div>
  );
}

import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardNav from './components/DashboardNav';
import TerraformDashboard from './pages/TerraformDashboard';
import CostComparisonDashboard from './pages/CostComparisonDashboard';
import AnsibleDashboard from './pages/AnsibleDashboard';
import CrossplaneDashboard from './pages/CrossplaneDashboard';
import OptimizationDashboard from './pages/OptimizationDashboard';
import MonitoringDashboard from './pages/MonitoringDashboard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('infrastudio_logged_in') === 'true'
  );

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
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/terraform" element={<TerraformDashboard />} />
          <Route path="/cost-comparison" element={<CostComparisonDashboard />} />
          <Route path="/ansible" element={<AnsibleDashboard />} />
          <Route path="/crossplane" element={<CrossplaneDashboard />} />
          <Route path="/optimization" element={<OptimizationDashboard />} />
          <Route path="/monitoring" element={<MonitoringDashboard />} />
        </Routes>
      </div>
    </div>
  );
}

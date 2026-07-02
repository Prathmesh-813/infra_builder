// Single source of truth for code-split route modules. Used both by App's
// React.lazy() and by the nav's hover-prefetch, so a chunk can be warmed the
// moment a user hovers its nav icon — navigation then feels instant.
import type { ComponentType } from 'react';

type Importer = () => Promise<{ default: ComponentType<unknown> }>;

export const routeImporters: Record<string, Importer> = {
  '/dashboard': () => import('./DashboardPage'),
  '/terraform': () => import('./TerraformDashboard'),
  '/cost-comparison': () => import('./CostComparisonDashboard'),
  '/costing': () => import('./CostingPage'),
  '/deploy': () => import('./DeployPage'),
  '/ansible': () => import('./AnsibleDashboard'),
  '/crossplane': () => import('./CrossplaneDashboard'),
  '/optimization': () => import('./OptimizationDashboard'),
  '/monitoring': () => import('./MonitoringDashboard'),
  '/analytics': () => import('./AnalyticsDashboard'),
  '/pricing': () => import('./PricingPage'),
  '/agents': () => import('./ops/AgentsPage'),
  '/servers': () => import('./ops/ServersPage'),
  '/secrets': () => import('./ops/SecretsPage'),
  '/schedules': () => import('./ops/SchedulesPage'),
};

// Warm a route's chunk ahead of navigation (no-op if already loaded/unknown).
export function prefetchRoute(path: string): void {
  routeImporters[path]?.();
}

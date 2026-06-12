import { ComparisonService, COMPARISON_SERVICES, ComparisonProvider } from '../data/costComparisonData';

export interface ComparisonItemConfig {
  serviceId: string;
  providerConfigs: Record<ComparisonProvider, Record<string, string | number | boolean>>;
}

export interface ProviderResult {
  provider: ComparisonProvider;
  providerLabel: string;
  serviceLabel: string;
  icon: string;
  color: string;
  monthlyMin: number;
  monthlyMax: number;
  basis: string;
}

export interface ComparisonResult {
  serviceId: string;
  serviceName: string;
  icon: string;
  color: string;
  bgColor: string;
  category: string;
  providers: ProviderResult[];
  winner: ComparisonProvider | 'tie';
  savingsPct: number;
}

export function getServiceById(id: string): ComparisonService | undefined {
  return COMPARISON_SERVICES.find(s => s.id === id);
}

export function computeComparison(config: ComparisonItemConfig): ComparisonResult {
  const service = getServiceById(config.serviceId);
  if (!service) {
    return {
      serviceId: config.serviceId,
      serviceName: 'Unknown',
      icon: '❓',
      color: 'text-gray-400',
      bgColor: 'bg-gray-900',
      category: '',
      providers: [],
      winner: 'tie',
      savingsPct: 0,
    };
  }

  const results: ProviderResult[] = service.providers.map((p) => {
    const cfg = config.providerConfigs[p.provider] || {};
    const est = p.estimate(cfg);
    return {
      provider: p.provider,
      providerLabel: p.providerLabel,
      serviceLabel: p.serviceLabel,
      icon: p.icon,
      color: p.color,
      monthlyMin: Math.round(est.min * 100) / 100,
      monthlyMax: Math.round(est.max * 100) / 100,
      basis: est.basis,
    };
  });

  const avgCosts = results.map(r => (r.monthlyMin + r.monthlyMax) / 2);
  const minAvg = Math.min(...avgCosts);
  const minIndex = avgCosts.indexOf(minAvg);
  const winner = results.length > 0 ? results[minIndex].provider : 'tie';

  const maxAvg = Math.max(...avgCosts);
  const savingsPct = maxAvg > 0 ? Math.round((1 - minAvg / maxAvg) * 100) : 0;

  return {
    serviceId: service.id,
    serviceName: service.serviceName,
    icon: service.icon,
    color: service.color,
    bgColor: service.bgColor,
    category: service.category,
    providers: results,
    winner,
    savingsPct,
  };
}

export function getDefaultConfigs(serviceId: string): Record<ComparisonProvider, Record<string, string | number | boolean>> {
  const service = getServiceById(serviceId);
  if (!service) return {} as Record<ComparisonProvider, Record<string, string | number | boolean>>;

  const configs = {} as Record<ComparisonProvider, Record<string, string | number | boolean>>;
  for (const p of service.providers) {
    const cfg: Record<string, string | number | boolean> = {};
    p.fields.forEach((f) => {
      if (f.default !== undefined) cfg[f.key] = f.default;
    });
    configs[p.provider] = cfg;
  }
  return configs;
}

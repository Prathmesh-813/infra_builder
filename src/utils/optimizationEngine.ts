import {
  OptimizationService,
  OPTIMIZATION_SERVICES,
  findInstanceInFamily,
  findFamilyForInstance,
  InstanceUpgradePath,
} from '../data/optimizationData';

export type RecommendationAction = 'upgrade' | 'downgrade' | 'optimize' | 'none';

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  network?: number;
  io?: number;
}

export interface Recommendation {
  serviceId: string;
  serviceName: string;
  provider: string;
  providerLabel: string;
  category: string;
  icon: string;
  color: string;
  bgColor: string;
  currentInstance: string;
  recommendedInstance: string;
  currentFamily: string;
  action: RecommendationAction;
  reason: string;
  metric: string;
  metricValue: number;
  currentCost: number;
  recommendedCost: number;
  savings: number;
  savingsPct: number;
  vcpuCurrent: number;
  vcpuRecommended: number;
  memoryCurrent: number;
  memoryRecommended: number;
}

export function getOptimizationService(serviceId: string): OptimizationService | undefined {
  return OPTIMIZATION_SERVICES.find(s => s.id === serviceId);
}

export function getAllOptimizationServices(): OptimizationService[] {
  return OPTIMIZATION_SERVICES;
}

export function generateRecommendation(
  serviceId: string,
  instanceType: string,
  metrics: ResourceMetrics,
): Recommendation | null {
  const service = getOptimizationService(serviceId);
  if (!service) return null;

  const family = findFamilyForInstance(service, instanceType);
  if (!family) return null;

  const current = findInstanceInFamily(family, instanceType);
  if (!current) return null;

  const { metric, value, direction } = findTrigger(service, metrics);
  if (direction === 'none') {
    return {
      serviceId,
      serviceName: service.serviceName,
      provider: service.provider,
      providerLabel: service.serviceLabel,
      category: service.category,
      icon: service.icon,
      color: service.color,
      bgColor: service.bgColor,
      currentInstance: instanceType,
      recommendedInstance: instanceType,
      currentFamily: family.family,
      action: 'none',
      reason: `Your ${instanceType} is appropriately sized for the current workload with ${metric} at ${value}%. No changes recommended.`,
      metric,
      metricValue: value,
      currentCost: current.price,
      recommendedCost: current.price,
      savings: 0,
      savingsPct: 0,
      vcpuCurrent: current.vcpu,
      vcpuRecommended: current.vcpu,
      memoryCurrent: current.memory,
      memoryRecommended: current.memory,
    };
  }

  const targetInstance = direction === 'upgrade' ? current.upgrade : current.downgrade;
  if (!targetInstance) {
    return {
      ...baseResult(service, instanceType, current, family.family, metric, value, direction),
      action: direction,
      recommendedInstance: instanceType,
      recommendedCost: current.price,
      reason: `Your ${instanceType} is already at the ${direction === 'upgrade' ? 'maximum' : 'minimum'} size in the ${family.family} family. Consider switching to a different instance family.`,
      vcpuCurrent: current.vcpu,
      vcpuRecommended: current.vcpu,
      memoryCurrent: current.memory,
      memoryRecommended: current.memory,
      savings: 0,
      savingsPct: 0,
    };
  }

  const recommended = findInstanceInFamily(family, targetInstance);
  if (!recommended) {
    return null;
  }

  const currentCost = current.price;
  const recommendedCost = recommended.price;
  const savings = direction === 'downgrade' ? currentCost - recommendedCost : recommendedCost - currentCost;
  const savingsPct = direction === 'downgrade'
    ? Math.round((savings / currentCost) * 100)
    : 0;

  const reason = service.getRecommendationReason(metric, value, instanceType, targetInstance, direction);

  return {
    serviceId,
    serviceName: service.serviceName,
    provider: service.provider,
    providerLabel: service.serviceLabel,
    category: service.category,
    icon: service.icon,
    color: service.color,
    bgColor: service.bgColor,
    currentInstance: instanceType,
    recommendedInstance: targetInstance,
    currentFamily: family.family,
    action: direction,
    reason,
    metric,
    metricValue: value,
    currentCost,
    recommendedCost: direction === 'upgrade' ? recommendedCost : recommendedCost,
    savings,
    savingsPct,
    vcpuCurrent: current.vcpu,
    vcpuRecommended: recommended.vcpu,
    memoryCurrent: current.memory,
    memoryRecommended: recommended.memory,
  };
}

function baseResult(
  service: OptimizationService,
  instanceType: string,
  current: InstanceUpgradePath,
  currentFamily: string,
  metric: string,
  value: number,
  direction: RecommendationAction,
): Recommendation {
  return {
    serviceId: service.id,
    serviceName: service.serviceName,
    provider: service.provider,
    providerLabel: service.serviceLabel,
    category: service.category,
    icon: service.icon,
    color: service.color,
    bgColor: service.bgColor,
    currentInstance: instanceType,
    recommendedInstance: instanceType,
    currentFamily,
    action: direction,
    reason: '',
    metric,
    metricValue: value,
    currentCost: current.price,
    recommendedCost: current.price,
    savings: 0,
    savingsPct: 0,
    vcpuCurrent: current.vcpu,
    vcpuRecommended: current.vcpu,
    memoryCurrent: current.memory,
    memoryRecommended: current.memory,
  };
}

function findTrigger(
  service: OptimizationService,
  metrics: ResourceMetrics,
): { metric: string; value: number; direction: 'upgrade' | 'downgrade' | 'none' } {
  const thresholds = service.thresholds;

  for (const t of thresholds) {
    const value = metrics[t.metric];
    if (value === undefined) continue;
    if (value >= t.highThreshold) {
      return { metric: t.metric, value, direction: 'upgrade' };
    }
  }

  for (const t of thresholds) {
    const value = metrics[t.metric];
    if (value === undefined) continue;
    if (value <= t.lowThreshold && value >= 0) {
      return { metric: t.metric, value, direction: 'downgrade' };
    }
  }

  const midMetric = thresholds.find(t => metrics[t.metric] !== undefined);
  return { metric: midMetric?.metric ?? 'cpu', value: metrics.cpu, direction: 'none' };
}

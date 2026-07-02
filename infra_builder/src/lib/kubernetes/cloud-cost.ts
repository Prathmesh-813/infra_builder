// Server-only helpers that price out a small, representative Kubernetes setup
// (1 cluster control plane + N worker units) per cloud, using each provider's
// own public pricing data where one is actually fetchable without credentials.
//
// Every cloud offers two compute models, and both are priced:
//   - "nodes":      self-managed worker nodes (EC2 / Azure VMs / GCE) you patch and scale yourself —
//                    pick any real instance type from that cloud's catalog below
//   - "serverless": the cloud runs the Pods for you — EKS Fargate, AKS Virtual Nodes (ACI-backed),
//                    or GKE Autopilot — billed per Pod's vCPU/memory request, picked from a
//                    small set of standard task-size presets instead of a whole instance
//
// AWS:   the bulk Price List API is public and unauthenticated, but each offer file is
//        20-30MB, so it's fetched with a 24h Next.js cache (`next: { revalidate }`)
//        instead of on every request. Covers the EKS control plane (AmazonEKS file) and
//        Fargate vCPU/GB-hour rates (AmazonECS file) live; EC2 instance-type rates are a
//        static, dated reference table — there's no small public endpoint for those.
// Azure: the Retail Prices API is public, unauthenticated, and small/fast — genuinely
//        fetched live on every request, for the control plane, ANY VM SKU you pick, and
//        Container Instances (ACI) vCPU/memory rates.
// GCP:   the Cloud Billing Catalog API requires an API key we don't have, and there is
//        no public unauthenticated equivalent — every GKE figure (node-based or
//        Autopilot) is a static, clearly-dated reference instead of a live call.
// On-prem: hardware/SAN/licensing is CapEx, not an hourly cloud rate — "serverless" and
//        "instance type" have no meaning here.

export type CostSource = "live" | "live-cached" | "static" | "not-applicable";
export type ComputeMode = "nodes" | "serverless";

export interface CostLineItem {
  label: string;
  monthlyUsd: number;
  note: string;
}

export interface CostEstimate {
  cloud: string;
  source: CostSource;
  sourceLabel: string;
  asOf: string;
  items: CostLineItem[];
  monthlyTotalUsd: number;
}

export interface InstanceTypeInfo {
  id: string;
  label: string;
  vcpu: number;
  ramGb: number;
  hourlyUsd?: number; // static reference, where the cloud has no cheap live per-type lookup
}

export interface StorageTypeInfo {
  id: string;
  label: string;
  media: "SSD" | "HDD" | "NVMe";
  usdPerGbMonth: number;
}

const HOURS_PER_MONTH = 730;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Shared serverless task-size presets (Fargate task sizes are the de facto standard set;
// ACI and Autopilot are billed continuously per vCPU/GB so the same presets apply cleanly).
export const SERVERLESS_SIZES: InstanceTypeInfo[] = [
  { id: "0.25vcpu-0.5gb", label: "0.25 vCPU / 0.5 GB", vcpu: 0.25, ramGb: 0.5 },
  { id: "0.25vcpu-1gb", label: "0.25 vCPU / 1 GB", vcpu: 0.25, ramGb: 1 },
  { id: "0.5vcpu-1gb", label: "0.5 vCPU / 1 GB", vcpu: 0.5, ramGb: 1 },
  { id: "0.5vcpu-2gb", label: "0.5 vCPU / 2 GB", vcpu: 0.5, ramGb: 2 },
  { id: "1vcpu-2gb", label: "1 vCPU / 2 GB", vcpu: 1, ramGb: 2 },
  { id: "1vcpu-4gb", label: "1 vCPU / 4 GB", vcpu: 1, ramGb: 4 },
  { id: "2vcpu-4gb", label: "2 vCPU / 4 GB", vcpu: 2, ramGb: 4 },
  { id: "2vcpu-8gb", label: "2 vCPU / 8 GB", vcpu: 2, ramGb: 8 },
  { id: "4vcpu-8gb", label: "4 vCPU / 8 GB", vcpu: 4, ramGb: 8 },
  { id: "4vcpu-16gb", label: "4 vCPU / 16 GB", vcpu: 4, ramGb: 16 },
];

function findServerless(id: string): InstanceTypeInfo {
  return SERVERLESS_SIZES.find((s) => s.id === id) ?? SERVERLESS_SIZES[2];
}

// ---- AWS ----

export const AWS_REGIONS: { value: string; label: string }[] = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "ca-west-1", label: "Canada West (Calgary)" },
  { value: "sa-east-1", label: "South America (Sao Paulo)" },
  { value: "eu-west-1", label: "EU (Ireland)" },
  { value: "eu-west-2", label: "EU (London)" },
  { value: "eu-west-3", label: "EU (Paris)" },
  { value: "eu-central-1", label: "EU (Frankfurt)" },
  { value: "eu-central-2", label: "Europe (Zurich)" },
  { value: "eu-north-1", label: "EU (Stockholm)" },
  { value: "eu-south-1", label: "EU (Milan)" },
  { value: "eu-south-2", label: "Europe (Spain)" },
  { value: "af-south-1", label: "Africa (Cape Town)" },
  { value: "me-south-1", label: "Middle East (Bahrain)" },
  { value: "me-central-1", label: "Middle East (UAE)" },
  { value: "il-central-1", label: "Israel (Tel Aviv)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-south-2", label: "Asia Pacific (Hyderabad)" },
  { value: "ap-east-1", label: "Asia Pacific (Hong Kong)" },
  { value: "ap-east-2", label: "Asia Pacific (Taipei)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-southeast-3", label: "Asia Pacific (Jakarta)" },
  { value: "ap-southeast-4", label: "Asia Pacific (Melbourne)" },
  { value: "ap-southeast-5", label: "Asia Pacific (Malaysia)" },
  { value: "ap-southeast-6", label: "Asia Pacific (New Zealand)" },
  { value: "ap-southeast-7", label: "Asia Pacific (Thailand)" },
  { value: "mx-central-1", label: "Mexico (Central)" },
];

// Static reference, on-demand Linux, us-east-1, June 2026 — AWS has no small public
// endpoint for per-instance EC2 pricing (only the same 100MB+ bulk files region-wide).
export const AWS_INSTANCE_TYPES: InstanceTypeInfo[] = [
  { id: "t3.micro", label: "t3.micro — burstable, general purpose", vcpu: 2, ramGb: 1, hourlyUsd: 0.0104 },
  { id: "t3.small", label: "t3.small — burstable, general purpose", vcpu: 2, ramGb: 2, hourlyUsd: 0.0208 },
  { id: "t3.medium", label: "t3.medium — burstable, general purpose", vcpu: 2, ramGb: 4, hourlyUsd: 0.0416 },
  { id: "t3.large", label: "t3.large — burstable, general purpose", vcpu: 2, ramGb: 8, hourlyUsd: 0.0832 },
  { id: "t3.xlarge", label: "t3.xlarge — burstable, general purpose", vcpu: 4, ramGb: 16, hourlyUsd: 0.1664 },
  { id: "m5.large", label: "m5.large — general purpose", vcpu: 2, ramGb: 8, hourlyUsd: 0.096 },
  { id: "m5.xlarge", label: "m5.xlarge — general purpose", vcpu: 4, ramGb: 16, hourlyUsd: 0.192 },
  { id: "m5.2xlarge", label: "m5.2xlarge — general purpose", vcpu: 8, ramGb: 32, hourlyUsd: 0.384 },
  { id: "m5.4xlarge", label: "m5.4xlarge — general purpose", vcpu: 16, ramGb: 64, hourlyUsd: 0.768 },
  { id: "c5.large", label: "c5.large — compute optimized", vcpu: 2, ramGb: 4, hourlyUsd: 0.085 },
  { id: "c5.xlarge", label: "c5.xlarge — compute optimized", vcpu: 4, ramGb: 8, hourlyUsd: 0.17 },
  { id: "c5.2xlarge", label: "c5.2xlarge — compute optimized", vcpu: 8, ramGb: 16, hourlyUsd: 0.34 },
  { id: "r5.large", label: "r5.large — memory optimized", vcpu: 2, ramGb: 16, hourlyUsd: 0.126 },
  { id: "r5.xlarge", label: "r5.xlarge — memory optimized", vcpu: 4, ramGb: 32, hourlyUsd: 0.252 },
  { id: "r5.2xlarge", label: "r5.2xlarge — memory optimized", vcpu: 8, ramGb: 64, hourlyUsd: 0.504 },
];

function findAwsInstance(id: string): InstanceTypeInfo {
  return AWS_INSTANCE_TYPES.find((i) => i.id === id) ?? AWS_INSTANCE_TYPES[2];
}

// Block storage (used with EC2/"nodes" mode) — static reference, June 2026
export const AWS_BLOCK_STORAGE_TYPES: StorageTypeInfo[] = [
  { id: "gp3", label: "gp3 — General Purpose SSD (recommended default)", media: "SSD", usdPerGbMonth: 0.08 },
  { id: "gp2", label: "gp2 — General Purpose SSD (previous generation)", media: "SSD", usdPerGbMonth: 0.10 },
  { id: "io2", label: "io2 — Provisioned IOPS SSD (high-performance databases)", media: "SSD", usdPerGbMonth: 0.125 },
  { id: "st1", label: "st1 — Throughput Optimized HDD (big sequential/streaming data)", media: "HDD", usdPerGbMonth: 0.045 },
  { id: "sc1", label: "sc1 — Cold HDD (infrequently accessed, cheapest)", media: "HDD", usdPerGbMonth: 0.015 },
];

// File storage (used with Fargate/"serverless" mode) — static reference, June 2026
export const AWS_FILE_STORAGE_TYPES: StorageTypeInfo[] = [
  { id: "efs-standard", label: "EFS Standard — multi-AZ, default", media: "SSD", usdPerGbMonth: 0.30 },
  { id: "efs-standard-ia", label: "EFS Standard-Infrequent Access — cheaper, slower first byte", media: "HDD", usdPerGbMonth: 0.025 },
  { id: "efs-onezone", label: "EFS One Zone — single-AZ, lower cost", media: "SSD", usdPerGbMonth: 0.16 },
  { id: "efs-onezone-ia", label: "EFS One Zone-IA — single-AZ + infrequent access", media: "HDD", usdPerGbMonth: 0.0133 },
];

async function fetchAwsBulkSkuPrice(
  offerCode: string,
  regionCode: string,
  matchUsageType: (usagetype: string) => boolean
): Promise<number | null> {
  try {
    const res = await fetch(`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/${offerCode}/current/index.json`, {
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data.products as Record<string, { sku: string; attributes: Record<string, string> }>;
    const match = Object.values(products).find(
      (p) => p.attributes.regionCode === regionCode && matchUsageType(p.attributes.usagetype ?? "")
    );
    if (!match) return null;
    const onDemand = data.terms.OnDemand[match.sku];
    const termKey = Object.keys(onDemand)[0];
    const priceDimensions = onDemand[termKey].priceDimensions;
    const dimKey = Object.keys(priceDimensions)[0];
    return parseFloat(priceDimensions[dimKey].pricePerUnit.USD);
  } catch {
    return null;
  }
}

async function priceAws(
  regionCode: string,
  nodeCount: number,
  instanceType: string,
  computeMode: ComputeMode,
  storageGb: number,
  storageType: string
): Promise<CostEstimate> {
  const controlPlaneHourly = await fetchAwsBulkSkuPrice("AmazonEKS", regionCode, (u) => u.endsWith("AmazonEKS-Hours:perCluster"));
  const cpLive = controlPlaneHourly !== null;
  const cpHourly = controlPlaneHourly ?? 0.1;
  const controlPlane = round2(cpHourly * HOURS_PER_MONTH);
  const lb = 16.2;

  const items: CostLineItem[] = [
    { label: "EKS control plane", monthlyUsd: controlPlane, note: `${cpLive ? "Live (24h-cached)" : "Static fallback"} — $${cpHourly.toFixed(4)}/hr × ${HOURS_PER_MONTH} hrs` },
  ];

  if (computeMode === "serverless") {
    const [vcpuHourly, gbHourly] = await Promise.all([
      fetchAwsBulkSkuPrice("AmazonECS", regionCode, (u) => u.endsWith("Fargate-vCPU-Hours:perCPU") && !u.includes("Windows") && !u.includes("ARM")),
      fetchAwsBulkSkuPrice("AmazonECS", regionCode, (u) => u.endsWith("Fargate-GB-Hours") && !u.includes("Windows") && !u.includes("ARM")),
    ]);
    const fgLive = vcpuHourly !== null && gbHourly !== null;
    const { vcpu, ramGb, label } = findServerless(instanceType);
    const perPodHourly = (vcpuHourly ?? 0.04048) * vcpu + (gbHourly ?? 0.004445) * ramGb;
    const podsCost = round2(perPodHourly * HOURS_PER_MONTH * nodeCount);
    const fileStorage = AWS_FILE_STORAGE_TYPES.find((s) => s.id === storageType) ?? AWS_FILE_STORAGE_TYPES[0];
    const efs = round2(storageGb * fileStorage.usdPerGbMonth);

    items.push(
      { label: `${nodeCount}× Fargate Pod (${label})`, monthlyUsd: podsCost, note: `${fgLive ? "Live (24h-cached) from AWS's public Price List API" : "Static fallback"} — Fargate bills per Pod's actual vCPU+memory request, not per whole instance` },
      { label: `${fileStorage.label} (${storageGb} GB)`, monthlyUsd: efs, note: `Static reference — $${fileStorage.usdPerGbMonth}/GB-month. Fargate Pods have no attached EBS volume; persistent storage means EFS, not EBS.` },
      { label: "Load balancer (NLB)", monthlyUsd: lb, note: "Static reference — base hourly charge" }
    );
  } else {
    const inst = findAwsInstance(instanceType);
    const workers = round2((inst.hourlyUsd ?? 0.0832) * HOURS_PER_MONTH * nodeCount);
    const blockStorage = AWS_BLOCK_STORAGE_TYPES.find((s) => s.id === storageType) ?? AWS_BLOCK_STORAGE_TYPES[0];
    const ebs = round2(nodeCount * storageGb * blockStorage.usdPerGbMonth);

    items.push(
      { label: `${nodeCount}× EC2 worker node (${inst.id})`, monthlyUsd: workers, note: `Static reference — $${inst.hourlyUsd}/hr on-demand × ${HOURS_PER_MONTH} hrs × ${nodeCount} (no small public AWS endpoint exists for per-instance EC2 pricing)` },
      { label: `EBS volumes (${blockStorage.label}, ${storageGb} GB/node)`, monthlyUsd: ebs, note: `Static reference — $${blockStorage.usdPerGbMonth}/GB-month` },
      { label: "Load balancer (NLB)", monthlyUsd: lb, note: "Static reference — base hourly charge" }
    );
  }

  return {
    cloud: computeMode === "serverless" ? "AWS EKS (Fargate)" : "AWS EKS (EC2 nodes)",
    source: cpLive ? "live-cached" : "static",
    sourceLabel: cpLive
      ? "Control-plane and (if Fargate) compute fees fetched live from AWS's public Price List API (cached 24h); per-instance EC2/EBS figures are static references"
      : "AWS pricing fetch failed — all figures are static references",
    asOf: new Date().toISOString().slice(0, 10),
    items,
    monthlyTotalUsd: round2(items.reduce((s, i) => s + i.monthlyUsd, 0)),
  };
}

// ---- Azure ----

export const AZURE_REGIONS: { value: string; label: string }[] = [
  { value: "eastus", label: "East US" },
  { value: "eastus2", label: "East US 2" },
  { value: "centralus", label: "Central US" },
  { value: "northcentralus", label: "North Central US" },
  { value: "southcentralus", label: "South Central US" },
  { value: "westcentralus", label: "West Central US" },
  { value: "westus", label: "West US" },
  { value: "westus2", label: "West US 2" },
  { value: "westus3", label: "West US 3" },
  { value: "canadacentral", label: "Canada Central" },
  { value: "canadaeast", label: "Canada East" },
  { value: "brazilsouth", label: "Brazil South" },
  { value: "northeurope", label: "North Europe" },
  { value: "westeurope", label: "West Europe" },
  { value: "uksouth", label: "UK South" },
  { value: "ukwest", label: "UK West" },
  { value: "francecentral", label: "France Central" },
  { value: "germanywestcentral", label: "Germany West Central" },
  { value: "germanynorth", label: "Germany North" },
  { value: "switzerlandnorth", label: "Switzerland North" },
  { value: "norwayeast", label: "Norway East" },
  { value: "swedencentral", label: "Sweden Central" },
  { value: "polandcentral", label: "Poland Central" },
  { value: "italynorth", label: "Italy North" },
  { value: "spaincentral", label: "Spain Central" },
  { value: "uaenorth", label: "UAE North" },
  { value: "qatarcentral", label: "Qatar Central" },
  { value: "southafricanorth", label: "South Africa North" },
  { value: "centralindia", label: "Central India" },
  { value: "southindia", label: "South India" },
  { value: "westindia", label: "West India" },
  { value: "japaneast", label: "Japan East" },
  { value: "japanwest", label: "Japan West" },
  { value: "koreacentral", label: "Korea Central" },
  { value: "southeastasia", label: "Southeast Asia" },
  { value: "eastasia", label: "East Asia" },
  { value: "australiaeast", label: "Australia East" },
  { value: "australiasoutheast", label: "Australia Southeast" },
  { value: "newzealandnorth", label: "New Zealand North" },
];

// No static rate needed — Azure's Retail Prices API is queried live by exact SKU name,
// so this list is just the catalog of selectable SKUs with their known vCPU/RAM shape.
export const AZURE_VM_TYPES: InstanceTypeInfo[] = [
  { id: "Standard_B1s", label: "Standard_B1s — burstable, general purpose", vcpu: 1, ramGb: 1 },
  { id: "Standard_B2s", label: "Standard_B2s — burstable, general purpose", vcpu: 2, ramGb: 4 },
  { id: "Standard_B2ms", label: "Standard_B2ms — burstable, general purpose", vcpu: 2, ramGb: 8 },
  { id: "Standard_D2s_v3", label: "Standard_D2s_v3 — general purpose", vcpu: 2, ramGb: 8 },
  { id: "Standard_D4s_v3", label: "Standard_D4s_v3 — general purpose", vcpu: 4, ramGb: 16 },
  { id: "Standard_D8s_v3", label: "Standard_D8s_v3 — general purpose", vcpu: 8, ramGb: 32 },
  { id: "Standard_F2s_v2", label: "Standard_F2s_v2 — compute optimized", vcpu: 2, ramGb: 4 },
  { id: "Standard_F4s_v2", label: "Standard_F4s_v2 — compute optimized", vcpu: 4, ramGb: 8 },
  { id: "Standard_F8s_v2", label: "Standard_F8s_v2 — compute optimized", vcpu: 8, ramGb: 16 },
  { id: "Standard_E2s_v3", label: "Standard_E2s_v3 — memory optimized", vcpu: 2, ramGb: 16 },
  { id: "Standard_E4s_v3", label: "Standard_E4s_v3 — memory optimized", vcpu: 4, ramGb: 32 },
  { id: "Standard_E8s_v3", label: "Standard_E8s_v3 — memory optimized", vcpu: 8, ramGb: 64 },
];

// Managed disks (used with VM/"nodes" mode) — simplified flat $/GB-month static reference.
// Real Azure disk billing is fixed-size-tier based (E1...E80), not linear per-GB — this is
// an approximation for estimation purposes, not Azure's actual tiered invoice math.
export const AZURE_DISK_TYPES: StorageTypeInfo[] = [
  { id: "premium-ssd", label: "Premium SSD — recommended default for AKS nodes", media: "SSD", usdPerGbMonth: 0.0764 },
  { id: "standard-ssd", label: "Standard SSD — balanced cost/performance", media: "SSD", usdPerGbMonth: 0.05 },
  { id: "standard-hdd", label: "Standard HDD — cheapest, lowest performance", media: "HDD", usdPerGbMonth: 0.04 },
  { id: "ultra-disk", label: "Ultra Disk — highest performance, databases", media: "NVMe", usdPerGbMonth: 0.12 },
];

// Azure Files (used with Virtual Nodes/"serverless" mode) — static reference, June 2026
export const AZURE_FILES_TYPES: StorageTypeInfo[] = [
  { id: "files-transaction-optimized", label: "Transaction Optimized (Standard, HDD-backed) — default", media: "HDD", usdPerGbMonth: 0.06 },
  { id: "files-hot", label: "Hot (Standard tier)", media: "HDD", usdPerGbMonth: 0.0255 },
  { id: "files-cool", label: "Cool (Standard tier, infrequent access)", media: "HDD", usdPerGbMonth: 0.015 },
  { id: "files-premium", label: "Premium (SSD-backed)", media: "SSD", usdPerGbMonth: 0.16 },
];

async function fetchAzurePrice(filter: string): Promise<number | null> {
  try {
    const url = `https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent(filter)}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.Items?.find((i: { type: string }) => i.type === "Consumption");
    return item ? item.retailPrice : (data.Items?.[0]?.retailPrice ?? null);
  } catch {
    return null;
  }
}

async function priceAzure(
  armRegionName: string,
  nodeCount: number,
  instanceType: string,
  computeMode: ComputeMode,
  storageGb: number,
  storageType: string
): Promise<CostEstimate> {
  const aksUptimeSlaPrice = await fetchAzurePrice(
    `armRegionName eq '${armRegionName}' and serviceName eq 'Azure Kubernetes Service' and priceType eq 'Consumption'`
  );
  const cpLive = aksUptimeSlaPrice !== null;
  const uptimeSlaHourly = aksUptimeSlaPrice ?? 0.1;
  const controlPlane = round2(uptimeSlaHourly * HOURS_PER_MONTH);
  const lb = 18.26;

  const items: CostLineItem[] = [
    { label: "AKS control plane (Standard/Uptime SLA tier)", monthlyUsd: controlPlane, note: `${cpLive ? "Live" : "Static fallback"} — $${uptimeSlaHourly.toFixed(4)}/hr × ${HOURS_PER_MONTH} hrs. The Free tier is $0/hr with no SLA.` },
  ];

  if (computeMode === "serverless") {
    const [vcpuPrice, memPrice] = await Promise.all([
      fetchAzurePrice(`armRegionName eq '${armRegionName}' and serviceName eq 'Container Instances' and meterName eq 'Standard vCPU Duration'`),
      fetchAzurePrice(`armRegionName eq '${armRegionName}' and serviceName eq 'Container Instances' and meterName eq 'Standard Memory Duration'`),
    ]);
    const aciLive = vcpuPrice !== null && memPrice !== null;
    const { vcpu, ramGb, label } = findServerless(instanceType);
    const perPodHourly = (vcpuPrice ?? 0.0405) * vcpu + (memPrice ?? 0.00445) * ramGb;
    const podsCost = round2(perPodHourly * HOURS_PER_MONTH * nodeCount);
    const fileStorage = AZURE_FILES_TYPES.find((s) => s.id === storageType) ?? AZURE_FILES_TYPES[0];
    const filesCost = round2(storageGb * fileStorage.usdPerGbMonth);

    items.push(
      { label: `${nodeCount}× ACI-backed Pod (${label}) via AKS Virtual Nodes`, monthlyUsd: podsCost, note: `${aciLive ? "Live from Azure Retail Prices API" : "Static fallback"} — billed per Pod's actual vCPU+memory, not per VM` },
      { label: `Azure Files — ${fileStorage.label} (${storageGb} GB)`, monthlyUsd: filesCost, note: `Static reference — $${fileStorage.usdPerGbMonth}/GB-month. Virtual Nodes Pods have no attached managed disk.` },
      { label: "Load balancer (Standard)", monthlyUsd: lb, note: "Static reference — base hourly + rule charges" }
    );
  } else {
    const vm = AZURE_VM_TYPES.find((v) => v.id === instanceType) ?? AZURE_VM_TYPES[3];
    const vmPrice = await fetchAzurePrice(
      `armRegionName eq '${armRegionName}' and armSkuName eq '${vm.id}' and priceType eq 'Consumption' and serviceName eq 'Virtual Machines'`
    );
    const vmLive = vmPrice !== null;
    const vmHourly = vmPrice ?? 0.096;
    const workers = round2(vmHourly * HOURS_PER_MONTH * nodeCount);
    const diskType = AZURE_DISK_TYPES.find((s) => s.id === storageType) ?? AZURE_DISK_TYPES[0];
    const disk = round2(nodeCount * storageGb * diskType.usdPerGbMonth);

    items.push(
      { label: `${nodeCount}× worker node (${vm.id})`, monthlyUsd: workers, note: `${vmLive ? "Live from Azure Retail Prices API" : "Static fallback"} — $${vmHourly.toFixed(4)}/hr × ${HOURS_PER_MONTH} hrs × ${nodeCount}` },
      { label: `Managed disks — ${diskType.label} (${storageGb} GB/node)`, monthlyUsd: disk, note: `Static reference — $${diskType.usdPerGbMonth}/GB-month (simplified; real Azure disk billing uses fixed size tiers)` },
      { label: "Load balancer (Standard)", monthlyUsd: lb, note: "Static reference — base hourly + rule charges" }
    );
  }

  return {
    cloud: computeMode === "serverless" ? "Azure AKS (Virtual Nodes / ACI)" : "Azure AKS (VM nodes)",
    source: cpLive ? "live" : "static",
    sourceLabel: cpLive
      ? "Fetched live from the Azure Retail Prices API (prices.azure.com) — no API key required"
      : "Azure pricing fetch failed — all figures are static references",
    asOf: new Date().toISOString().slice(0, 10),
    items,
    monthlyTotalUsd: round2(items.reduce((s, i) => s + i.monthlyUsd, 0)),
  };
}

// ---- GCP: no public unauthenticated pricing API exists — static reference ----

export const GCP_REGIONS: { value: string; label: string }[] = [
  { value: "us-central1", label: "us-central1 (Iowa)" },
  { value: "us-east1", label: "us-east1 (South Carolina)" },
  { value: "us-east4", label: "us-east4 (N. Virginia)" },
  { value: "us-east5", label: "us-east5 (Columbus)" },
  { value: "us-west1", label: "us-west1 (Oregon)" },
  { value: "us-west2", label: "us-west2 (Los Angeles)" },
  { value: "us-west3", label: "us-west3 (Salt Lake City)" },
  { value: "us-west4", label: "us-west4 (Las Vegas)" },
  { value: "us-south1", label: "us-south1 (Dallas)" },
  { value: "northamerica-northeast1", label: "northamerica-northeast1 (Montreal)" },
  { value: "northamerica-northeast2", label: "northamerica-northeast2 (Toronto)" },
  { value: "southamerica-east1", label: "southamerica-east1 (Sao Paulo)" },
  { value: "southamerica-west1", label: "southamerica-west1 (Santiago)" },
  { value: "europe-west1", label: "europe-west1 (Belgium)" },
  { value: "europe-west2", label: "europe-west2 (London)" },
  { value: "europe-west3", label: "europe-west3 (Frankfurt)" },
  { value: "europe-west4", label: "europe-west4 (Netherlands)" },
  { value: "europe-west6", label: "europe-west6 (Zurich)" },
  { value: "europe-west8", label: "europe-west8 (Milan)" },
  { value: "europe-west9", label: "europe-west9 (Paris)" },
  { value: "europe-central2", label: "europe-central2 (Warsaw)" },
  { value: "europe-north1", label: "europe-north1 (Finland)" },
  { value: "europe-southwest1", label: "europe-southwest1 (Madrid)" },
  { value: "asia-east1", label: "asia-east1 (Taiwan)" },
  { value: "asia-east2", label: "asia-east2 (Hong Kong)" },
  { value: "asia-northeast1", label: "asia-northeast1 (Tokyo)" },
  { value: "asia-northeast2", label: "asia-northeast2 (Osaka)" },
  { value: "asia-northeast3", label: "asia-northeast3 (Seoul)" },
  { value: "asia-south1", label: "asia-south1 (Mumbai)" },
  { value: "asia-south2", label: "asia-south2 (Delhi)" },
  { value: "asia-southeast1", label: "asia-southeast1 (Singapore)" },
  { value: "asia-southeast2", label: "asia-southeast2 (Jakarta)" },
  { value: "australia-southeast1", label: "australia-southeast1 (Sydney)" },
  { value: "australia-southeast2", label: "australia-southeast2 (Melbourne)" },
  { value: "me-central1", label: "me-central1 (Doha)" },
  { value: "me-west1", label: "me-west1 (Tel Aviv)" },
  { value: "africa-south1", label: "africa-south1 (Johannesburg)" },
];

// Static reference, on-demand, us-central1, June 2026 — no public unauthenticated
// GCP pricing endpoint exists at all, small or otherwise.
export const GCP_MACHINE_TYPES: InstanceTypeInfo[] = [
  { id: "e2-micro", label: "e2-micro — shared-core, general purpose", vcpu: 2, ramGb: 1, hourlyUsd: 0.0084 },
  { id: "e2-small", label: "e2-small — shared-core, general purpose", vcpu: 2, ramGb: 2, hourlyUsd: 0.0168 },
  { id: "e2-medium", label: "e2-medium — general purpose", vcpu: 2, ramGb: 4, hourlyUsd: 0.0335 },
  { id: "e2-standard-2", label: "e2-standard-2 — general purpose", vcpu: 2, ramGb: 8, hourlyUsd: 0.067 },
  { id: "e2-standard-4", label: "e2-standard-4 — general purpose", vcpu: 4, ramGb: 16, hourlyUsd: 0.134 },
  { id: "e2-standard-8", label: "e2-standard-8 — general purpose", vcpu: 8, ramGb: 32, hourlyUsd: 0.268 },
  { id: "n2-standard-2", label: "n2-standard-2 — general purpose", vcpu: 2, ramGb: 8, hourlyUsd: 0.0971 },
  { id: "n2-standard-4", label: "n2-standard-4 — general purpose", vcpu: 4, ramGb: 16, hourlyUsd: 0.1942 },
  { id: "n2-standard-8", label: "n2-standard-8 — general purpose", vcpu: 8, ramGb: 32, hourlyUsd: 0.3884 },
  { id: "c2-standard-4", label: "c2-standard-4 — compute optimized", vcpu: 4, ramGb: 16, hourlyUsd: 0.2088 },
  { id: "c2-standard-8", label: "c2-standard-8 — compute optimized", vcpu: 8, ramGb: 32, hourlyUsd: 0.4176 },
  { id: "n2-highmem-2", label: "n2-highmem-2 — memory optimized", vcpu: 2, ramGb: 16, hourlyUsd: 0.1310 },
  { id: "n2-highmem-4", label: "n2-highmem-4 — memory optimized", vcpu: 4, ramGb: 32, hourlyUsd: 0.2620 },
];

// Persistent Disks (used with Standard/"nodes" mode) — static reference, June 2026
export const GCP_DISK_TYPES: StorageTypeInfo[] = [
  { id: "pd-standard", label: "pd-standard — Standard HDD, cheapest", media: "HDD", usdPerGbMonth: 0.04 },
  { id: "pd-balanced", label: "pd-balanced — balanced SSD, recommended default", media: "SSD", usdPerGbMonth: 0.10 },
  { id: "pd-ssd", label: "pd-ssd — Performance SSD", media: "SSD", usdPerGbMonth: 0.17 },
  { id: "pd-extreme", label: "pd-extreme — highest performance, databases", media: "NVMe", usdPerGbMonth: 0.125 },
];

// Filestore (used with Autopilot/"serverless" mode) — static reference, June 2026
export const GCP_FILESTORE_TYPES: StorageTypeInfo[] = [
  { id: "filestore-basic-hdd", label: "Basic HDD — default, lowest cost", media: "HDD", usdPerGbMonth: 0.20 },
  { id: "filestore-basic-ssd", label: "Basic SSD — higher performance", media: "SSD", usdPerGbMonth: 0.30 },
  { id: "filestore-zonal", label: "Zonal — high scale, single zone", media: "SSD", usdPerGbMonth: 0.35 },
  { id: "filestore-enterprise", label: "Enterprise — multi-region, highest durability", media: "SSD", usdPerGbMonth: 0.60 },
];

// GKE Autopilot bills per Pod's requested vCPU/memory, reference rates (general-purpose compute class)
const GCP_AUTOPILOT_REFERENCE = { vcpuHourly: 0.0445, memHourly: 0.0049 };

function priceGcp(
  nodeCount: number,
  instanceType: string,
  computeMode: ComputeMode,
  storageGb: number,
  storageType: string
): CostEstimate {
  const controlPlane = 73.0; // GKE management fee, $0.10/hr/cluster beyond the one free zonal cluster — reference, June 2026
  const lb = 18.26;

  const items: CostLineItem[] = [
    { label: "GKE control plane", monthlyUsd: controlPlane, note: "Static reference — $0.10/hr per cluster (one zonal cluster/billing account is free); no public unauthenticated GCP pricing API exists to fetch this live" },
  ];

  if (computeMode === "serverless") {
    const { vcpu, ramGb, label } = findServerless(instanceType);
    const perPodHourly = GCP_AUTOPILOT_REFERENCE.vcpuHourly * vcpu + GCP_AUTOPILOT_REFERENCE.memHourly * ramGb;
    const podsCost = round2(perPodHourly * HOURS_PER_MONTH * nodeCount);
    const fileStorage = GCP_FILESTORE_TYPES.find((s) => s.id === storageType) ?? GCP_FILESTORE_TYPES[0];
    const filestore = round2(storageGb * fileStorage.usdPerGbMonth);

    items.push(
      { label: `${nodeCount}× Autopilot Pod (${label})`, monthlyUsd: podsCost, note: "Static reference — GKE Autopilot bills per Pod's requested vCPU+memory, general-purpose compute class" },
      { label: `Filestore — ${fileStorage.label} (${storageGb} GB)`, monthlyUsd: filestore, note: `Static reference — $${fileStorage.usdPerGbMonth}/GB-month. Autopilot Pods have no attached persistent disk.` },
      { label: "Load balancer (Network LB)", monthlyUsd: lb, note: "Static reference — forwarding rule + base charge" }
    );
  } else {
    const machine = GCP_MACHINE_TYPES.find((m) => m.id === instanceType) ?? GCP_MACHINE_TYPES[4];
    const workers = round2((machine.hourlyUsd ?? 0.134) * HOURS_PER_MONTH * nodeCount);
    const diskType = GCP_DISK_TYPES.find((s) => s.id === storageType) ?? GCP_DISK_TYPES[0];
    const disk = round2(nodeCount * storageGb * diskType.usdPerGbMonth);

    items.push(
      { label: `${nodeCount}× worker node (${machine.id})`, monthlyUsd: workers, note: `Static reference — $${machine.hourlyUsd}/hr on-demand × ${HOURS_PER_MONTH} hrs × ${nodeCount}` },
      { label: `Persistent disks — ${diskType.label} (${storageGb} GB/node)`, monthlyUsd: disk, note: `Static reference — $${diskType.usdPerGbMonth}/GB-month` },
      { label: "Load balancer (Network LB)", monthlyUsd: lb, note: "Static reference — forwarding rule + base charge" }
    );
  }

  return {
    cloud: computeMode === "serverless" ? "Google GKE (Autopilot)" : "Google GKE (Standard nodes)",
    source: "static",
    sourceLabel: "Static reference, verified against cloud.google.com/kubernetes-engine/pricing — GCP's Cloud Billing Catalog API requires an API key, so there is no live, credential-free source for this cloud",
    asOf: new Date().toISOString().slice(0, 10),
    items,
    monthlyTotalUsd: round2(items.reduce((s, i) => s + i.monthlyUsd, 0)),
  };
}

function priceOnPrem(nodeCount: number): CostEstimate {
  return {
    cloud: "On-Prem",
    source: "not-applicable",
    sourceLabel: "On-prem cost is CapEx (hardware, SAN, data-center power/cooling, licensing) plus internal labor — it has no hourly cloud rate, no pricing API, and no \"serverless\"/instance-type concept by definition",
    asOf: new Date().toISOString().slice(0, 10),
    items: [
      { label: `${nodeCount}× server (typical 2U rack server)`, monthlyUsd: 0, note: "One-time CapEx, commonly $4,000-$15,000/unit depending on CPU/RAM/disk — not a monthly figure" },
      { label: "Networking (switches, cabling)", monthlyUsd: 0, note: "One-time CapEx, highly site-specific" },
      { label: "Data-center power, cooling, rack space", monthlyUsd: 0, note: "Ongoing, but billed by your facility/colo provider, not a cloud API" },
      { label: "Platform engineer time (build + ongoing ops)", monthlyUsd: 0, note: "The real recurring cost of on-prem — staffing, not a metered rate" },
    ],
    monthlyTotalUsd: 0,
  };
}

export async function estimateMonthlyCost(opts: {
  cloud: "eks" | "aks" | "gke" | "onprem";
  region: string;
  nodeCount: number;
  instanceType: string;
  computeMode: ComputeMode;
  storageGb: number;
  storageType: string;
}): Promise<CostEstimate> {
  const nodeCount = Math.max(1, Math.min(20, opts.nodeCount));
  const storageGb = Math.max(1, Math.min(2000, opts.storageGb));
  switch (opts.cloud) {
    case "eks":
      return priceAws(opts.region, nodeCount, opts.instanceType, opts.computeMode, storageGb, opts.storageType);
    case "aks":
      return priceAzure(opts.region, nodeCount, opts.instanceType, opts.computeMode, storageGb, opts.storageType);
    case "gke":
      return priceGcp(nodeCount, opts.instanceType, opts.computeMode, storageGb, opts.storageType);
    case "onprem":
      return priceOnPrem(nodeCount);
  }
}

export function getStorageTypesFor(cloud: "eks" | "aks" | "gke" | "onprem", computeMode: ComputeMode): StorageTypeInfo[] {
  if (cloud === "onprem") return [];
  if (cloud === "eks") return computeMode === "serverless" ? AWS_FILE_STORAGE_TYPES : AWS_BLOCK_STORAGE_TYPES;
  if (cloud === "aks") return computeMode === "serverless" ? AZURE_FILES_TYPES : AZURE_DISK_TYPES;
  return computeMode === "serverless" ? GCP_FILESTORE_TYPES : GCP_DISK_TYPES;
}

// ===================================================================================
// Cross-cloud region mapping — maps one cloud's region to the nearest geographic
// equivalents on the other two clouds so the comparison table always shows all 3.
// ===================================================================================

export interface CrossCloudRegions {
  awsRegion: string;  awsLabel: string;
  azureRegion: string; azureLabel: string;
  gcpRegion: string;  gcpLabel: string;
}

const REGION_TRIPLETS: CrossCloudRegions[] = [
  // North America — United States
  { awsRegion: "us-east-1",      awsLabel: "US East (N. Virginia)",     azureRegion: "eastus",             azureLabel: "East US",                    gcpRegion: "us-east1",              gcpLabel: "US East (South Carolina)" },
  { awsRegion: "us-east-2",      awsLabel: "US East (Ohio)",            azureRegion: "eastus2",            azureLabel: "East US 2",                  gcpRegion: "us-east4",              gcpLabel: "US East (N. Virginia)" },
  { awsRegion: "us-west-1",      awsLabel: "US West (N. California)",   azureRegion: "westus",             azureLabel: "West US",                    gcpRegion: "us-west2",              gcpLabel: "US West (Los Angeles)" },
  { awsRegion: "us-west-2",      awsLabel: "US West (Oregon)",          azureRegion: "westus2",            azureLabel: "West US 2 (Washington)",     gcpRegion: "us-west1",              gcpLabel: "US West (Oregon)" },
  // North America — Canada
  { awsRegion: "ca-central-1",   awsLabel: "Canada (Central)",          azureRegion: "canadacentral",      azureLabel: "Canada Central",             gcpRegion: "northamerica-northeast1", gcpLabel: "Montréal" },
  { awsRegion: "ca-west-1",      awsLabel: "Canada West (Calgary)",     azureRegion: "canadawest",         azureLabel: "Canada West",                gcpRegion: "northamerica-northeast2", gcpLabel: "Toronto" },
  // South America
  { awsRegion: "sa-east-1",      awsLabel: "South America (São Paulo)", azureRegion: "brazilsouth",        azureLabel: "Brazil South",               gcpRegion: "southamerica-east1",    gcpLabel: "São Paulo" },
  // Europe
  { awsRegion: "eu-west-1",      awsLabel: "EU (Ireland)",              azureRegion: "northeurope",        azureLabel: "North Europe (Ireland)",     gcpRegion: "europe-west1",          gcpLabel: "Belgium" },
  { awsRegion: "eu-west-2",      awsLabel: "EU (London)",               azureRegion: "uksouth",            azureLabel: "UK South (London)",          gcpRegion: "europe-west2",          gcpLabel: "London" },
  { awsRegion: "eu-west-3",      awsLabel: "EU (Paris)",                azureRegion: "francecentral",      azureLabel: "France Central",             gcpRegion: "europe-west9",          gcpLabel: "Paris" },
  { awsRegion: "eu-central-1",   awsLabel: "EU (Frankfurt)",            azureRegion: "germanywestcentral", azureLabel: "Germany West Central",       gcpRegion: "europe-west3",          gcpLabel: "Frankfurt" },
  { awsRegion: "eu-central-2",   awsLabel: "EU (Zurich)",               azureRegion: "switzerlandnorth",   azureLabel: "Switzerland North",          gcpRegion: "europe-west6",          gcpLabel: "Zürich" },
  { awsRegion: "eu-north-1",     awsLabel: "EU (Stockholm)",            azureRegion: "swedencentral",      azureLabel: "Sweden Central",             gcpRegion: "europe-north1",         gcpLabel: "Finland" },
  { awsRegion: "eu-south-1",     awsLabel: "EU (Milan)",                azureRegion: "italynorth",         azureLabel: "Italy North",                gcpRegion: "europe-west8",          gcpLabel: "Milan" },
  { awsRegion: "eu-south-2",     awsLabel: "EU (Spain)",                azureRegion: "spaincentral",       azureLabel: "Spain Central",              gcpRegion: "europe-southwest1",     gcpLabel: "Madrid" },
  // Asia Pacific
  { awsRegion: "ap-east-1",      awsLabel: "Asia Pacific (Hong Kong)",  azureRegion: "eastasia",           azureLabel: "East Asia (Hong Kong)",      gcpRegion: "asia-east2",            gcpLabel: "Hong Kong" },
  { awsRegion: "ap-southeast-1", awsLabel: "Asia Pacific (Singapore)",  azureRegion: "southeastasia",      azureLabel: "Southeast Asia (Singapore)", gcpRegion: "asia-southeast1",       gcpLabel: "Singapore" },
  { awsRegion: "ap-southeast-2", awsLabel: "Asia Pacific (Sydney)",     azureRegion: "australiaeast",      azureLabel: "Australia East",             gcpRegion: "australia-southeast1",  gcpLabel: "Sydney" },
  { awsRegion: "ap-southeast-3", awsLabel: "Asia Pacific (Jakarta)",    azureRegion: "indonesiacentral",   azureLabel: "Indonesia Central",          gcpRegion: "asia-southeast2",       gcpLabel: "Jakarta" },
  { awsRegion: "ap-southeast-4", awsLabel: "Asia Pacific (Melbourne)",  azureRegion: "australiasoutheast", azureLabel: "Australia Southeast",        gcpRegion: "australia-southeast2",  gcpLabel: "Melbourne" },
  { awsRegion: "ap-northeast-1", awsLabel: "Asia Pacific (Tokyo)",      azureRegion: "japaneast",          azureLabel: "Japan East",                 gcpRegion: "asia-northeast1",       gcpLabel: "Tokyo" },
  { awsRegion: "ap-northeast-2", awsLabel: "Asia Pacific (Seoul)",      azureRegion: "koreacentral",       azureLabel: "Korea Central",              gcpRegion: "asia-northeast3",       gcpLabel: "Seoul" },
  { awsRegion: "ap-northeast-3", awsLabel: "Asia Pacific (Osaka)",      azureRegion: "japanwest",          azureLabel: "Japan West",                 gcpRegion: "asia-northeast2",       gcpLabel: "Osaka" },
  { awsRegion: "ap-south-1",     awsLabel: "Asia Pacific (Mumbai)",     azureRegion: "centralindia",       azureLabel: "Central India",              gcpRegion: "asia-south1",           gcpLabel: "Mumbai" },
  { awsRegion: "ap-south-2",     awsLabel: "Asia Pacific (Hyderabad)",  azureRegion: "southindia",         azureLabel: "South India",                gcpRegion: "asia-south2",           gcpLabel: "Delhi" },
  // Middle East
  { awsRegion: "me-south-1",     awsLabel: "Middle East (Bahrain)",     azureRegion: "uaenorth",           azureLabel: "UAE North",                  gcpRegion: "me-west1",              gcpLabel: "Tel Aviv" },
  { awsRegion: "me-central-1",   awsLabel: "Middle East (UAE)",         azureRegion: "uaenorth",           azureLabel: "UAE North",                  gcpRegion: "me-central1",           gcpLabel: "Doha" },
  { awsRegion: "il-central-1",   awsLabel: "Israel (Tel Aviv)",         azureRegion: "israelcentral",      azureLabel: "Israel Central",             gcpRegion: "me-west1",              gcpLabel: "Tel Aviv" },
  // Africa
  { awsRegion: "af-south-1",     awsLabel: "Africa (Cape Town)",        azureRegion: "southafricanorth",   azureLabel: "South Africa North",         gcpRegion: "africa-south1",         gcpLabel: "Johannesburg" },
  // China (GCP has no China presence; nearest is Taiwan)
  { awsRegion: "cn-north-1",     awsLabel: "China (Beijing)",           azureRegion: "chinanorth",         azureLabel: "China North",                gcpRegion: "asia-east1",            gcpLabel: "Taiwan (nearest)" },
  { awsRegion: "cn-northwest-1", awsLabel: "China (Ningxia)",           azureRegion: "chinanorth2",        azureLabel: "China North 2",              gcpRegion: "asia-east1",            gcpLabel: "Taiwan (nearest)" },
];

export function getRegionTriplet(cloud: CloudId, region: string): CrossCloudRegions {
  const field = cloud === "eks" ? "awsRegion" : cloud === "aks" ? "azureRegion" : "gcpRegion";
  const exact = REGION_TRIPLETS.find((t) => t[field] === region);
  if (exact) return exact;
  // Geo-prefix fallback: aws/gcp use hyphenated prefixes; azure uses concatenated words
  const geoPrefix =
    cloud === "eks" || cloud === "gke"
      ? region.split("-")[0]
      : region.replace(/[0-9]+$/, "").slice(0, 5);
  const approx = REGION_TRIPLETS.find((t) => (t[field] as string).startsWith(geoPrefix));
  return approx ?? REGION_TRIPLETS[0]; // ultimate fallback: us-east-1
}

export function getServiceLabel(cloud: CloudId, service: ServiceId): string {
  return SERVICE_LABELS[cloud][service].label;
}

// ===================================================================================
// Per-service price explorer — for the standalone /costing page, where each cloud
// service is priced individually rather than bundled into one whole-cluster estimate.
// ===================================================================================

export type CloudId = "eks" | "aks" | "gke";
export type ServiceId =
  | "control-plane"
  | "vm-instance"
  | "serverless-compute"
  | "block-storage"
  | "file-storage"
  | "load-balancer"
  | "app-load-balancer"
  | "registry"
  | "nat-gateway"
  | "dns"
  | "secrets-manager"
  | "monitoring-logging"
  | "backup"
  | "vpc"
  | "object-storage"
  | "managed-database"
  | "elastic-ip"
  | "data-transfer"
  | "cdn"
  | "cache"
  | "snapshot"
  | "message-queue"
  | "functions"
  | "api-gateway"
  | "vpn-gateway"
  | "waf"
  | "event-bus"
  | "internet-gateway"
  | "public-subnet"
  | "private-subnet"
  | "security-group"
  | "nacl"
  | "route-table"
  | "bastion-host"
  | "acm";

export interface ServiceDef {
  id: ServiceId;
  label: string;
  desc: string;
  needsInstanceType: boolean;
  needsStorageType: boolean;
  needsStorageGb: boolean;
}

export interface ServicePriceResult {
  service: string;
  hourlyUsd: number | null;
  monthlyUsd: number;
  source: CostSource;
  note: string;
  asOf: string;
}

const SERVICE_LABELS: Record<CloudId, Record<ServiceId, { label: string; desc: string }>> = {
  eks: {
    "control-plane": { label: "EKS Control Plane", desc: "The managed Kubernetes API server, etcd, and scheduler — one fixed fee per cluster" },
    "vm-instance": { label: "EC2 Instance (worker node)", desc: "A self-managed virtual machine running kubelet + your Pods" },
    "serverless-compute": { label: "Fargate (serverless Pod)", desc: "AWS runs the Pod for you — billed per vCPU/memory request, no instance to manage" },
    "block-storage": { label: "EBS Volume", desc: "Block storage attached to exactly one worker node at a time" },
    "file-storage": { label: "EFS File System", desc: "NFS-based storage mountable by many Pods/nodes simultaneously" },
    "load-balancer": { label: "Network Load Balancer", desc: "Routes external traffic into your cluster's Services" },
    registry: { label: "ECR (Elastic Container Registry)", desc: "Stores your container images" },
    "nat-gateway": { label: "NAT Gateway", desc: "Lets Pods in private subnets reach the internet outbound, without being reachable inbound" },
    dns: { label: "Route 53 (Hosted Zone)", desc: "DNS for your cluster's public-facing domain names" },
    "secrets-manager": { label: "AWS Secrets Manager", desc: "Stores and rotates database credentials/API keys your Pods mount as Secrets" },
    "monitoring-logging": { label: "CloudWatch (Logs + Metrics)", desc: "Cluster/Pod logs and metrics ingestion and storage" },
    backup: { label: "AWS Backup", desc: "Scheduled, managed backups of your EBS volumes/EFS file systems" },
    vpc: { label: "VPC (Virtual Private Cloud)", desc: "Isolated network for your AWS resources — free to create; optional endpoints/peering add cost" },
    "object-storage": { label: "S3 (Object Storage)", desc: "Scalable object storage for backups, logs, static assets, and container layer caches" },
    "managed-database": { label: "RDS (Managed Database)", desc: "Managed relational DB (PostgreSQL/MySQL/MariaDB) — reference rate for a db.t3.medium Multi-AZ instance" },
    "app-load-balancer": { label: "Application Load Balancer (ALB)", desc: "Layer-7 HTTP/HTTPS load balancer with path/host routing, SSL termination, and WAF support" },
    "elastic-ip": { label: "Elastic IP Address", desc: "Static public IPv4 address — free while attached to a running instance; charged per unused IP and per additional in-use IP" },
    "data-transfer": { label: "Data Transfer Out (Egress)", desc: "Outbound internet bandwidth from AWS — the most commonly forgotten line-item in cloud bills" },
    cdn: { label: "CloudFront (CDN)", desc: "Content Delivery Network — caches static assets at edge PoPs to reduce origin load and egress costs" },
    cache: { label: "ElastiCache for Redis", desc: "Managed in-memory cache — reference rate for a cache.t3.micro single-node cluster" },
    snapshot: { label: "EBS Snapshot", desc: "Point-in-time incremental backup of an EBS volume stored in S3 — priced per GB-month" },
    "message-queue": { label: "SQS (Simple Queue Service)", desc: "Managed message queue — first 1M requests/month free; reference for 10M standard requests" },
    functions: { label: "Lambda (Serverless Functions)", desc: "Event-driven compute — billed per invocation + GB-second of memory; first 1M invocations/month free" },
    "api-gateway": { label: "API Gateway (HTTP API)", desc: "Managed API front door — priced per million HTTP API calls; REST API is ~3.5× more expensive" },
    "vpn-gateway": { label: "Site-to-Site VPN", desc: "Encrypted IPsec tunnel from your data center or office to AWS — priced per VPN connection-hour" },
    waf: { label: "AWS WAF", desc: "Web Application Firewall — blocks SQLi, XSS, bad bots; priced per web ACL + per million requests inspected" },
    "event-bus": { label: "Amazon EventBridge", desc: "Serverless event bus for decoupling microservices — routes events from AWS services, SaaS apps, and custom sources to targets" },
    "internet-gateway": { label: "Internet Gateway (IGW)", desc: "Connects your VPC to the internet — required for any public-facing resource; the IGW itself is free, but data transfer through it is charged separately" },
    "public-subnet": { label: "Public Subnet", desc: "A VPC subnet with a route to the Internet Gateway — resources here can have public IPs (NAT Gateway, ALB, Bastion hosts sit here)" },
    "private-subnet": { label: "Private Subnet", desc: "A VPC subnet with no direct internet route — resources access internet only via NAT Gateway; app servers and databases live here" },
    "security-group": { label: "Security Group", desc: "Stateful virtual firewall attached to EC2, RDS, Lambda, etc. — controls inbound/outbound traffic at the resource level; free to create and use" },
    "nacl": { label: "Network ACL (NACL)", desc: "Stateless subnet-level firewall — evaluated before Security Groups; numbered rules evaluated in order; free to create and configure" },
    "route-table": { label: "Route Table", desc: "Controls traffic routing per subnet — routes to IGW (public), NAT GW (private), VPC peering, etc.; free to create" },
    "bastion-host": { label: "Bastion Host (EC2 t3.micro)", desc: "Jump server in the public subnet for SSH/RDP access to private instances — reference: t3.micro; recommended: use AWS Systems Manager Session Manager for keyless access" },
    "acm": { label: "ACM (SSL/TLS Certificate)", desc: "Free public SSL/TLS certificates for ALB, CloudFront, and API Gateway — issued automatically and auto-renewed; private CA ($400/month) is separate" },
  },
  aks: {
    "control-plane": { label: "AKS Control Plane", desc: "The managed Kubernetes API server — Free tier ($0) or Standard/Uptime SLA tier" },
    "vm-instance": { label: "Azure VM (worker node)", desc: "A self-managed virtual machine running kubelet + your Pods" },
    "serverless-compute": { label: "ACI via Virtual Nodes (serverless Pod)", desc: "Azure runs the Pod for you on Container Instances — billed per vCPU/memory" },
    "block-storage": { label: "Managed Disk", desc: "Block storage attached to exactly one worker node at a time" },
    "file-storage": { label: "Azure Files", desc: "SMB/NFS-based storage mountable by many Pods/nodes simultaneously" },
    "load-balancer": { label: "Standard Load Balancer", desc: "Routes external traffic into your cluster's Services" },
    registry: { label: "ACR (Azure Container Registry)", desc: "Stores your container images" },
    "nat-gateway": { label: "NAT Gateway", desc: "Lets Pods in private subnets reach the internet outbound, without being reachable inbound" },
    dns: { label: "Azure DNS (Hosted Zone)", desc: "DNS for your cluster's public-facing domain names" },
    "secrets-manager": { label: "Azure Key Vault", desc: "Stores and rotates database credentials/API keys your Pods mount as Secrets" },
    "monitoring-logging": { label: "Azure Monitor (Logs + Metrics)", desc: "Cluster/Pod logs and metrics ingestion and storage" },
    backup: { label: "Azure Backup", desc: "Scheduled, managed backups of your Managed Disks/Azure Files shares" },
    vpc: { label: "Virtual Network (VNet)", desc: "Isolated network for your Azure resources — free to create; optional private endpoints/peering add cost" },
    "object-storage": { label: "Azure Blob Storage", desc: "Scalable object storage for backups, logs, static assets, and container layer caches" },
    "managed-database": { label: "Azure Database for PostgreSQL / MySQL", desc: "Managed relational DB — reference rate for a General Purpose 2-vCore Flexible Server" },
    "app-load-balancer": { label: "Application Gateway (Layer-7 LB)", desc: "Layer-7 HTTP/HTTPS load balancer with path/host routing, SSL termination, and WAF support" },
    "elastic-ip": { label: "Static Public IP Address", desc: "Reserved static IPv4 — Standard SKU charged per hour whether attached or not" },
    "data-transfer": { label: "Bandwidth Out (Egress)", desc: "Outbound internet bandwidth from Azure — first 5 GB/month free; one of the biggest surprise charges" },
    cdn: { label: "Azure CDN (Standard Microsoft)", desc: "Content Delivery Network — caches assets at global PoPs; priced per GB of data delivered" },
    cache: { label: "Azure Cache for Redis (Basic C0)", desc: "Managed in-memory cache — Basic C0 (250 MB) reference rate; Standard/Premium tiers add replication" },
    snapshot: { label: "Managed Disk Snapshot (LRS)", desc: "Point-in-time full snapshot of a Managed Disk stored as LRS — priced per GB-month" },
    "message-queue": { label: "Azure Service Bus (Standard)", desc: "Managed message broker with queues and topics — Standard tier includes 12.5M operations/month" },
    functions: { label: "Azure Functions (Consumption)", desc: "Event-driven serverless compute — first 1M executions free/month; billed per invocation + GB-second" },
    "api-gateway": { label: "Azure API Management (Consumption)", desc: "Managed API gateway — Consumption tier billed per million API calls; no base fee" },
    "vpn-gateway": { label: "VPN Gateway (Basic)", desc: "Encrypted IPsec/IKE tunnel from on-premises to Azure VNet — Basic SKU reference rate" },
    waf: { label: "Azure WAF (via Application Gateway)", desc: "Web Application Firewall — WAF_v2 SKU adds OWASP rule sets on top of Application Gateway" },
    "event-bus": { label: "Azure Event Grid", desc: "Fully managed event-routing service — routes events from Azure services and custom sources to handlers; priced per million operations" },
    "internet-gateway": { label: "VNet Internet Access", desc: "Azure VNets have built-in internet access via default system routes — no separate IGW resource needed; outbound flows through Azure's backbone for free" },
    "public-subnet": { label: "Public Subnet (VNet)", desc: "A VNet subnet where resources can be assigned public IPs — Application Gateway, public Load Balancers, and Azure Bastion reside here" },
    "private-subnet": { label: "Private Subnet (VNet)", desc: "A VNet subnet with no public IPs — AKS nodes, VMs, and databases reside here; outbound internet routed via NAT Gateway" },
    "security-group": { label: "Network Security Group (NSG)", desc: "Stateful traffic filter attached to subnets or NICs — controls inbound/outbound rules by port, protocol, and source/destination IP; free" },
    "nacl": { label: "NSG (Subnet-level)", desc: "Azure NSGs applied at the subnet level act similarly to AWS NACLs — stateful rules on the subnet boundary; free" },
    "route-table": { label: "Azure Route Table (UDR)", desc: "User-Defined Routes — override Azure's default system routes per subnet to force traffic through NVAs or VPN gateways; free to create" },
    "bastion-host": { label: "Azure Bastion (Basic)", desc: "Managed PaaS jump service for browser-based RDP/SSH to VMs without exposing public IPs — Basic SKU reference rate" },
    "acm": { label: "Azure Key Vault (TLS Certs)", desc: "Stores and auto-renews SSL/TLS certificates; integrates with App Gateway and Front Door for termination — priced per 10K certificate operations" },
  },
  gke: {
    "control-plane": { label: "GKE Control Plane", desc: "The managed Kubernetes API server — one free zonal cluster per billing account, then a flat fee" },
    "vm-instance": { label: "GCE Instance (worker node)", desc: "A self-managed virtual machine running kubelet + your Pods" },
    "serverless-compute": { label: "Autopilot (serverless Pod)", desc: "GKE runs the Pod for you — billed per vCPU/memory request, no node to manage" },
    "block-storage": { label: "Persistent Disk", desc: "Block storage attached to exactly one worker node at a time" },
    "file-storage": { label: "Filestore", desc: "NFS-based storage mountable by many Pods/nodes simultaneously" },
    "load-balancer": { label: "Network Load Balancer", desc: "Routes external traffic into your cluster's Services" },
    registry: { label: "Artifact Registry", desc: "Stores your container images" },
    "nat-gateway": { label: "Cloud NAT", desc: "Lets Pods in private subnets reach the internet outbound, without being reachable inbound" },
    dns: { label: "Cloud DNS (Hosted Zone)", desc: "DNS for your cluster's public-facing domain names" },
    "secrets-manager": { label: "Secret Manager", desc: "Stores and rotates database credentials/API keys your Pods mount as Secrets" },
    "monitoring-logging": { label: "Cloud Monitoring + Logging", desc: "Cluster/Pod logs and metrics ingestion and storage" },
    backup: { label: "Backup for GKE", desc: "Scheduled, managed backups of your Persistent Disks/Filestore instances" },
    vpc: { label: "VPC Network", desc: "Isolated network for your GCP resources — free to create; optional private service access/peering add cost" },
    "object-storage": { label: "Cloud Storage (GCS)", desc: "Scalable object storage for backups, logs, static assets, and container layer caches" },
    "managed-database": { label: "Cloud SQL (Managed Database)", desc: "Managed relational DB (PostgreSQL/MySQL) — reference rate for a db-custom-2-4096 (2 vCPU, 4 GB) instance" },
    "app-load-balancer": { label: "HTTP(S) Load Balancer", desc: "Layer-7 HTTP/HTTPS load balancer with path/host routing, SSL termination, and Cloud Armor WAF support" },
    "elastic-ip": { label: "External Static IP Address", desc: "Reserved static external IPv4 — charged per hour whether in-use or not; in-use rate is lower than reserved-unused" },
    "data-transfer": { label: "Network Egress (Internet)", desc: "Outbound internet bandwidth from GCP — rates vary by destination; Americas/Europe cheapest at ~$0.08/GB" },
    cdn: { label: "Cloud CDN", desc: "Content Delivery Network — caches assets at Google's global edge; priced per GB of cache egress" },
    cache: { label: "Memorystore for Redis (Basic 1 GB)", desc: "Managed in-memory cache — Basic tier 1 GB reference rate; Standard adds HA replication" },
    snapshot: { label: "Persistent Disk Snapshot", desc: "Incremental point-in-time snapshot of a Persistent Disk stored in Cloud Storage — priced per GB-month" },
    "message-queue": { label: "Cloud Pub/Sub", desc: "Managed message streaming — first 10 GB/month free; priced per GB of message data throughput" },
    functions: { label: "Cloud Functions (Gen 2)", desc: "Event-driven serverless compute — first 2M invocations free/month; billed per invocation + GHz-second" },
    "api-gateway": { label: "Cloud API Gateway", desc: "Managed API gateway backed by Cloud Endpoints — first 2M calls/month free; $3/million thereafter" },
    "vpn-gateway": { label: "Cloud VPN (HA VPN)", desc: "Encrypted IPsec tunnel from on-premises to GCP VPC — priced per tunnel-hour" },
    waf: { label: "Cloud Armor (WAF)", desc: "DDoS protection and WAF — security policy fee plus per-million-requests charge; Bot Management is extra" },
    "event-bus": { label: "Cloud Eventarc", desc: "Managed event-routing service — routes events from GCP services and custom HTTP sources to Cloud Run / Cloud Functions / GKE" },
    "internet-gateway": { label: "Cloud Router", desc: "Enables dynamic BGP routing for VPC — used with Cloud NAT and Cloud VPN; Cloud Router itself is free; BGP sessions and data processing charged separately" },
    "public-subnet": { label: "Subnet (public)", desc: "A GCP subnet whose VMs can have external IPs — Cloud NAT is typically paired for controlled outbound; subnets are free to create" },
    "private-subnet": { label: "Subnet (private)", desc: "A GCP subnet with Private Google Access enabled — VMs have internal IPs only and reach Google APIs via private routes; free to create" },
    "security-group": { label: "VPC Firewall Rule", desc: "Stateless firewall rule applied at the VPC level — controls ingress/egress by protocol, port, and network tag or service account; free" },
    "nacl": { label: "VPC Firewall Policy", desc: "Hierarchical firewall policies applied at the network or folder level — evaluated before VPC Firewall Rules; free" },
    "route-table": { label: "VPC Route", desc: "Custom static routes in a VPC routing table — override dynamic routes or direct traffic to specific next-hops (Cloud VPN, NVA, etc.); free" },
    "bastion-host": { label: "Bastion VM (GCE f1-micro)", desc: "Jump host VM in public subnet for SSH tunneling to private GCE instances — GCP recommends Identity-Aware Proxy (IAP) tunneling instead, which is free" },
    "acm": { label: "Certificate Manager", desc: "Google-managed TLS certificates for Cloud Load Balancing — Google-managed certificates are free; Certificate Authority Service is $3/month per CA" },
  },
};

export function getServicesFor(cloud: CloudId): ServiceDef[] {
  const labels = SERVICE_LABELS[cloud];
  return (Object.keys(labels) as ServiceId[]).map((id) => ({
    id,
    label: labels[id].label,
    desc: labels[id].desc,
    needsInstanceType: id === "vm-instance" || id === "serverless-compute",
    needsStorageType: id === "block-storage" || id === "file-storage",
    needsStorageGb:
      id === "block-storage" || id === "file-storage" || id === "registry" ||
      id === "monitoring-logging" || id === "backup" || id === "object-storage" ||
      id === "data-transfer" || id === "cdn" || id === "snapshot" ||
      id === "functions" || id === "api-gateway" || id === "event-bus",
  }));
}

export async function getServicePrice(opts: {
  cloud: CloudId;
  service: ServiceId;
  region: string;
  instanceType?: string;
  storageType?: string;
  storageGb?: number;
}): Promise<ServicePriceResult> {
  const { cloud, service, region } = opts;
  const asOf = new Date().toISOString().slice(0, 10);
  const label = SERVICE_LABELS[cloud][service].label;
  const storageGb = Math.max(1, Math.min(1_000_000, opts.storageGb ?? 20));

  if (service === "control-plane") {
    if (cloud === "eks") {
      const hourly = await fetchAwsBulkSkuPrice("AmazonEKS", region, (u) => u.endsWith("AmazonEKS-Hours:perCluster"));
      const live = hourly !== null;
      const h = hourly ?? 0.1;
      return { service: label, hourlyUsd: h, monthlyUsd: round2(h * HOURS_PER_MONTH), source: live ? "live-cached" : "static", note: live ? "Live (24h-cached) from AWS's public Price List API" : "Static fallback — AWS fetch failed", asOf };
    }
    if (cloud === "aks") {
      const price = await fetchAzurePrice(`armRegionName eq '${region}' and serviceName eq 'Azure Kubernetes Service' and priceType eq 'Consumption'`);
      const live = price !== null;
      const h = price ?? 0.1;
      return { service: label, hourlyUsd: h, monthlyUsd: round2(h * HOURS_PER_MONTH), source: live ? "live" : "static", note: live ? "Live from the Azure Retail Prices API (Standard/Uptime SLA tier — Free tier is $0/hr with no SLA)" : "Static fallback — Azure fetch failed", asOf };
    }
    return { service: label, hourlyUsd: 0.1, monthlyUsd: 73.0, source: "static", note: "Static reference — $0.10/hr per cluster; one free zonal cluster per billing account; no public unauthenticated GCP pricing API exists", asOf };
  }

  if (service === "vm-instance") {
    if (cloud === "eks") {
      const inst = findAwsInstance(opts.instanceType ?? "");
      return { service: `${label} (${inst.id})`, hourlyUsd: inst.hourlyUsd ?? null, monthlyUsd: round2((inst.hourlyUsd ?? 0.0832) * HOURS_PER_MONTH), source: "static", note: "Static reference — no small public AWS endpoint exists for per-instance EC2 pricing", asOf };
    }
    if (cloud === "aks") {
      const vm = AZURE_VM_TYPES.find((v) => v.id === opts.instanceType) ?? AZURE_VM_TYPES[3];
      const price = await fetchAzurePrice(`armRegionName eq '${region}' and armSkuName eq '${vm.id}' and priceType eq 'Consumption' and serviceName eq 'Virtual Machines'`);
      const live = price !== null;
      const h = price ?? 0.096;
      return { service: `${label} (${vm.id})`, hourlyUsd: h, monthlyUsd: round2(h * HOURS_PER_MONTH), source: live ? "live" : "static", note: live ? "Live from the Azure Retail Prices API" : "Static fallback — Azure fetch failed", asOf };
    }
    const machine = GCP_MACHINE_TYPES.find((m) => m.id === opts.instanceType) ?? GCP_MACHINE_TYPES[4];
    return { service: `${label} (${machine.id})`, hourlyUsd: machine.hourlyUsd ?? null, monthlyUsd: round2((machine.hourlyUsd ?? 0.134) * HOURS_PER_MONTH), source: "static", note: "Static reference — no public unauthenticated GCP pricing API exists", asOf };
  }

  if (service === "serverless-compute") {
    const { vcpu, ramGb, label: sizeLabel } = findServerless(opts.instanceType ?? "");
    if (cloud === "eks") {
      const [vcpuHourly, gbHourly] = await Promise.all([
        fetchAwsBulkSkuPrice("AmazonECS", region, (u) => u.endsWith("Fargate-vCPU-Hours:perCPU") && !u.includes("Windows") && !u.includes("ARM")),
        fetchAwsBulkSkuPrice("AmazonECS", region, (u) => u.endsWith("Fargate-GB-Hours") && !u.includes("Windows") && !u.includes("ARM")),
      ]);
      const live = vcpuHourly !== null && gbHourly !== null;
      const h = (vcpuHourly ?? 0.04048) * vcpu + (gbHourly ?? 0.004445) * ramGb;
      return { service: `${label} (${sizeLabel})`, hourlyUsd: h, monthlyUsd: round2(h * HOURS_PER_MONTH), source: live ? "live-cached" : "static", note: live ? "Live (24h-cached) from AWS's public Price List API" : "Static fallback — AWS fetch failed", asOf };
    }
    if (cloud === "aks") {
      const [vcpuPrice, memPrice] = await Promise.all([
        fetchAzurePrice(`armRegionName eq '${region}' and serviceName eq 'Container Instances' and meterName eq 'Standard vCPU Duration'`),
        fetchAzurePrice(`armRegionName eq '${region}' and serviceName eq 'Container Instances' and meterName eq 'Standard Memory Duration'`),
      ]);
      const live = vcpuPrice !== null && memPrice !== null;
      const h = (vcpuPrice ?? 0.0405) * vcpu + (memPrice ?? 0.00445) * ramGb;
      return { service: `${label} (${sizeLabel})`, hourlyUsd: h, monthlyUsd: round2(h * HOURS_PER_MONTH), source: live ? "live" : "static", note: live ? "Live from the Azure Retail Prices API" : "Static fallback — Azure fetch failed", asOf };
    }
    const h = GCP_AUTOPILOT_REFERENCE.vcpuHourly * vcpu + GCP_AUTOPILOT_REFERENCE.memHourly * ramGb;
    return { service: `${label} (${sizeLabel})`, hourlyUsd: h, monthlyUsd: round2(h * HOURS_PER_MONTH), source: "static", note: "Static reference — GKE Autopilot bills per Pod's requested vCPU+memory", asOf };
  }

  if (service === "block-storage" || service === "file-storage") {
    const cloudKey = cloud === "eks" ? "eks" : cloud === "aks" ? "aks" : "gke";
    const mode: ComputeMode = service === "file-storage" ? "serverless" : "nodes";
    const types = getStorageTypesFor(cloudKey, mode);
    const t = types.find((s) => s.id === opts.storageType) ?? types[0];
    const monthly = round2(storageGb * t.usdPerGbMonth);
    return { service: `${t.label} (${storageGb} GB)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note: `Static reference — $${t.usdPerGbMonth}/GB-month`, asOf };
  }

  if (service === "load-balancer") {
    const flat = cloud === "eks" ? 16.2 : 18.26;
    return { service: label, hourlyUsd: round2(flat / HOURS_PER_MONTH), monthlyUsd: flat, source: "static", note: "Static reference — base hourly charge only; excludes per-GB/per-rule data processing charges", asOf };
  }

  if (service === "registry") {
    const perGb = 0.10;
    const freeNote = cloud === "eks" ? "first 500MB/month free (private repos)" : cloud === "aks" ? "Basic tier includes 10GB" : "no free tier";
    const monthly = round2(storageGb * perGb);
    return { service: `${label} (${storageGb} GB stored)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note: `Static reference — ~$${perGb}/GB-month for image storage (${freeNote}); excludes data transfer`, asOf };
  }

  if (service === "nat-gateway") {
    const hourly = 0.045; // AWS/Azure/GCP NAT reference rate is nearly identical, June 2026
    return { service: label, hourlyUsd: hourly, monthlyUsd: round2(hourly * HOURS_PER_MONTH), source: "static", note: "Static reference — base hourly charge only; excludes per-GB data processing, which is often the larger real-world cost", asOf };
  }

  if (service === "dns") {
    const flat = cloud === "eks" ? 0.50 : cloud === "aks" ? 0.50 : 0.20; // hosted-zone-per-month reference, excludes per-query charges
    return { service: label, hourlyUsd: null, monthlyUsd: flat, source: "static", note: "Static reference — flat per-hosted-zone monthly fee; excludes per-million-query charges (typically $0.40/million)", asOf };
  }

  if (service === "secrets-manager") {
    const perSecretMonth = cloud === "eks" ? 0.40 : cloud === "aks" ? 0.03 : 0.06;
    const count = 10; // representative default — a small app's worth of DB credentials/API keys
    const note = cloud === "aks"
      ? "Static reference — Key Vault bills per 10,000 operations ($0.03), not per stored secret; this approximates a small app's typical monthly call volume"
      : `Static reference — $${perSecretMonth}/secret/month × ${count} secrets`;
    return { service: `${label} (~${count} secrets)`, hourlyUsd: null, monthlyUsd: round2(perSecretMonth * count), source: "static", note, asOf };
  }

  if (service === "monitoring-logging") {
    const perGb = cloud === "eks" ? 0.50 : cloud === "aks" ? 2.30 : 0.50; // log ingestion reference, excludes metrics/dashboards
    return { service: `${label} (${storageGb} GB ingested)`, hourlyUsd: null, monthlyUsd: round2(storageGb * perGb), source: "static", note: `Static reference — ~$${perGb}/GB ingested (logs); metrics and dashboards billed separately`, asOf };
  }

  if (service === "app-load-balancer") {
    // AWS ALB: ~$0.025/LCU-hour + $0.0225/hr base; Azure App Gateway: ~$0.0327/hr small v2; GCP HTTPS LB: ~$0.025/hr forwarding rule
    const flat = cloud === "eks" ? 16.43 : cloud === "aks" ? 23.87 : 18.25;
    const note = cloud === "eks"
      ? "Static reference — ALB base hourly (~$0.0225/hr) + ~1 LCU-hour; excludes per-rule and data-processing charges"
      : cloud === "aks"
      ? "Static reference — Application Gateway v2 Small base hourly (~$0.0327/hr); excludes capacity unit charges"
      : "Static reference — HTTPS forwarding rule base ($0.025/hr); excludes per-GB processed charges";
    return { service: label, hourlyUsd: round2(flat / HOURS_PER_MONTH), monthlyUsd: flat, source: "static", note, asOf };
  }

  if (service === "vpc") {
    // VPC creation is free on all 3 clouds; we report the optional add-on costs users commonly enable
    const flat = cloud === "eks" ? 7.30 : cloud === "aks" ? 0.0 : 0.0;
    const note = cloud === "eks"
      ? "Static reference — VPC itself is free; estimated cost for 1 VPC Endpoint (~$7.30/month base); direct peering/Transit Gateway charges additional"
      : cloud === "aks"
      ? "VNet creation is free; private endpoint pricing applies only if enabled (~$7.30/month/endpoint)"
      : "VPC Network creation is free; VPC Network Peering and Private Service Access charges apply only if enabled";
    return { service: label, hourlyUsd: null, monthlyUsd: flat, source: "static", note, asOf };
  }

  if (service === "object-storage") {
    // S3 Standard: $0.023/GB; Azure Blob Hot: $0.018/GB; GCS Standard: $0.020/GB
    const perGb = cloud === "eks" ? 0.023 : cloud === "aks" ? 0.018 : 0.020;
    const productName = cloud === "eks" ? "S3 Standard" : cloud === "aks" ? "Azure Blob Hot" : "GCS Standard";
    const monthly = round2(storageGb * perGb);
    return { service: `${label} (${storageGb} GB)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note: `Static reference — ${productName} ~$${perGb}/GB-month; excludes requests and data-transfer charges`, asOf };
  }

  if (service === "managed-database") {
    // AWS RDS db.t3.medium Multi-AZ PostgreSQL: ~$0.272/hr → ~$198/mo; Azure Flexible Server 2vCore: ~$0.188/hr → ~$137/mo; GCP Cloud SQL db-custom-2-4096: ~$0.1565/hr → ~$114/mo
    const hourly = cloud === "eks" ? 0.272 : cloud === "aks" ? 0.188 : 0.1565;
    const note = cloud === "eks"
      ? "Static reference — RDS db.t3.medium Multi-AZ PostgreSQL; excludes storage and I/O charges"
      : cloud === "aks"
      ? "Static reference — Azure Database for PostgreSQL Flexible Server, General Purpose 2 vCores; excludes storage charges"
      : "Static reference — Cloud SQL db-custom-2-4096 (2 vCPU, 4 GB RAM); excludes storage charges";
    return { service: label, hourlyUsd: hourly, monthlyUsd: round2(hourly * HOURS_PER_MONTH), source: "static", note, asOf };
  }

  if (service === "elastic-ip") {
    // AWS: $0.005/hr per additional in-use EIP (first EIP attached to a running instance is free); reference 1 extra IP
    // Azure: Standard Static Public IP = $0.005/hr
    // GCP: External Static IP in-use = $0.004/hr; unused = $0.01/hr (we price the in-use rate)
    const hourly = cloud === "eks" ? 0.005 : cloud === "aks" ? 0.005 : 0.004;
    const note = cloud === "eks"
      ? "Static reference — $0.005/hr per in-use EIP beyond the first; unused EIPs cost the same (wasteful!)"
      : cloud === "aks"
      ? "Static reference — Standard Static Public IP $0.005/hr regardless of attachment state"
      : "Static reference — External Static IP $0.004/hr in-use; $0.01/hr if reserved but unused";
    return { service: label, hourlyUsd: hourly, monthlyUsd: round2(hourly * HOURS_PER_MONTH), source: "static", note, asOf };
  }

  if (service === "data-transfer") {
    // storageGb = GB of outbound data to the internet per month
    // AWS: $0.09/GB (first 1 GB free); Azure: $0.087/GB (first 5 GB free); GCP: $0.08/GB (Americas/Europe)
    const perGb = cloud === "eks" ? 0.09 : cloud === "aks" ? 0.087 : 0.08;
    const freeGb = cloud === "eks" ? 1 : cloud === "aks" ? 5 : 0;
    const billableGb = Math.max(0, storageGb - freeGb);
    const monthly = round2(billableGb * perGb);
    const note = cloud === "eks"
      ? `Static reference — $${perGb}/GB out to internet (first ${freeGb} GB free); inbound is free`
      : cloud === "aks"
      ? `Static reference — $${perGb}/GB out to internet (first ${freeGb} GB/month free); inbound is free`
      : `Static reference — $${perGb}/GB out to Americas/Europe; Asia-Pacific is higher (~$0.12/GB)`;
    return { service: `${label} (${storageGb} GB)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (service === "cdn") {
    // storageGb = GB of data delivered from CDN edge per month (first 10 TB tier)
    // AWS CloudFront: $0.0085/GB (first 10 TB, US/Europe origin); Azure CDN Standard Microsoft: $0.081/GB; GCP Cloud CDN: $0.08/GB
    const perGb = cloud === "eks" ? 0.0085 : cloud === "aks" ? 0.081 : 0.08;
    const productName = cloud === "eks" ? "CloudFront (US/Europe, first 10 TB)" : cloud === "aks" ? "Azure CDN Standard Microsoft" : "Cloud CDN (Americas/Europe)";
    return { service: `${label} (${storageGb} GB delivered)`, hourlyUsd: null, monthlyUsd: round2(storageGb * perGb), source: "static", note: `Static reference — ${productName} ~$${perGb}/GB; excludes request charges and HTTPS request fees`, asOf };
  }

  if (service === "cache") {
    // Flat reference for a small entry-level node — no storageGb needed
    // AWS ElastiCache cache.t3.micro Redis: $0.017/hr; Azure Cache for Redis Basic C0 250MB: $0.022/hr; GCP Memorystore Redis Basic 1GB: $0.049/hr
    const hourly = cloud === "eks" ? 0.017 : cloud === "aks" ? 0.022 : 0.049;
    const skuLabel = cloud === "eks" ? "cache.t3.micro single-node" : cloud === "aks" ? "Basic C0 (250 MB)" : "Basic 1 GB";
    return { service: `${label} (${skuLabel})`, hourlyUsd: hourly, monthlyUsd: round2(hourly * HOURS_PER_MONTH), source: "static", note: `Static reference — smallest available Redis tier; no HA replication at this tier`, asOf };
  }

  if (service === "snapshot") {
    // storageGb = total GB of snapshot data stored per month
    // AWS EBS Snapshot: $0.05/GB-month; Azure Managed Disk Snapshot LRS Standard: $0.05/GB-month; GCP PD Snapshot: $0.026/GB-month
    const perGb = cloud === "eks" ? 0.05 : cloud === "aks" ? 0.05 : 0.026;
    const storageNote = cloud === "eks"
      ? "EBS Snapshots are incremental but billed as cumulative changed data in S3"
      : cloud === "aks"
      ? "Standard HDD LRS snapshot; ZRS and Premium LRS cost more"
      : "GCP PD Snapshots are incremental; billed on total stored size across all snapshots";
    return { service: `${label} (${storageGb} GB)`, hourlyUsd: null, monthlyUsd: round2(storageGb * perGb), source: "static", note: `Static reference — $${perGb}/GB-month. ${storageNote}`, asOf };
  }

  if (service === "message-queue") {
    // Reference: 10 million messages/month (representative small-to-medium workload)
    // AWS SQS Standard: $0.40/million (first 1M free); 10M → 9M billable = $3.60
    // Azure Service Bus Standard: $9.81/month base (includes 12.5M operations)
    // GCP Pub/Sub: $0.04/GB of message data; 10M × 1KB avg = 10 GB = $0.40 (first 10 GB free!) → $0.00; reference at 100M msgs = 100GB = $4.00
    const monthly = cloud === "eks" ? 3.60 : cloud === "aks" ? 9.81 : 0.40;
    const note = cloud === "eks"
      ? "Static reference — 10M standard messages/month: 9M billable × $0.40/million (first 1M free); FIFO is 10× pricier per message"
      : cloud === "aks"
      ? "Static reference — Service Bus Standard tier base ($9.81/month includes 12.5M operations); Premium tier starts at ~$677/month"
      : "Static reference — 10M × 1KB messages = 10 GB; first 10 GB/month free → ~$0.40/month; larger payloads cost more";
    return { service: `${label} (~10M msgs/month)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (service === "functions") {
    // storageGb here = millions of invocations per month (UI label makes this clear)
    const millions = Math.max(0.001, storageGb); // storageGb re-used as "millions"
    // AWS Lambda: $0.20/million invocations (first 1M free) + tiny compute cost for 128MB/100ms avg
    // Azure Functions Consumption: $0.20/million executions (first 1M free)
    // GCP Cloud Functions Gen 2: $0.40/million invocations (first 2M free)
    const ratePerMillion = cloud === "eks" ? 0.20 : cloud === "aks" ? 0.20 : 0.40;
    const freeMillion = cloud === "eks" ? 1 : cloud === "aks" ? 1 : 2;
    const billable = Math.max(0, millions - freeMillion);
    const monthly = round2(billable * ratePerMillion);
    const note = cloud === "eks"
      ? `Static reference — $${ratePerMillion}/million invocations (first ${freeMillion}M free); excludes compute (GB-second) charges`
      : cloud === "aks"
      ? `Static reference — $${ratePerMillion}/million executions (first ${freeMillion}M free); excludes compute (GB-second) charges`
      : `Static reference — $${ratePerMillion}/million invocations (first ${freeMillion}M free); excludes compute (GHz-second) charges`;
    return { service: `${label} (${millions}M invocations)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (service === "api-gateway") {
    // storageGb here = millions of API calls per month
    const millions = Math.max(0.001, storageGb);
    // AWS API Gateway HTTP API: $1.00/million calls; REST API: $3.50/million
    // Azure APIM Consumption: $0.35/million calls (no base fee)
    // GCP API Gateway: first 2M free; $3.00/million thereafter
    const ratePerMillion = cloud === "eks" ? 1.00 : cloud === "aks" ? 0.35 : 3.00;
    const freeMillion = cloud === "gke" ? 2 : 0;
    const billable = Math.max(0, millions - freeMillion);
    const monthly = round2(billable * ratePerMillion);
    const note = cloud === "eks"
      ? `Static reference — HTTP API $${ratePerMillion}/million calls; REST API is $3.50/million`
      : cloud === "aks"
      ? `Static reference — APIM Consumption tier $${ratePerMillion}/million calls; no monthly base fee`
      : `Static reference — first ${freeMillion}M calls free; $${ratePerMillion}/million thereafter`;
    return { service: `${label} (${millions}M calls)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (service === "vpn-gateway") {
    // Flat per tunnel-hour/connection-hour
    // AWS Site-to-Site VPN: $0.05/connection-hr = $36.50/month per VPN connection
    // Azure VPN Gateway Basic: $0.027/hr = $19.71/month
    // GCP Cloud VPN HA: $0.05/tunnel-hr = $36.50/month per tunnel (HA VPN = 2 tunnels → $73/month)
    const hourly = cloud === "eks" ? 0.05 : cloud === "aks" ? 0.027 : 0.05;
    const skuNote = cloud === "eks"
      ? "per VPN connection; data transfer over the tunnel is $0.05/GB additional"
      : cloud === "aks"
      ? "Basic SKU; VpnGw1 is $0.19/hr with 650 Mbps; excludes data transfer"
      : "per HA VPN tunnel; HA VPN uses 2 tunnels (×2) for full redundancy; excludes data transfer";
    return { service: label, hourlyUsd: hourly, monthlyUsd: round2(hourly * HOURS_PER_MONTH), source: "static", note: `Static reference — $${hourly}/hr ${skuNote}`, asOf };
  }

  if (service === "event-bus") {
    // storageGb = millions of events per month
    const millions = Math.max(0.001, storageGb);
    // AWS EventBridge: $1.00/million custom events (default bus free; custom bus + events priced)
    // Azure Event Grid: $0.60/million operations (first 100K/month free)
    // GCP Eventarc: ~$0.01/million events (direct-event triggers; audit log triggers are free)
    const ratePerMillion = cloud === "eks" ? 1.00 : cloud === "aks" ? 0.60 : 0.01;
    const freeM = cloud === "aks" ? 0.1 : 0; // 100K free for Azure Event Grid
    const billable = Math.max(0, millions - freeM);
    const monthly = round2(billable * ratePerMillion);
    const note = cloud === "eks"
      ? `Static reference — $${ratePerMillion}/million custom events; default event bus (AWS services) is free`
      : cloud === "aks"
      ? `Static reference — $${ratePerMillion}/million operations (first 100K free); System Topics (Azure services) are free`
      : `Static reference — $${ratePerMillion}/million events for direct-event triggers; audit-log triggers are free`;
    return { service: `${label} (${millions}M events)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (service === "waf") {
    // Reference: 10M requests/month
    // AWS WAF: $5/month per Web ACL + $1.00/million requests inspected; 10M = $5 + $10 = $15
    // Azure WAF on App Gateway: WAF_v2 minimum capacity units ≈ $20/month simplified reference
    // GCP Cloud Armor: $5/month per security policy + $1.00/million requests; 10M = $5 + $10 = $15
    const monthly = cloud === "eks" ? 15.00 : cloud === "aks" ? 20.00 : 15.00;
    const note = cloud === "eks"
      ? "Static reference — $5/month per Web ACL + $1/million requests inspected (10M reference); Bot Control is extra"
      : cloud === "aks"
      ? "Static reference — WAF_v2 on Application Gateway; simplified base reference; actual cost scales with capacity units"
      : "Static reference — $5/month per security policy + $1/million requests (10M reference); Bot Management is extra";
    return { service: `${label} (~10M req/month)`, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (service === "nacl") {
    const note =
      cloud === "eks"
        ? "AWS Network ACLs are free — no charge per rule or per subnet association"
        : cloud === "aks"
        ? "Azure NSGs applied at subnet level are free — no charge per rule"
        : "GCP Hierarchical Firewall Policies are free — no charge per rule or policy";
    return { service: label, hourlyUsd: null, monthlyUsd: 0, source: "static", note, asOf };
  }

  if (service === "route-table") {
    const note =
      cloud === "eks"
        ? "AWS Route Tables are free — no charge per route or per subnet association"
        : cloud === "aks"
        ? "Azure User-Defined Route tables are free — no charge per route entry"
        : "GCP custom VPC routes are free — no charge per route";
    return { service: label, hourlyUsd: null, monthlyUsd: 0, source: "static", note, asOf };
  }

  if (service === "bastion-host") {
    // AWS: t3.micro $0.0104/hr = ~$7.59/month; Azure Bastion Basic $0.19/hr = ~$138/month; GCP f1-micro $0.00760/hr = ~$5.55/month
    const hourly = cloud === "eks" ? 0.0104 : cloud === "aks" ? 0.19 : 0.00760;
    const skuNote =
      cloud === "eks"
        ? "t3.micro EC2 instance; AWS Systems Manager Session Manager ($0/month) is the recommended keyless alternative"
        : cloud === "aks"
        ? "Azure Bastion Basic SKU ($0.19/hr); provides browser-based RDP/SSH without public IPs"
        : "GCE f1-micro; GCP recommends Cloud IAP tunnel ($0/month) for keyless SSH to private VMs";
    return { service: label, hourlyUsd: hourly, monthlyUsd: round2(hourly * HOURS_PER_MONTH), source: "static", note: `Static reference — ${skuNote}`, asOf };
  }

  if (service === "acm") {
    // AWS ACM public certs: $0; Azure Key Vault certs: ~$3-5/month reference; GCP managed certs: $0
    const monthly = cloud === "eks" ? 0 : cloud === "aks" ? 3.0 : 0;
    const note =
      cloud === "eks"
        ? "AWS ACM public certificates are completely free — auto-issued and auto-renewed for ALB, CloudFront, API GW; private CA is $400/month"
        : cloud === "aks"
        ? "Static reference — Key Vault certificate operations ~$3/10K operations; auto-renewal with App Gateway integration"
        : "Google-managed certificates are free for Cloud Load Balancing; Certificate Authority Service is $3/month per CA";
    return { service: label, hourlyUsd: null, monthlyUsd: monthly, source: "static", note, asOf };
  }

  if (
    service === "internet-gateway" ||
    service === "public-subnet" ||
    service === "private-subnet" ||
    service === "security-group"
  ) {
    const note =
      service === "internet-gateway"
        ? cloud === "eks"
          ? "AWS Internet Gateway is free to create and attach; data transfer through it is charged as standard egress"
          : cloud === "aks"
          ? "Azure VNet internet access is built-in and free; outbound data transfer is charged separately"
          : "Cloud Router is free; BGP sessions ($0.01/hr each) and Cloud NAT data processing are charged separately"
        : service === "public-subnet" || service === "private-subnet"
        ? "Subnet creation is free on all clouds; charges come from resources deployed inside (NAT Gateway, VMs, databases, etc.)"
        : cloud === "eks"
        ? "AWS Security Groups are free — no charge per rule, per group, or per network flow"
        : cloud === "aks"
        ? "Azure Network Security Groups (NSGs) are free — no charge per rule or per assignment"
        : "GCP VPC Firewall Rules are free — no charge per rule, per policy, or per network tag";
    return { service: label, hourlyUsd: null, monthlyUsd: 0, source: "static", note, asOf };
  }

  // backup
  const perGbBackup = cloud === "eks" ? 0.05 : cloud === "aks" ? 0.076 : 0.08;
  return { service: `${label} (${storageGb} GB backed up)`, hourlyUsd: null, monthlyUsd: round2(storageGb * perGbBackup), source: "static", note: `Static reference — ~$${perGbBackup}/GB-month for warm backup storage`, asOf };
}

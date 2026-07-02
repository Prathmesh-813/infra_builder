// Alternative cloud providers — all static reference pricing (June 2026)
// IBM Cloud, Oracle Cloud Infrastructure, Alibaba Cloud, DigitalOcean, Linode/Akamai
// None of these expose free unauthenticated public pricing APIs.

import type { CostEstimate, CostLineItem, InstanceTypeInfo, StorageTypeInfo } from "./cloud-cost";

export type AltCloudId = "ibm" | "oci" | "alibaba" | "do" | "linode";

export interface AltCloudInfo {
  id: AltCloudId;
  label: string;
  shortName: string;
  accent: string;
  flag: string;
  desc: string;
  k8sLabel: string;
  clusterCmd: (region: string) => string;
  regions: { value: string; label: string }[];
  instanceTypes: InstanceTypeInfo[];
  storageTypes: StorageTypeInfo[];
  serverlessLabel: string;
  nodesLabel: string;
}

// ── Regions ───────────────────────────────────────────────────────────────
const IBM_REGIONS   = [
  { value: "us-south", label: "US South (Dallas)" },
  { value: "us-east",  label: "US East (Washington DC)" },
  { value: "eu-gb",    label: "EU (London)" },
  { value: "eu-de",    label: "EU (Frankfurt)" },
  { value: "jp-tok",   label: "Asia Pacific (Tokyo)" },
  { value: "au-syd",   label: "Asia Pacific (Sydney)" },
  { value: "ca-tor",   label: "Canada (Toronto)" },
  { value: "br-sao",   label: "South America (São Paulo)" },
];

const OCI_REGIONS   = [
  { value: "us-ashburn-1",      label: "US East (Ashburn)" },
  { value: "us-phoenix-1",      label: "US West (Phoenix)" },
  { value: "eu-frankfurt-1",    label: "EU (Frankfurt)" },
  { value: "eu-amsterdam-1",    label: "EU (Amsterdam)" },
  { value: "uk-london-1",       label: "UK (London)" },
  { value: "ap-tokyo-1",        label: "Japan East (Tokyo)" },
  { value: "ap-sydney-1",       label: "Australia East (Sydney)" },
  { value: "ap-mumbai-1",       label: "India West (Mumbai)" },
  { value: "ap-singapore-1",    label: "Asia Pacific (Singapore)" },
  { value: "sa-saopaulo-1",     label: "Brazil East (São Paulo)" },
  { value: "me-jeddah-1",       label: "Middle East (Jeddah)" },
  { value: "af-johannesburg-1", label: "Africa (Johannesburg)" },
];

const ALIBABA_REGIONS = [
  { value: "cn-hangzhou",    label: "China (Hangzhou)" },
  { value: "cn-shanghai",    label: "China (Shanghai)" },
  { value: "cn-beijing",     label: "China (Beijing)" },
  { value: "cn-shenzhen",    label: "China (Shenzhen)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1", label: "Japan (Tokyo)" },
  { value: "eu-central-1",   label: "EU (Frankfurt)" },
  { value: "us-east-1",      label: "US East (Virginia)" },
  { value: "ap-south-1",     label: "India (Mumbai)" },
];

const DO_REGIONS    = [
  { value: "nyc3", label: "New York (NYC3)" },
  { value: "sfo3", label: "San Francisco (SFO3)" },
  { value: "ams3", label: "Amsterdam (AMS3)" },
  { value: "fra1", label: "Frankfurt (FRA1)" },
  { value: "lon1", label: "London (LON1)" },
  { value: "sgp1", label: "Singapore (SGP1)" },
  { value: "blr1", label: "Bangalore (BLR1)" },
  { value: "syd1", label: "Sydney (SYD1)" },
  { value: "tor1", label: "Toronto (TOR1)" },
];

const LINODE_REGIONS = [
  { value: "us-east",      label: "Newark, NJ" },
  { value: "us-central",   label: "Dallas, TX" },
  { value: "us-west",      label: "Fremont, CA" },
  { value: "eu-west",      label: "London, UK" },
  { value: "eu-central",   label: "Frankfurt, Germany" },
  { value: "ap-south",     label: "Singapore" },
  { value: "ap-southeast", label: "Sydney, AU" },
  { value: "ap-northeast", label: "Tokyo, Japan" },
  { value: "ca-central",   label: "Toronto, Canada" },
  { value: "in-maa",       label: "Chennai, India" },
];

// ── Instance types ────────────────────────────────────────────────────────
const IBM_INSTANCES: InstanceTypeInfo[] = [
  { id: "bx2.2x8",   label: "bx2.2x8 — 2 vCPU / 8 GB",   vcpu: 2, ramGb: 8,  hourlyUsd: 0.095 },
  { id: "bx2.4x16",  label: "bx2.4x16 — 4 vCPU / 16 GB", vcpu: 4, ramGb: 16, hourlyUsd: 0.190 },
  { id: "bx2.8x32",  label: "bx2.8x32 — 8 vCPU / 32 GB", vcpu: 8, ramGb: 32, hourlyUsd: 0.380 },
  { id: "cx2.2x4",   label: "cx2.2x4 — 2 vCPU / 4 GB (CPU opt.)", vcpu: 2, ramGb: 4, hourlyUsd: 0.068 },
  { id: "mx2.4x32",  label: "mx2.4x32 — 4 vCPU / 32 GB (Mem opt.)", vcpu: 4, ramGb: 32, hourlyUsd: 0.248 },
];

const OCI_INSTANCES: InstanceTypeInfo[] = [
  { id: "VM.Standard.E4.Flex.2-8",  label: "E4.Flex 2 OCPU / 8 GB",            vcpu: 2, ramGb: 8,  hourlyUsd: 0.063 },
  { id: "VM.Standard.E4.Flex.4-16", label: "E4.Flex 4 OCPU / 16 GB",           vcpu: 4, ramGb: 16, hourlyUsd: 0.126 },
  { id: "VM.Standard.E4.Flex.8-32", label: "E4.Flex 8 OCPU / 32 GB",           vcpu: 8, ramGb: 32, hourlyUsd: 0.252 },
  { id: "VM.Standard.A1.Flex.4-24", label: "A1.Flex 4 OCPU / 24 GB (ARM)",     vcpu: 4, ramGb: 24, hourlyUsd: 0.060 },
  { id: "VM.Optimized3.Flex.4-32",  label: "Optimized3 4 OCPU / 32 GB (HPC)", vcpu: 4, ramGb: 32, hourlyUsd: 0.216 },
];

const ALIBABA_INSTANCES: InstanceTypeInfo[] = [
  { id: "ecs.g7.large",   label: "g7.large — 2 vCPU / 8 GB",    vcpu: 2, ramGb: 8,  hourlyUsd: 0.107 },
  { id: "ecs.g7.xlarge",  label: "g7.xlarge — 4 vCPU / 16 GB",  vcpu: 4, ramGb: 16, hourlyUsd: 0.214 },
  { id: "ecs.g7.2xlarge", label: "g7.2xlarge — 8 vCPU / 32 GB", vcpu: 8, ramGb: 32, hourlyUsd: 0.428 },
  { id: "ecs.c7.xlarge",  label: "c7.xlarge — 4 vCPU / 8 GB (CPU opt.)", vcpu: 4, ramGb: 8, hourlyUsd: 0.158 },
  { id: "ecs.r7.xlarge",  label: "r7.xlarge — 4 vCPU / 32 GB (Mem opt.)", vcpu: 4, ramGb: 32, hourlyUsd: 0.292 },
];

const DO_INSTANCES: InstanceTypeInfo[] = [
  { id: "s-2vcpu-4gb",      label: "Basic 2 vCPU / 4 GB",           vcpu: 2, ramGb: 4,  hourlyUsd: 0.036 },
  { id: "s-4vcpu-8gb",      label: "Basic 4 vCPU / 8 GB",           vcpu: 4, ramGb: 8,  hourlyUsd: 0.071 },
  { id: "s-8vcpu-16gb",     label: "Basic 8 vCPU / 16 GB",          vcpu: 8, ramGb: 16, hourlyUsd: 0.143 },
  { id: "c-4",              label: "CPU Optimized 4 vCPU / 8 GB",   vcpu: 4, ramGb: 8,  hourlyUsd: 0.119 },
  { id: "m-4vcpu-32gb",     label: "Memory Optimized 4 vCPU / 32 GB", vcpu: 4, ramGb: 32, hourlyUsd: 0.214 },
];

const LINODE_INSTANCES: InstanceTypeInfo[] = [
  { id: "g6-standard-2",  label: "Linode 4GB — 2 vCPU / 4 GB",    vcpu: 2, ramGb: 4,  hourlyUsd: 0.030 },
  { id: "g6-standard-4",  label: "Linode 8GB — 4 vCPU / 8 GB",    vcpu: 4, ramGb: 8,  hourlyUsd: 0.060 },
  { id: "g6-standard-6",  label: "Linode 16GB — 6 vCPU / 16 GB",  vcpu: 6, ramGb: 16, hourlyUsd: 0.120 },
  { id: "g6-standard-8",  label: "Linode 32GB — 8 vCPU / 32 GB",  vcpu: 8, ramGb: 32, hourlyUsd: 0.240 },
  { id: "g6-dedicated-4", label: "Dedicated 8GB — 4 vCPU / 8 GB", vcpu: 4, ramGb: 8,  hourlyUsd: 0.090 },
];

// ── Storage types ─────────────────────────────────────────────────────────
const IBM_STORAGE: StorageTypeInfo[]     = [
  { id: "ibm-block-5iops",  label: "Block (5 IOPS/GB)",  media: "SSD", usdPerGbMonth: 0.20 },
  { id: "ibm-block-10iops", label: "Block (10 IOPS/GB)", media: "SSD", usdPerGbMonth: 0.30 },
  { id: "ibm-file",         label: "File (NFS)",          media: "SSD", usdPerGbMonth: 0.20 },
];

const OCI_STORAGE: StorageTypeInfo[]     = [
  { id: "oci-block-balanced", label: "Block — Balanced",      media: "SSD", usdPerGbMonth: 0.0255 },
  { id: "oci-block-higher",   label: "Block — Higher Perf",   media: "SSD", usdPerGbMonth: 0.0450 },
  { id: "oci-file",           label: "File Storage (NFS)",     media: "SSD", usdPerGbMonth: 0.0300 },
];

const ALIBABA_STORAGE: StorageTypeInfo[] = [
  { id: "alibaba-essd-pl0",  label: "ESSD PL0",  media: "SSD", usdPerGbMonth: 0.0700 },
  { id: "alibaba-essd-pl1",  label: "ESSD PL1",  media: "SSD", usdPerGbMonth: 0.1200 },
  { id: "alibaba-nas-capac", label: "NAS (Capacity)", media: "HDD", usdPerGbMonth: 0.0440 },
];

const DO_STORAGE: StorageTypeInfo[]      = [
  { id: "do-block",  label: "Block Storage (SSD)", media: "SSD", usdPerGbMonth: 0.1000 },
  { id: "do-spaces", label: "Spaces (Object Store)", media: "SSD", usdPerGbMonth: 0.0200 },
];

const LINODE_STORAGE: StorageTypeInfo[]  = [
  { id: "linode-block",   label: "Block Storage (SSD)", media: "SSD", usdPerGbMonth: 0.1000 },
  { id: "linode-object",  label: "Object Storage",       media: "SSD", usdPerGbMonth: 0.0200 },
];

// ── Cloud catalog ─────────────────────────────────────────────────────────
export const ALT_CLOUDS: AltCloudInfo[] = [
  {
    id: "ibm", label: "IBM Cloud", shortName: "IBM", accent: "#0f62fe", flag: "🔷",
    desc: "IBM Kubernetes Service (IKS) · Live pricing via IBM Cloud Catalog API (static reference used)",
    k8sLabel: "IKS", serverlessLabel: "IBM Code Engine (serverless containers)", nodesLabel: "IKS worker pool (VPC VMs)",
    clusterCmd: (r) => `ibmcloud ks cluster create vpc-gen2 --name orders-cluster --zone ${r}-1 --workers 3 --flavor bx2.4x16`,
    regions: IBM_REGIONS, instanceTypes: IBM_INSTANCES, storageTypes: IBM_STORAGE,
  },
  {
    id: "oci", label: "Oracle Cloud", shortName: "OCI", accent: "#c74634", flag: "🔴",
    desc: "Oracle Kubernetes Engine (OKE) · Static reference pricing (Oracle requires API key for live prices)",
    k8sLabel: "OKE", serverlessLabel: "OCI Container Instances (serverless)", nodesLabel: "OKE node pool (Compute VMs)",
    clusterCmd: (r) => `oci ce cluster create --compartment-id <ocid> --name orders-cluster --kubernetes-version v1.31.1 --vcn-id <vcn-ocid> --region ${r}`,
    regions: OCI_REGIONS, instanceTypes: OCI_INSTANCES, storageTypes: OCI_STORAGE,
  },
  {
    id: "alibaba", label: "Alibaba Cloud", shortName: "Alibaba", accent: "#ff6a00", flag: "🟠",
    desc: "Container Service for Kubernetes (ACK) · Static reference pricing",
    k8sLabel: "ACK", serverlessLabel: "ASK — Alibaba Serverless Kubernetes", nodesLabel: "ACK managed node pool (ECS)",
    clusterCmd: (r) => `aliyun cs POST /clusters --region ${r} --body '{"name":"orders-cluster","cluster_type":"ManagedKubernetes","worker_instance_types":["ecs.g7.xlarge"],"num_of_nodes":3}'`,
    regions: ALIBABA_REGIONS, instanceTypes: ALIBABA_INSTANCES, storageTypes: ALIBABA_STORAGE,
  },
  {
    id: "do", label: "DigitalOcean", shortName: "DO", accent: "#0080ff", flag: "🌊",
    desc: "DOKS — DigitalOcean Kubernetes · Static reference pricing",
    k8sLabel: "DOKS", serverlessLabel: "App Platform (managed containers)", nodesLabel: "DOKS node pool (Droplets)",
    clusterCmd: (r) => `doctl kubernetes cluster create orders-cluster --region ${r} --node-pool "name=workers;size=s-4vcpu-8gb;count=3"`,
    regions: DO_REGIONS, instanceTypes: DO_INSTANCES, storageTypes: DO_STORAGE,
  },
  {
    id: "linode", label: "Linode / Akamai", shortName: "Linode", accent: "#00b050", flag: "🟢",
    desc: "LKE — Linode Kubernetes Engine (Akamai Cloud) · Static reference pricing",
    k8sLabel: "LKE", serverlessLabel: "Not available on LKE (use App Platform)", nodesLabel: "LKE node pool (Linode instances)",
    clusterCmd: (r) => `linode-cli lke cluster-create --label orders-cluster --region ${r} --k8s_version 1.31 --node_pools '[{"type":"g6-standard-4","count":3}]'`,
    regions: LINODE_REGIONS, instanceTypes: LINODE_INSTANCES, storageTypes: LINODE_STORAGE,
  },
];

export function getAltCloud(id: AltCloudId): AltCloudInfo {
  return ALT_CLOUDS.find(c => c.id === id)!;
}

// ── K8s cluster cost estimation (all static) ──────────────────────────────
const HOURS = 730;

function r2(n: number) { return Math.round(n * 100) / 100; }

const CONTROL_PLANE_FEE: Record<AltCloudId, number> = {
  ibm:     0,      // IKS control plane is free
  oci:     0,      // OKE control plane is free
  alibaba: 71.5,   // ACK management fee ~$0.098/hr
  do:      0,      // DOKS control plane is free
  linode:  0,      // LKE control plane is free
};

export function estimateAltCloudCost(opts: {
  cloud: AltCloudId;
  region: string;
  nodeCount: number;
  instanceType: string;
  storageGb: number;
  storageType: string;
}): CostEstimate {
  const { cloud, nodeCount, instanceType, storageGb, storageType } = opts;
  const meta = getAltCloud(cloud);
  const nc   = Math.max(1, Math.min(20, nodeCount));
  const sg   = Math.max(1, Math.min(2000, storageGb));
  const asOf = new Date().toISOString().slice(0, 10);

  const inst = meta.instanceTypes.find(i => i.id === instanceType) ?? meta.instanceTypes[1];
  const stor = meta.storageTypes.find(s => s.id === storageType) ?? meta.storageTypes[0];

  const workerCost = r2((inst.hourlyUsd ?? 0.10) * HOURS * nc);
  const storageCost = r2(sg * nc * stor.usdPerGbMonth);
  const ctrlFee     = CONTROL_PLANE_FEE[cloud];

  const items: CostLineItem[] = [];
  if (ctrlFee > 0) items.push({ label: `${meta.k8sLabel} control plane`, monthlyUsd: ctrlFee, note: "Static reference — management fee per cluster" });
  else              items.push({ label: `${meta.k8sLabel} control plane`, monthlyUsd: 0,       note: "Free — managed control plane is included at no charge" });

  items.push(
    { label: `${nc}× ${inst.label}`, monthlyUsd: workerCost, note: `Static reference — $${inst.hourlyUsd}/hr × ${HOURS}h × ${nc} node${nc > 1 ? "s" : ""}` },
    { label: `${stor.label} (${sg} GB × ${nc} nodes)`, monthlyUsd: storageCost, note: `Static reference — $${stor.usdPerGbMonth}/GB-month` },
  );

  return {
    cloud: meta.label,
    source: "static",
    sourceLabel: `Static reference pricing — ${meta.label} does not provide a free public pricing API. Prices are from the ${meta.label} pricing page (June 2026) and may differ from current rates.`,
    asOf,
    items,
    monthlyTotalUsd: r2(items.reduce((s, i) => s + i.monthlyUsd, 0)),
  };
}

// ── Per-service static reference pricing for the comparison explorer ───────
// Monthly USD reference prices keyed by [cloud][serviceId]
// Sources: IBM / OCI / Alibaba / DO / Linode public pricing pages, June 2026

type ServicePricing = Partial<Record<string, { monthly: number; hourly: number | null; note: string }>>;

const ALT_SERVICE_PRICES: Record<AltCloudId, ServicePricing> = {
  ibm: {
    "control-plane":      { monthly: 0,      hourly: 0,      note: "IKS control plane is free" },
    "vm-instance":        { monthly: 69.35,  hourly: 0.095,  note: "bx2.2x8 on-demand (2 vCPU / 8 GB), reference rate" },
    "serverless-compute": { monthly: 22.50,  hourly: null,   note: "IBM Code Engine — ~$0.000014/vCPU-sec + $0.0000035/GB-sec reference" },
    "block-storage":      { monthly: 20.00,  hourly: null,   note: "100 GB × $0.20/GB-month (5 IOPS/GB tier)" },
    "file-storage":       { monthly: 20.00,  hourly: null,   note: "100 GB × $0.20/GB-month NFS file storage" },
    "load-balancer":      { monthly: 21.90,  hourly: null,   note: "IBM Cloud Load Balancer for VPC — ~$0.03/hr + data processed" },
    "managed-database":   { monthly: 135.00, hourly: null,   note: "IBM Cloud Databases for PostgreSQL — 2 vCPU / 8 GB, multi-zone reference" },
    "object-storage":     { monthly: 2.30,   hourly: null,   note: "IBM COS — $0.023/GB-month (Smart Tier), 100 GB reference" },
    "cdn":                { monthly: 8.50,   hourly: null,   note: "IBM Cloud CDN (Akamai-backed) — $0.085/GB out, 100 GB reference" },
    "dns":                { monthly: 0.90,   hourly: null,   note: "IBM Cloud DNS Services — ~$0.90/month per zone" },
    "monitoring-logging": { monthly: 30.00,  hourly: null,   note: "IBM Log Analysis + Monitoring — tiered, reference entry-level cost" },
    "backup":             { monthly: 25.00,  hourly: null,   note: "IBM Backup for VPC — $0.25/GB-month, 100 GB reference" },
    "vpc":                { monthly: 0,      hourly: null,   note: "IBM VPC is free to create; resources inside it are billed separately" },
    "nat-gateway":        { monthly: 31.39,  hourly: null,   note: "IBM Floating IP + VPC public gateway — ~$0.043/hr" },
    "secrets-manager":    { monthly: 1.00,   hourly: null,   note: "IBM Secrets Manager — $1/instance/month (5 free secret versions included)" },
    "data-transfer":      { monthly: 9.00,   hourly: null,   note: "100 GB egress × $0.09/GB" },
    "registry":           { monthly: 5.00,   hourly: null,   note: "IBM Container Registry — $0.05/GB storage + $0.01/GB pull" },
    "snapshot":           { monthly: 8.00,   hourly: null,   note: "Block volume snapshot — $0.08/GB-month, 100 GB reference" },
    "cache":              { monthly: 65.00,  hourly: null,   note: "IBM Databases for Redis — 1 GB plan reference rate" },
    "functions":          { monthly: 0.15,   hourly: null,   note: "IBM Cloud Functions — first 400K GB-sec/month free; reference for 1M invocations" },
    "waf":                { monthly: 25.00,  hourly: null,   note: "IBM Web Application Firewall (Akamai-backed) — reference entry-level" },
    "bastion-host":       { monthly: 7.59,   hourly: 0.0104, note: "bx2.2x8 smallest profile used as jump host reference" },
    "message-queue":      { monthly: 40.00,  hourly: null,   note: "IBM Event Streams (Kafka) — Lite plan reference" },
    "vpn-gateway":        { monthly: 35.00,  hourly: null,   note: "IBM VPN for VPC — ~$0.048/hr per connection" },
    "internet-gateway":   { monthly: 0,      hourly: null,   note: "Public gateway for VPC subnets is free; floating IPs are $0.006/hr" },
    "public-subnet":      { monthly: 0,      hourly: null,   note: "VPC subnets are free on IBM Cloud" },
    "private-subnet":     { monthly: 0,      hourly: null,   note: "VPC subnets are free on IBM Cloud" },
    "security-group":     { monthly: 0,      hourly: null,   note: "VPC security groups are free on IBM Cloud" },
    "nacl":               { monthly: 0,      hourly: null,   note: "VPC network ACLs are free on IBM Cloud" },
    "route-table":        { monthly: 0,      hourly: null,   note: "VPC routing tables are free on IBM Cloud" },
    "elastic-ip":         { monthly: 4.38,   hourly: 0.006,  note: "IBM Floating IP — $0.006/hr when not attached to running instance" },
    "api-gateway":        { monthly: 6.00,   hourly: null,   note: "IBM API Connect Lite — reference rate for ~1M calls/month" },
    "event-bus":          { monthly: 40.00,  hourly: null,   note: "IBM Event Streams — included in message-queue reference above" },
    "app-load-balancer":  { monthly: 21.90,  hourly: null,   note: "IBM ALB for VPC — same as load-balancer base rate" },
    "acm":                { monthly: 0,      hourly: null,   note: "TLS certificates via Let's Encrypt integration are free on IBM Cloud" },
  },
  oci: {
    "control-plane":      { monthly: 0,      hourly: 0,      note: "OKE control plane is free for all cluster tiers" },
    "vm-instance":        { monthly: 46.00,  hourly: 0.063,  note: "VM.Standard.E4.Flex (2 OCPU / 8 GB) on-demand reference" },
    "serverless-compute": { monthly: 18.00,  hourly: null,   note: "OCI Container Instances — $0.0028/OCPU-hr + $0.0004/GB-hr reference" },
    "block-storage":      { monthly: 2.55,   hourly: null,   note: "100 GB × $0.0255/GB-month (Balanced Block Volume)" },
    "file-storage":       { monthly: 3.00,   hourly: null,   note: "100 GB × $0.0300/GB-month (NFS File Storage)" },
    "load-balancer":      { monthly: 10.50,  hourly: null,   note: "Flexible LB — 10 Mbps flexible shape reference ($0.008/hr)" },
    "managed-database":   { monthly: 98.00,  hourly: null,   note: "MySQL HeatWave — 2 OCPU / 32 GB reference, OCI Always Free eligible for smallest shapes" },
    "object-storage":     { monthly: 2.60,   hourly: null,   note: "OCI Object Storage — $0.026/GB-month standard tier, 100 GB reference" },
    "cdn":                { monthly: 8.50,   hourly: null,   note: "OCI CDN — $0.085/GB out, 100 GB reference" },
    "dns":                { monthly: 0.80,   hourly: null,   note: "OCI DNS — $0.80/zone/month (private zone reference)" },
    "monitoring-logging": { monthly: 12.00,  hourly: null,   note: "OCI Logging + Monitoring — 10 GB/month log ingestion reference" },
    "backup":             { monthly: 2.55,   hourly: null,   note: "OCI Backup uses Block Volume storage rates — same as block-storage reference" },
    "vpc":                { monthly: 0,      hourly: null,   note: "OCI VCN (Virtual Cloud Network) is free" },
    "nat-gateway":        { monthly: 1.46,   hourly: null,   note: "OCI NAT Gateway — $0.002/hr" },
    "secrets-manager":    { monthly: 0,      hourly: null,   note: "OCI Vault — secret management included in Always Free tier; negligible for standard use" },
    "data-transfer":      { monthly: 0,      hourly: null,   note: "OCI gives 10 TB free egress per month — significant cost advantage over other clouds" },
    "registry":           { monthly: 0,      hourly: null,   note: "Oracle Container Registry (OCIR) — free for storing images (storage billed at Object Storage rates)" },
    "snapshot":           { monthly: 2.55,   hourly: null,   note: "Block Volume backup/snapshot — $0.0255/GB-month" },
    "cache":              { monthly: 45.00,  hourly: null,   note: "OCI Cache (Redis-compatible) — 1 GB memory reference rate" },
    "functions":          { monthly: 0,      hourly: null,   note: "OCI Functions — 2M free invocations/month + 400K GB-sec; minimal cost for typical workloads" },
    "waf":                { monthly: 15.00,  hourly: null,   note: "OCI WAF — $15/month per WAF policy reference" },
    "bastion-host":       { monthly: 0,      hourly: null,   note: "OCI Bastion service is free (serverless bastion, unlike EC2-based alternatives)" },
    "message-queue":      { monthly: 18.00,  hourly: null,   note: "OCI Queue service — $0.0000025/message, 1B msg/month reference" },
    "vpn-gateway":        { monthly: 7.30,   hourly: null,   note: "OCI VPN Connect — $0.01/hr IPSec tunnel" },
    "internet-gateway":   { monthly: 0,      hourly: null,   note: "OCI Internet Gateway is free" },
    "public-subnet":      { monthly: 0,      hourly: null,   note: "OCI Subnets are free" },
    "private-subnet":     { monthly: 0,      hourly: null,   note: "OCI Subnets are free" },
    "security-group":     { monthly: 0,      hourly: null,   note: "OCI Security Lists and NSGs are free" },
    "nacl":               { monthly: 0,      hourly: null,   note: "OCI Network Security Groups (NSGs) are free" },
    "route-table":        { monthly: 0,      hourly: null,   note: "OCI Route Tables are free" },
    "elastic-ip":         { monthly: 0,      hourly: null,   note: "OCI Public IP addresses — Ephemeral IPs are free; Reserved IPs are $0.0025/hr when unattached" },
    "api-gateway":        { monthly: 3.50,   hourly: null,   note: "OCI API Gateway — $3.50/million API calls reference" },
    "event-bus":          { monthly: 1.00,   hourly: null,   note: "OCI Events — $1/million events published" },
    "app-load-balancer":  { monthly: 10.50,  hourly: null,   note: "OCI Flexible LB — same as load-balancer reference" },
    "acm":                { monthly: 0,      hourly: null,   note: "OCI Certificates Service — Let's Encrypt certs are free; OCI-managed certs $0/month" },
  },
  alibaba: {
    "control-plane":      { monthly: 71.50,  hourly: 0.098,  note: "ACK managed cluster management fee — $0.098/hr reference" },
    "vm-instance":        { monthly: 78.11,  hourly: 0.107,  note: "ecs.g7.large (2 vCPU / 8 GB) on-demand, Singapore region reference" },
    "serverless-compute": { monthly: 20.00,  hourly: null,   note: "ASK (Serverless Kubernetes) — $0.000032/vCPU-sec reference" },
    "block-storage":      { monthly: 12.00,  hourly: null,   note: "100 GB ESSD PL1 × $0.12/GB-month" },
    "file-storage":       { monthly: 4.40,   hourly: null,   note: "100 GB NAS Capacity × $0.044/GB-month" },
    "load-balancer":      { monthly: 24.82,  hourly: null,   note: "ALB — $0.034/hr reference (small specification)" },
    "managed-database":   { monthly: 110.00, hourly: null,   note: "ApsaraDB RDS for PostgreSQL — 2 vCPU / 4 GB HA reference" },
    "object-storage":     { monthly: 2.30,   hourly: null,   note: "OSS Standard — $0.023/GB-month, 100 GB reference" },
    "cdn":                { monthly: 7.50,   hourly: null,   note: "Alibaba Cloud CDN — $0.075/GB out (tiered), 100 GB reference" },
    "dns":                { monthly: 0,      hourly: null,   note: "Alibaba Cloud DNS — free tier includes 5 domain names, 10M queries/month" },
    "monitoring-logging": { monthly: 15.00,  hourly: null,   note: "Simple Log Service — $0.87/GB ingested, 10 GB/month reference + storage" },
    "backup":             { monthly: 6.00,   hourly: null,   note: "Hybrid Backup Recovery — $0.06/GB-month, 100 GB reference" },
    "vpc":                { monthly: 0,      hourly: null,   note: "Alibaba VPC is free to create" },
    "nat-gateway":        { monthly: 32.85,  hourly: null,   note: "Enhanced NAT Gateway Small — $0.045/hr + data processing" },
    "secrets-manager":    { monthly: 1.00,   hourly: null,   note: "KMS Managed HSM — ~$1/month entry level" },
    "data-transfer":      { monthly: 8.50,   hourly: null,   note: "100 GB internet egress × $0.085/GB (international)" },
    "registry":           { monthly: 6.00,   hourly: null,   note: "Container Registry Enterprise — $6/month basic instance" },
    "snapshot":           { monthly: 4.00,   hourly: null,   note: "100 GB × $0.04/GB-month standard snapshot" },
    "cache":              { monthly: 45.00,  hourly: null,   note: "ApsaraDB for Redis — 1 GB Community Edition reference" },
    "functions":          { monthly: 0.50,   hourly: null,   note: "Function Compute — 1M invocations/month reference; first 1M free" },
    "waf":                { monthly: 30.00,  hourly: null,   note: "Alibaba Cloud WAF — Pro edition reference" },
    "bastion-host":       { monthly: 55.47,  hourly: 0.076,  note: "Bastion Host — Small edition reference rate" },
    "message-queue":      { monthly: 12.00,  hourly: null,   note: "Message Queue for Apache Kafka — $0.016/instance-hr reference" },
    "vpn-gateway":        { monthly: 40.15,  hourly: null,   note: "VPN Gateway — $0.055/hr (5 Mbps spec) reference" },
    "internet-gateway":   { monthly: 0,      hourly: null,   note: "Internet access through VPC is built-in; outbound traffic billed separately" },
    "public-subnet":      { monthly: 0,      hourly: null,   note: "Alibaba Cloud VSwitches (subnets) are free" },
    "private-subnet":     { monthly: 0,      hourly: null,   note: "Alibaba Cloud VSwitches (subnets) are free" },
    "security-group":     { monthly: 0,      hourly: null,   note: "Alibaba Cloud Security Groups are free" },
    "nacl":               { monthly: 0,      hourly: null,   note: "Alibaba Cloud Network ACLs are free" },
    "route-table":        { monthly: 0,      hourly: null,   note: "Alibaba Cloud Route Tables are free" },
    "elastic-ip":         { monthly: 3.65,   hourly: 0.005,  note: "EIP — $0.005/hr when unattached (Pay-as-you-go)" },
    "api-gateway":        { monthly: 3.50,   hourly: null,   note: "API Gateway — $3.50/million API calls reference" },
    "event-bus":          { monthly: 0.50,   hourly: null,   note: "EventBridge — $0.50/million events published" },
    "app-load-balancer":  { monthly: 24.82,  hourly: null,   note: "ALB — same as load-balancer reference" },
    "acm":                { monthly: 0,      hourly: null,   note: "SSL Certificates — free DV certificates available; OV/EV paid separately" },
  },
  do: {
    "control-plane":      { monthly: 0,      hourly: 0,      note: "DOKS control plane is free" },
    "vm-instance":        { monthly: 48.00,  hourly: 0.071,  note: "s-4vcpu-8gb Droplet ($48/month flat rate)" },
    "serverless-compute": { monthly: 15.00,  hourly: null,   note: "App Platform (Basic container) — $15/month reference" },
    "block-storage":      { monthly: 10.00,  hourly: null,   note: "100 GB Block Storage volume × $0.10/GB-month" },
    "file-storage":       { monthly: 10.00,  hourly: null,   note: "100 GB Spaces (S3-compatible) used as shared storage" },
    "load-balancer":      { monthly: 12.00,  hourly: null,   note: "DigitalOcean Load Balancer — $12/month flat rate (one node)" },
    "managed-database":   { monthly: 50.00,  hourly: null,   note: "Managed PostgreSQL — Basic 1 vCPU / 1 GB reference (scales up)" },
    "object-storage":     { monthly: 5.00,   hourly: null,   note: "Spaces Object Storage — $5/month includes 250 GB + 1 TB transfer" },
    "cdn":                { monthly: 0.01,   hourly: null,   note: "Spaces CDN Edge — $0.01/GB transfer (100 GB reference)" },
    "dns":                { monthly: 0,      hourly: null,   note: "DigitalOcean DNS is completely free" },
    "monitoring-logging": { monthly: 0,      hourly: null,   note: "Basic monitoring and alerts are free; log forwarding to external is extra" },
    "backup":             { monthly: 20,     hourly: null,   note: "Automated volume snapshots — 20% of Droplet price reference" },
    "vpc":                { monthly: 0,      hourly: null,   note: "DigitalOcean VPC is free" },
    "nat-gateway":        { monthly: 0,      hourly: null,   note: "Outbound NAT is included with Droplets — no separate charge" },
    "secrets-manager":    { monthly: 0,      hourly: null,   note: "No dedicated secrets manager — typically use environment variables or Vault" },
    "data-transfer":      { monthly: 0,      hourly: null,   note: "DigitalOcean includes generous free outbound transfer with each Droplet (1-5 TB/month)" },
    "registry":           { monthly: 5.00,   hourly: null,   note: "Container Registry — $5/month Basic plan (5 GB storage)" },
    "snapshot":           { monthly: 5.00,   hourly: null,   note: "Volume snapshot — $0.05/GB-month, 100 GB reference" },
    "cache":              { monthly: 15.00,  hourly: null,   note: "Managed Redis — Basic plan reference ($15/month)" },
    "functions":          { monthly: 1.85,   hourly: null,   note: "DigitalOcean Functions — $1.85/million invocations reference" },
    "waf":                { monthly: 0,      hourly: null,   note: "No native WAF — typically Cloudflare or a proxy-layer solution" },
    "bastion-host":       { monthly: 6.00,   hourly: null,   note: "s-1vcpu-2gb Droplet as jump host — $6/month" },
    "message-queue":      { monthly: 25.00,  hourly: null,   note: "No native managed MQ — Managed Kafka via marketplace reference" },
    "vpn-gateway":        { monthly: 0,      hourly: null,   note: "No native VPN gateway — typically WireGuard on a Droplet" },
    "internet-gateway":   { monthly: 0,      hourly: null,   note: "Internet access is built into all Droplets" },
    "public-subnet":      { monthly: 0,      hourly: null,   note: "VPC subnets are free" },
    "private-subnet":     { monthly: 0,      hourly: null,   note: "VPC subnets are free" },
    "security-group":     { monthly: 0,      hourly: null,   note: "Cloud Firewalls are free" },
    "nacl":               { monthly: 0,      hourly: null,   note: "No-cost VPC-level firewall rules" },
    "route-table":        { monthly: 0,      hourly: null,   note: "VPC routing is free" },
    "elastic-ip":         { monthly: 4.00,   hourly: null,   note: "Reserved IP — $4/month when unattached (free when attached)" },
    "api-gateway":        { monthly: 0,      hourly: null,   note: "No native API gateway — typically Kong or a lightweight proxy Droplet" },
    "event-bus":          { monthly: 0,      hourly: null,   note: "No native event bus — typically external (Kafka, RabbitMQ)" },
    "app-load-balancer":  { monthly: 12.00,  hourly: null,   note: "Same as load-balancer — DigitalOcean LB handles HTTP/S routing" },
    "acm":                { monthly: 0,      hourly: null,   note: "Let's Encrypt certificates are free and auto-renewed" },
  },
  linode: {
    "control-plane":      { monthly: 0,      hourly: 0,      note: "LKE control plane is free" },
    "vm-instance":        { monthly: 43.80,  hourly: 0.060,  note: "g6-standard-4 Linode 8GB (4 vCPU / 8 GB) — $43.80/month flat rate" },
    "serverless-compute": { monthly: 0,      hourly: null,   note: "No serverless compute on LKE — use App Platform (limited regions)" },
    "block-storage":      { monthly: 10.00,  hourly: null,   note: "100 GB × $0.10/GB-month Block Storage" },
    "file-storage":       { monthly: 10.00,  hourly: null,   note: "100 GB Object Storage used for shared storage reference" },
    "load-balancer":      { monthly: 10.00,  hourly: null,   note: "NodeBalancer — $10/month flat rate" },
    "managed-database":   { monthly: 65.00,  hourly: null,   note: "Managed PostgreSQL — DBaaS 1 GB entry node reference" },
    "object-storage":     { monthly: 5.00,   hourly: null,   note: "Object Storage — $5/month includes 250 GB + 1 TB outbound" },
    "cdn":                { monthly: 1.00,   hourly: null,   note: "100 GB × $0.01/GB outbound through Akamai CDN integration" },
    "dns":                { monthly: 0,      hourly: null,   note: "Linode DNS Manager is free" },
    "monitoring-logging": { monthly: 0,      hourly: null,   note: "Cloud Monitoring (Longview) is free; Longview Pro $20/month for advanced metrics" },
    "backup":             { monthly: 8.74,   hourly: null,   note: "Linode Backups — 20% of Linode plan price reference" },
    "vpc":                { monthly: 0,      hourly: null,   note: "Linode VPC (Private Networks) is free" },
    "nat-gateway":        { monthly: 0,      hourly: null,   note: "Outbound NAT is handled automatically on Linode Networking at no cost" },
    "secrets-manager":    { monthly: 0,      hourly: null,   note: "No dedicated secrets manager — typically HashiCorp Vault on a Linode" },
    "data-transfer":      { monthly: 0,      hourly: null,   note: "Generous free outbound transfer pooled across all Linodes (1-20 TB/month depending on plan)" },
    "registry":           { monthly: 0,      hourly: null,   note: "No native container registry — typically GitHub Container Registry or Docker Hub" },
    "snapshot":           { monthly: 2.00,   hourly: null,   note: "Disk snapshot — $0.02/GB-month, 100 GB reference" },
    "cache":              { monthly: 15.00,  hourly: null,   note: "Managed Redis — entry-level DBaaS reference" },
    "functions":          { monthly: 0,      hourly: null,   note: "No native serverless functions on Linode/Akamai Cloud currently" },
    "waf":                { monthly: 25.00,  hourly: null,   note: "Akamai App & API Protector (WAF via Akamai edge) — entry reference" },
    "bastion-host":       { monthly: 5.00,   hourly: null,   note: "g6-nanode-1 (1 vCPU / 1 GB) as jump host — $5/month" },
    "message-queue":      { monthly: 0,      hourly: null,   note: "No native managed MQ — self-managed Kafka or RabbitMQ on Linode" },
    "vpn-gateway":        { monthly: 0,      hourly: null,   note: "No native VPN gateway — typically WireGuard/OpenVPN on a Nanode ($5/month)" },
    "internet-gateway":   { monthly: 0,      hourly: null,   note: "Internet access is built into all Linode instances" },
    "public-subnet":      { monthly: 0,      hourly: null,   note: "VLANs and VPC subnets are free" },
    "private-subnet":     { monthly: 0,      hourly: null,   note: "VLANs and VPC subnets are free" },
    "security-group":     { monthly: 0,      hourly: null,   note: "Linode Cloud Firewall is free" },
    "nacl":               { monthly: 0,      hourly: null,   note: "No separate NACL concept — Cloud Firewall handles traffic rules for free" },
    "route-table":        { monthly: 0,      hourly: null,   note: "VPC routing is free" },
    "elastic-ip":         { monthly: 2.00,   hourly: null,   note: "Reserved IP — $2/month when not attached" },
    "api-gateway":        { monthly: 0,      hourly: null,   note: "No native API gateway — typically Kong, Traefik, or nginx on Linode" },
    "event-bus":          { monthly: 0,      hourly: null,   note: "No native event bus — typically external (Kafka, RabbitMQ, or managed service)" },
    "app-load-balancer":  { monthly: 10.00,  hourly: null,   note: "NodeBalancer — same as load-balancer ($10/month flat)" },
    "acm":                { monthly: 0,      hourly: null,   note: "Let's Encrypt certificates via cert-manager are free" },
  },
};

export interface AltServicePriceResult {
  cloud: AltCloudId;
  cloudLabel: string;
  accent: string;
  flag: string;
  serviceId: string;
  monthlyUsd: number;
  hourlyUsd: number | null;
  note: string;
  source: "static";
  asOf: string;
}

export function getAltCloudServicePrice(cloud: AltCloudId, serviceId: string): AltServicePriceResult {
  const meta   = getAltCloud(cloud);
  const row    = ALT_SERVICE_PRICES[cloud][serviceId];
  const asOf   = new Date().toISOString().slice(0, 10);
  return {
    cloud,
    cloudLabel: meta.label,
    accent: meta.accent,
    flag: meta.flag,
    serviceId,
    monthlyUsd: row?.monthly ?? 0,
    hourlyUsd:  row?.hourly  ?? null,
    note: row?.note ?? `No reference pricing available for ${meta.label}`,
    source: "static",
    asOf,
  };
}

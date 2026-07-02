"use client";

import { useState } from "react";
import type { CloudId, ServiceId } from "@/lib/kubernetes/cloud-cost";

// ── Cloud-specific option sets ────────────────────────────────────────────────

const VM_OS: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "amazon-linux-2023", label: "Amazon Linux 2023" },
    { id: "ubuntu-22.04",      label: "Ubuntu 22.04 LTS" },
    { id: "ubuntu-20.04",      label: "Ubuntu 20.04 LTS" },
    { id: "windows-2022",      label: "Windows Server 2022" },
    { id: "rhel-9",            label: "Red Hat Enterprise Linux 9" },
    { id: "debian-12",         label: "Debian 12 (Bookworm)" },
  ],
  aks: [
    { id: "ubuntu-22.04",      label: "Ubuntu 22.04 LTS" },
    { id: "ubuntu-20.04",      label: "Ubuntu 20.04 LTS" },
    { id: "windows-2022",      label: "Windows Server 2022" },
    { id: "rhel-9",            label: "Red Hat Enterprise Linux 9" },
    { id: "debian-12",         label: "Debian 12" },
  ],
  gke: [
    { id: "debian-12",         label: "Debian 12 (Bookworm)" },
    { id: "ubuntu-22.04",      label: "Ubuntu 22.04 LTS" },
    { id: "cos",               label: "Container-Optimized OS" },
    { id: "windows-2022",      label: "Windows Server 2022" },
    { id: "rocky-9",           label: "Rocky Linux 9" },
  ],
};

const VM_DISK_TYPE: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "gp3",  label: "General Purpose SSD (gp3)" },
    { id: "gp2",  label: "General Purpose SSD (gp2)" },
    { id: "io1",  label: "Provisioned IOPS SSD (io1)" },
    { id: "st1",  label: "Throughput Optimized HDD (st1)" },
    { id: "sc1",  label: "Cold HDD (sc1)" },
  ],
  aks: [
    { id: "Premium_LRS",      label: "Premium SSD (Premium_LRS)" },
    { id: "StandardSSD_LRS",  label: "Standard SSD (StandardSSD_LRS)" },
    { id: "Standard_LRS",     label: "Standard HDD (Standard_LRS)" },
    { id: "UltraSSD_LRS",     label: "Ultra Disk (UltraSSD_LRS)" },
  ],
  gke: [
    { id: "pd-ssd",      label: "SSD Persistent Disk (pd-ssd)" },
    { id: "pd-balanced", label: "Balanced Persistent Disk (pd-balanced)" },
    { id: "pd-standard", label: "Standard Persistent Disk (pd-standard)" },
    { id: "pd-extreme",  label: "Extreme Persistent Disk (pd-extreme)" },
  ],
};

const DB_ENGINE: Record<CloudId, { id: string; label: string; versions: string[] }[]> = {
  eks: [
    { id: "postgres",       label: "PostgreSQL",      versions: ["16", "15", "14", "13"] },
    { id: "mysql",          label: "MySQL",           versions: ["8.0", "5.7"] },
    { id: "mariadb",        label: "MariaDB",         versions: ["10.11", "10.6"] },
    { id: "oracle-ee",      label: "Oracle EE",       versions: ["19c", "12.2"] },
    { id: "sqlserver-se",   label: "SQL Server SE",   versions: ["2022", "2019"] },
    { id: "aurora-mysql",   label: "Aurora MySQL",    versions: ["8.0", "5.7"] },
    { id: "aurora-postgres",label: "Aurora PostgreSQL",versions: ["16", "15"] },
  ],
  aks: [
    { id: "postgres-flex",  label: "PostgreSQL Flexible", versions: ["16", "15", "14"] },
    { id: "mysql-flex",     label: "MySQL Flexible",       versions: ["8.0", "5.7"] },
    { id: "azure-sql",      label: "Azure SQL Database",   versions: ["2022", "2019"] },
    { id: "cosmos-pg",      label: "Cosmos DB (vCore)",    versions: ["16", "15"] },
  ],
  gke: [
    { id: "POSTGRES_16",          label: "PostgreSQL 16",   versions: ["16"] },
    { id: "POSTGRES_15",          label: "PostgreSQL 15",   versions: ["15"] },
    { id: "MYSQL_8_0",            label: "MySQL 8.0",       versions: ["8.0"] },
    { id: "SQLSERVER_2022_SE",    label: "SQL Server SE",   versions: ["2022"] },
    { id: "SQLSERVER_2022_EE",    label: "SQL Server EE",   versions: ["2022"] },
  ],
};

const DB_INSTANCE_TYPE: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "db.t3.micro",    label: "db.t3.micro   (2 vCPU, 1 GB)" },
    { id: "db.t3.small",    label: "db.t3.small   (2 vCPU, 2 GB)" },
    { id: "db.t3.medium",   label: "db.t3.medium  (2 vCPU, 4 GB)" },
    { id: "db.t3.large",    label: "db.t3.large   (2 vCPU, 8 GB)" },
    { id: "db.m5.large",    label: "db.m5.large   (2 vCPU, 8 GB)" },
    { id: "db.m5.xlarge",   label: "db.m5.xlarge  (4 vCPU, 16 GB)" },
    { id: "db.m5.2xlarge",  label: "db.m5.2xlarge (8 vCPU, 32 GB)" },
    { id: "db.r5.large",    label: "db.r5.large   (2 vCPU, 16 GB)" },
    { id: "db.r5.xlarge",   label: "db.r5.xlarge  (4 vCPU, 32 GB)" },
  ],
  aks: [
    { id: "B1ms",           label: "B1ms   (1 vCPU, 2 GB)" },
    { id: "D2ds_v4",        label: "D2ds_v4  (2 vCPU, 8 GB)" },
    { id: "D4ds_v4",        label: "D4ds_v4  (4 vCPU, 16 GB)" },
    { id: "D8ds_v4",        label: "D8ds_v4  (8 vCPU, 32 GB)" },
    { id: "E2ds_v4",        label: "E2ds_v4  (2 vCPU, 16 GB) — Memory Opt." },
    { id: "E4ds_v4",        label: "E4ds_v4  (4 vCPU, 32 GB) — Memory Opt." },
  ],
  gke: [
    { id: "db-f1-micro",        label: "db-f1-micro      (1 vCPU, 0.6 GB)" },
    { id: "db-g1-small",        label: "db-g1-small      (1 vCPU, 1.7 GB)" },
    { id: "db-custom-1-3840",   label: "db-custom-1-3840 (1 vCPU, 3.75 GB)" },
    { id: "db-custom-2-4096",   label: "db-custom-2-4096 (2 vCPU, 4 GB)" },
    { id: "db-custom-4-15360",  label: "db-custom-4-15360(4 vCPU, 15 GB)" },
    { id: "db-custom-8-30720",  label: "db-custom-8-30720(8 vCPU, 30 GB)" },
  ],
};

const CACHE_ENGINE: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "redis",     label: "Redis (OSS)" },
    { id: "memcached", label: "Memcached" },
  ],
  aks: [
    { id: "redis", label: "Redis" },
  ],
  gke: [
    { id: "REDIS_7_0", label: "Redis 7.0" },
    { id: "REDIS_6_X", label: "Redis 6.x" },
  ],
};

const CACHE_NODE_TYPE: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "cache.t3.micro",   label: "cache.t3.micro  (2 vCPU, 0.5 GB)" },
    { id: "cache.t3.small",   label: "cache.t3.small  (2 vCPU, 1.4 GB)" },
    { id: "cache.t3.medium",  label: "cache.t3.medium (2 vCPU, 3.1 GB)" },
    { id: "cache.m6g.large",  label: "cache.m6g.large (2 vCPU, 6.4 GB)" },
    { id: "cache.r6g.large",  label: "cache.r6g.large (2 vCPU, 13.1 GB)" },
  ],
  aks: [
    { id: "C0",  label: "Basic C0 (0.25 GB)" },
    { id: "C1",  label: "Basic C1 (1 GB)" },
    { id: "C2",  label: "Basic C2 (6 GB)" },
    { id: "P1",  label: "Premium P1 (6 GB)" },
    { id: "P2",  label: "Premium P2 (13 GB)" },
  ],
  gke: [
    { id: "BASIC-1GB",    label: "BASIC — 1 GB" },
    { id: "BASIC-5GB",    label: "BASIC — 5 GB" },
    { id: "STANDARD-HA",  label: "STANDARD_HA — 1 GB (replica)" },
  ],
};

const K8S_VERSIONS = ["1.31", "1.30", "1.29", "1.28"];

const LB_TYPE: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "application", label: "Application Load Balancer (ALB)" },
    { id: "network",     label: "Network Load Balancer (NLB)" },
    { id: "classic",     label: "Classic Load Balancer" },
  ],
  aks: [
    { id: "application-gateway", label: "Application Gateway (WAF)" },
    { id: "standard-lb",         label: "Standard Load Balancer" },
    { id: "basic-lb",            label: "Basic Load Balancer" },
  ],
  gke: [
    { id: "https",    label: "Global HTTP(S) Load Balancer" },
    { id: "tcp",      label: "Regional TCP Load Balancer" },
    { id: "internal", label: "Internal TCP/UDP Load Balancer" },
  ],
};

const CDN_CLASS: Record<CloudId, { id: string; label: string }[]> = {
  eks: [
    { id: "PriceClass_100", label: "Use Edge Locations — North America & Europe" },
    { id: "PriceClass_200", label: "Use All Edge Locations Except South America" },
    { id: "PriceClass_All", label: "Use All Edge Locations (Best Performance)" },
  ],
  aks: [
    { id: "Standard_Microsoft", label: "Standard Microsoft CDN" },
    { id: "Standard_Verizon",   label: "Standard Verizon CDN" },
    { id: "Premium_Verizon",    label: "Premium Verizon CDN" },
  ],
  gke: [
    { id: "global",   label: "Cloud CDN — Global Anycast" },
    { id: "regional", label: "Cloud CDN — Regional" },
  ],
};

// ── Icons & cloud colors ──────────────────────────────────────────────────────

const SERVICE_META: Record<string, { icon: string; label: string; desc: string }> = {
  "control-plane":      { icon: "⚙️",  label: "Kubernetes Cluster",      desc: "Managed control plane + worker node pool" },
  "vm-instance":        { icon: "💻",  label: "Virtual Machine",          desc: "OS, instance type, disk configuration" },
  "managed-database":   { icon: "🗄️",  label: "Managed Database",         desc: "Engine, instance, storage, high availability" },
  "serverless-compute": { icon: "⚡",  label: "Serverless Containers",    desc: "CPU, memory, scaling configuration" },
  "functions":          { icon: "λ",   label: "Serverless Functions",     desc: "Memory, timeout, invocation volume" },
  "cache":              { icon: "🔁",  label: "In-Memory Cache",          desc: "Engine, node type, cluster sizing" },
  "block-storage":      { icon: "💾",  label: "Block Storage",            desc: "Disk type, size, provisioned IOPS" },
  "file-storage":       { icon: "📁",  label: "File Storage",             desc: "Shared NFS/SMB storage, performance tier" },
  "object-storage":     { icon: "🪣",  label: "Object / Blob Storage",    desc: "Storage class, capacity" },
  "registry":           { icon: "📦",  label: "Container Registry",       desc: "Image storage, scanning" },
  "app-load-balancer":  { icon: "⚖️",  label: "Application Load Balancer",desc: "Type, requests per month" },
  "load-balancer":      { icon: "⚖️",  label: "Network Load Balancer",    desc: "TCP/UDP routing, capacity" },
  "nat-gateway":        { icon: "🌐",  label: "NAT Gateway",              desc: "Outbound internet routing for private subnets" },
  "cdn":                { icon: "🌍",  label: "CDN / Edge Delivery",      desc: "Cache, transfer volume, price class" },
  "waf":                { icon: "🛡️",  label: "Web Application Firewall", desc: "Requests/month, managed rule sets" },
  "api-gateway":        { icon: "🔌",  label: "API Gateway",              desc: "HTTP API calls per month" },
  "message-queue":      { icon: "📬",  label: "Message Queue",            desc: "Messages per month, retention" },
  "event-bus":          { icon: "📡",  label: "Event Bus",                desc: "Events published per month" },
  "monitoring-logging": { icon: "📊",  label: "Monitoring & Logging",     desc: "Log ingestion, metrics, dashboards" },
  "secrets-manager":    { icon: "🔐",  label: "Secrets Manager",          desc: "Secrets stored, API calls" },
  "dns":                { icon: "🔍",  label: "DNS",                      desc: "Hosted zones, queries per month" },
  "vpn-gateway":        { icon: "🔒",  label: "VPN Gateway",              desc: "Site-to-site VPN connection" },
  "backup":             { icon: "🗂️",  label: "Managed Backup",           desc: "Backup storage, retention policy" },
  "snapshot":           { icon: "📸",  label: "Disk Snapshots",           desc: "Snapshot storage volume" },
  "data-transfer":      { icon: "📤",  label: "Data Transfer / Egress",   desc: "Outbound data transfer per month" },
  "elastic-ip":         { icon: "📌",  label: "Static / Elastic IP",      desc: "Reserved public IP address" },
  "acm":                { icon: "🔏",  label: "TLS / SSL Certificate",    desc: "Managed certificate issuance & renewal" },
  "bastion-host":       { icon: "🏰",  label: "Bastion Host",             desc: "Secure jump server for SSH/RDP access" },
  "vpc":                { icon: "🏗️",  label: "VPC / Virtual Network",    desc: "Logically isolated cloud network" },
  "internet-gateway":   { icon: "🌐",  label: "Internet Gateway",         desc: "Enables internet connectivity for VPC" },
  "public-subnet":      { icon: "🔵",  label: "Public Subnet",            desc: "Subnet with direct internet access" },
  "private-subnet":     { icon: "🔵",  label: "Private Subnet",           desc: "Subnet without direct internet access" },
  "nacl":               { icon: "🛡️",  label: "Network ACL",              desc: "Subnet-level stateless firewall rules" },
  "route-table":        { icon: "🗺️",  label: "Route Table",              desc: "Controls packet routing between subnets" },
  "security-group":     { icon: "🔒",  label: "Security Group",           desc: "Instance-level stateful firewall" },
};

const CLOUD_COLOR: Record<CloudId, string> = { eks: "#ea580c", aks: "#0078d4", gke: "#1a73e8" };
const CLOUD_LABEL: Record<CloudId, string> = { eks: "AWS", aks: "Azure", gke: "GCP" };

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ServiceConfig {
  // VM
  vmOs: string;
  vmDiskSizeGb: number;
  vmDiskType: string;
  instanceType: string;
  // K8s
  k8sVersion: string;
  nodeCount: number;
  nodeMaxCount: number;
  // DB
  dbEngine: string;
  dbVersion: string;
  dbInstanceType: string;
  dbStorageGb: number;
  dbStorageType: string;
  dbMultiAz: boolean;
  dbBackupDays: number;
  // Serverless container
  serverlessCpu: string;
  serverlessMemGb: string;
  serverlessMinInstances: number;
  serverlessMaxInstances: number;
  serverlessSize: string;
  // Functions
  funcMemMb: number;
  funcTimeoutSec: number;
  functionsMillions: number;
  // Cache
  cacheEngine: string;
  cacheNodeType: string;
  cacheNodes: number;
  cacheReplica: boolean;
  // Block storage
  blockStorageType: string;
  blockStorageGb: number;
  blockIops: number;
  // File storage
  fileStorageGb: number;
  fileStorageClass: string;
  fileStorageType: string;
  // Object storage
  objectStorageGb: number;
  objectStorageClass: string;
  // Registry
  registryGb: number;
  // LB
  lbType: string;
  lbRequestsM: number;
  // CDN
  cdnGb: number;
  cdnClass: string;
  // NAT
  natDataGb: number;
  // WAF
  wafRequestsM: number;
  // API GW
  apiCallsMillions: number;
  // Queues
  messageQueueM: number;
  eventBusMillions: number;
  // Monitoring
  logIngestGb: number;
  // Secrets
  secretsCount: number;
  secretsCallsK: number;
  // DNS
  dnsQueriesM: number;
  // Backup
  backupStorageGb: number;
  // Snapshot
  snapshotGb: number;
  // Transfer
  dataTransferGb: number;
}

export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  vmOs: "ubuntu-22.04",
  vmDiskSizeGb: 30,
  vmDiskType: "gp3",
  instanceType: "t3.medium",
  k8sVersion: "1.30",
  nodeCount: 2,
  nodeMaxCount: 4,
  dbEngine: "postgres",
  dbVersion: "16",
  dbInstanceType: "db.t3.medium",
  dbStorageGb: 20,
  dbStorageType: "gp3",
  dbMultiAz: false,
  dbBackupDays: 7,
  serverlessCpu: "0.5",
  serverlessMemGb: "1",
  serverlessMinInstances: 0,
  serverlessMaxInstances: 10,
  serverlessSize: "medium",
  funcMemMb: 512,
  funcTimeoutSec: 30,
  functionsMillions: 10,
  cacheEngine: "redis",
  cacheNodeType: "cache.t3.micro",
  cacheNodes: 1,
  cacheReplica: false,
  blockStorageType: "gp3",
  blockStorageGb: 50,
  blockIops: 3000,
  fileStorageGb: 20,
  fileStorageClass: "standard",
  fileStorageType: "general",
  objectStorageGb: 100,
  objectStorageClass: "standard",
  registryGb: 10,
  lbType: "application",
  lbRequestsM: 10,
  cdnGb: 100,
  cdnClass: "PriceClass_100",
  natDataGb: 100,
  wafRequestsM: 10,
  apiCallsMillions: 10,
  messageQueueM: 10,
  eventBusMillions: 10,
  logIngestGb: 10,
  secretsCount: 10,
  secretsCallsK: 100,
  dnsQueriesM: 10,
  backupStorageGb: 50,
  snapshotGb: 50,
  dataTransferGb: 100,
};

interface ServiceConfiguratorProps {
  selected: Set<ServiceId>;
  cloud: CloudId;
  config: ServiceConfig;
  onChange: <K extends keyof ServiceConfig>(key: K, value: ServiceConfig[K]) => void;
  instanceTypes: { id: string; label: string }[];
}

// ── Input components ──────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  fontSize: "0.82rem",
};
const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#475569",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  padding: "0.45rem 0.6rem",
  borderRadius: "0.4rem",
  border: "1px solid #cbd5e1",
  fontSize: "0.82rem",
  background: "#fff",
  color: "#1e293b",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function Sel({ value, onChange, opts }: {
  value: string;
  onChange: (v: string) => void;
  opts: { id: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

function Num({ value, onChange, min, max, step = 1, unit }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value) || min)}
        style={{ ...inputStyle, width: "6rem" }}
      />
      {unit && <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{unit}</span>}
    </div>
  );
}

function Toggle({ value, onChange, onLabel = "Yes", offLabel = "No" }: {
  value: boolean; onChange: (v: boolean) => void; onLabel?: string; offLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: "0.4rem" }}>
      {[true, false].map(v => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          style={{
            padding: "0.35rem 0.8rem",
            borderRadius: "0.35rem",
            border: `1px solid ${value === v ? "#3b82f6" : "#cbd5e1"}`,
            background: value === v ? "#eff6ff" : "#fff",
            color: value === v ? "#1d4ed8" : "#64748b",
            fontWeight: value === v ? 700 : 400,
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >{v ? onLabel : offLabel}</button>
      ))}
    </div>
  );
}

// ── Grid wrapper ──────────────────────────────────────────────────────────────

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
      {children}
    </div>
  );
}

// ── Per-service config panels ─────────────────────────────────────────────────

function VmConfig({ cloud, config, onChange, instanceTypes }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"]; instanceTypes: { id: string; label: string }[];
}) {
  const osOpts = VM_OS[cloud] ?? VM_OS.eks;
  const diskOpts = VM_DISK_TYPE[cloud] ?? VM_DISK_TYPE.eks;

  return (
    <Grid>
      <Field label="Operating System">
        <Sel value={config.vmOs} onChange={v => onChange("vmOs", v)} opts={osOpts} />
      </Field>
      <Field label="Instance Type">
        <Sel value={config.instanceType} onChange={v => onChange("instanceType", v)} opts={instanceTypes} />
      </Field>
      <Field label="Root Disk Type">
        <Sel value={config.vmDiskType} onChange={v => onChange("vmDiskType", v)} opts={diskOpts} />
      </Field>
      <Field label="Root Disk Size">
        <Num value={config.vmDiskSizeGb} onChange={v => onChange("vmDiskSizeGb", v)} min={8} max={16384} unit="GB" />
      </Field>
    </Grid>
  );
}

function EksConfig({ cloud, config, onChange, instanceTypes }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"]; instanceTypes: { id: string; label: string }[];
}) {
  const k8sLabel = cloud === "eks" ? "EKS" : cloud === "aks" ? "AKS" : "GKE";
  return (
    <Grid>
      <Field label={`${k8sLabel} Kubernetes Version`}>
        <Sel
          value={config.k8sVersion}
          onChange={v => onChange("k8sVersion", v)}
          opts={K8S_VERSIONS.map(v => ({ id: v, label: `Kubernetes ${v}` }))}
        />
      </Field>
      <Field label="Node Instance Type">
        <Sel value={config.instanceType} onChange={v => onChange("instanceType", v)} opts={instanceTypes} />
      </Field>
      <Field label="Desired Node Count">
        <Num value={config.nodeCount} onChange={v => onChange("nodeCount", v)} min={1} max={100} unit="nodes" />
      </Field>
      <Field label="Max Nodes (Autoscaling)">
        <Num value={config.nodeMaxCount} onChange={v => onChange("nodeMaxCount", v)} min={1} max={500} unit="nodes" />
      </Field>
    </Grid>
  );
}

function DbConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  const engines = DB_ENGINE[cloud] ?? DB_ENGINE.eks;
  const engine = engines.find(e => e.id === config.dbEngine) ?? engines[0];
  const instanceTypes = DB_INSTANCE_TYPE[cloud] ?? DB_INSTANCE_TYPE.eks;
  const diskOpts = VM_DISK_TYPE[cloud] ?? VM_DISK_TYPE.eks;

  return (
    <>
      <Grid>
        <Field label="Database Engine">
          <Sel
            value={config.dbEngine}
            onChange={v => { onChange("dbEngine", v); onChange("dbVersion", (engines.find(e => e.id === v) ?? engines[0]).versions[0]); }}
            opts={engines.map(e => ({ id: e.id, label: e.label }))}
          />
        </Field>
        <Field label="Engine Version">
          <Sel
            value={config.dbVersion}
            onChange={v => onChange("dbVersion", v)}
            opts={(engine.versions).map(v => ({ id: v, label: v }))}
          />
        </Field>
        <Field label="Instance Type">
          <Sel value={config.dbInstanceType} onChange={v => onChange("dbInstanceType", v)} opts={instanceTypes} />
        </Field>
        <Field label="Storage Size">
          <Num value={config.dbStorageGb} onChange={v => onChange("dbStorageGb", v)} min={20} max={65536} unit="GB" />
        </Field>
        <Field label="Storage Type">
          <Sel value={config.dbStorageType} onChange={v => onChange("dbStorageType", v)} opts={diskOpts.slice(0, 3)} />
        </Field>
        <Field label="Multi-AZ / High Availability">
          <Toggle value={config.dbMultiAz} onChange={v => onChange("dbMultiAz", v)} onLabel="Enabled" offLabel="Disabled" />
        </Field>
        <Field label="Backup Retention">
          <Sel
            value={String(config.dbBackupDays)}
            onChange={v => onChange("dbBackupDays", Number(v))}
            opts={[1, 7, 14, 30, 35].map(d => ({ id: String(d), label: `${d} day${d !== 1 ? "s" : ""}` }))}
          />
        </Field>
      </Grid>
      {(config.dbEngine.includes("oracle") || config.dbEngine === "sqlserver-se") && (
        <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.8rem", background: "#fef3c7", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#92400e" }}>
          ⚠ Oracle and SQL Server require a license — pricing includes the BYOL or License Included cost.
        </div>
      )}
    </>
  );
}

function ServerlessConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  const cpuOpts = cloud === "eks"
    ? [{ id: "0.25", label: "0.25 vCPU" }, { id: "0.5", label: "0.5 vCPU" }, { id: "1", label: "1 vCPU" }, { id: "2", label: "2 vCPU" }, { id: "4", label: "4 vCPU" }]
    : cloud === "aks"
    ? [{ id: "1", label: "1 vCPU" }, { id: "2", label: "2 vCPU" }, { id: "4", label: "4 vCPU" }]
    : [{ id: "1", label: "1 vCPU" }, { id: "2", label: "2 vCPU" }, { id: "4", label: "4 vCPU" }, { id: "8", label: "8 vCPU" }];
  const memOpts = [0.5, 1, 2, 4, 8, 16].map(m => ({ id: String(m), label: `${m} GB` }));

  return (
    <Grid>
      <Field label="vCPU">
        <Sel value={config.serverlessCpu} onChange={v => onChange("serverlessCpu", v)} opts={cpuOpts} />
      </Field>
      <Field label="Memory">
        <Sel value={config.serverlessMemGb} onChange={v => onChange("serverlessMemGb", v)} opts={memOpts} />
      </Field>
      <Field label="Min Instances">
        <Num value={config.serverlessMinInstances} onChange={v => onChange("serverlessMinInstances", v)} min={0} max={50} unit="instances" />
      </Field>
      <Field label="Max Instances">
        <Num value={config.serverlessMaxInstances} onChange={v => onChange("serverlessMaxInstances", v)} min={1} max={1000} unit="instances" />
      </Field>
    </Grid>
  );
}

function FunctionConfig({ config, onChange }: {
  config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  const memOpts = [128, 256, 512, 1024, 2048, 4096, 8192, 10240].map(m => ({
    id: String(m), label: `${m >= 1024 ? `${m / 1024} GB` : `${m} MB`}`,
  }));

  return (
    <Grid>
      <Field label="Memory Allocation">
        <Sel value={String(config.funcMemMb)} onChange={v => onChange("funcMemMb", Number(v))} opts={memOpts} />
      </Field>
      <Field label="Timeout">
        <Sel
          value={String(config.funcTimeoutSec)}
          onChange={v => onChange("funcTimeoutSec", Number(v))}
          opts={[3, 10, 30, 60, 120, 300, 900].map(s => ({ id: String(s), label: `${s} seconds` }))}
        />
      </Field>
      <Field label="Invocations / month">
        <Num value={config.functionsMillions} onChange={v => onChange("functionsMillions", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  );
}

function CacheConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  const engines = CACHE_ENGINE[cloud] ?? CACHE_ENGINE.eks;
  const nodeTypes = CACHE_NODE_TYPE[cloud] ?? CACHE_NODE_TYPE.eks;

  return (
    <Grid>
      <Field label="Cache Engine">
        <Sel value={config.cacheEngine} onChange={v => onChange("cacheEngine", v)} opts={engines} />
      </Field>
      <Field label="Node Type">
        <Sel value={config.cacheNodeType} onChange={v => onChange("cacheNodeType", v)} opts={nodeTypes} />
      </Field>
      <Field label="Number of Nodes">
        <Num value={config.cacheNodes} onChange={v => onChange("cacheNodes", v)} min={1} max={20} unit="nodes" />
      </Field>
      {cloud === "eks" && config.cacheEngine === "redis" && (
        <Field label="Replication">
          <Toggle value={config.cacheReplica} onChange={v => onChange("cacheReplica", v)} onLabel="Enabled" offLabel="Disabled" />
        </Field>
      )}
    </Grid>
  );
}

function BlockStorageConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  const diskOpts = VM_DISK_TYPE[cloud] ?? VM_DISK_TYPE.eks;
  const showIops = ["io1", "io2", "gp3", "UltraSSD_LRS", "pd-extreme", "pd-ssd"].includes(config.blockStorageType);

  return (
    <Grid>
      <Field label="Disk Type">
        <Sel value={config.blockStorageType} onChange={v => onChange("blockStorageType", v)} opts={diskOpts} />
      </Field>
      <Field label="Disk Size">
        <Num value={config.blockStorageGb} onChange={v => onChange("blockStorageGb", v)} min={1} max={65536} unit="GB" />
      </Field>
      {showIops && (
        <Field label="Provisioned IOPS">
          <Num value={config.blockIops} onChange={v => onChange("blockIops", v)} min={3000} max={64000} step={100} unit="IOPS" />
        </Field>
      )}
    </Grid>
  );
}

function ObjectStorageConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  const classOpts: Record<CloudId, { id: string; label: string }[]> = {
    eks: [
      { id: "standard",     label: "S3 Standard (frequent access)" },
      { id: "intelligent",  label: "Intelligent-Tiering (automatic)" },
      { id: "standard-ia",  label: "Standard-IA (infrequent)" },
      { id: "glacier-ir",   label: "Glacier Instant Retrieval" },
      { id: "glacier-flex", label: "Glacier Flexible Retrieval" },
      { id: "glacier-deep", label: "Glacier Deep Archive" },
    ],
    aks: [
      { id: "hot",     label: "Hot (frequent access)" },
      { id: "cool",    label: "Cool (infrequent access)" },
      { id: "cold",    label: "Cold (rare access)" },
      { id: "archive", label: "Archive (long-term retention)" },
    ],
    gke: [
      { id: "STANDARD",  label: "Standard (frequent access)" },
      { id: "NEARLINE",  label: "Nearline (monthly access)" },
      { id: "COLDLINE",  label: "Coldline (quarterly access)" },
      { id: "ARCHIVE",   label: "Archive (yearly access)" },
    ],
  };

  return (
    <Grid>
      <Field label="Storage Class">
        <Sel value={config.objectStorageClass} onChange={v => onChange("objectStorageClass", v)} opts={classOpts[cloud]} />
      </Field>
      <Field label="Storage Size">
        <Num value={config.objectStorageGb} onChange={v => onChange("objectStorageGb", v)} min={1} max={1000000} unit="GB" />
      </Field>
    </Grid>
  );
}

function LbConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  return (
    <Grid>
      <Field label="Load Balancer Type">
        <Sel value={config.lbType} onChange={v => onChange("lbType", v)} opts={LB_TYPE[cloud] ?? LB_TYPE.eks} />
      </Field>
      <Field label="Requests / month">
        <Num value={config.lbRequestsM} onChange={v => onChange("lbRequestsM", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  );
}

function CdnConfig({ cloud, config, onChange }: {
  cloud: CloudId; config: ServiceConfig; onChange: ServiceConfiguratorProps["onChange"];
}) {
  return (
    <Grid>
      <Field label="Edge Network / Price Class">
        <Sel value={config.cdnClass} onChange={v => onChange("cdnClass", v)} opts={CDN_CLASS[cloud] ?? CDN_CLASS.eks} />
      </Field>
      <Field label="Data Transfer / month">
        <Num value={config.cdnGb} onChange={v => onChange("cdnGb", v)} min={1} max={1000000} unit="GB" />
      </Field>
    </Grid>
  );
}

// ── Simple numeric configs ────────────────────────────────────────────────────

const SIMPLE_CONFIGS: Partial<Record<ServiceId, (props: {
  config: ServiceConfig;
  onChange: ServiceConfiguratorProps["onChange"];
}) => React.ReactNode>> = {
  "nat-gateway": ({ config, onChange }) => (
    <Grid>
      <Field label="Data Processed / month">
        <Num value={config.natDataGb} onChange={v => onChange("natDataGb", v)} min={1} max={1000000} unit="GB" />
      </Field>
    </Grid>
  ),
  "waf": ({ config, onChange }) => (
    <Grid>
      <Field label="Requests / month">
        <Num value={config.wafRequestsM} onChange={v => onChange("wafRequestsM", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  ),
  "api-gateway": ({ config, onChange }) => (
    <Grid>
      <Field label="API Calls / month">
        <Num value={config.apiCallsMillions} onChange={v => onChange("apiCallsMillions", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  ),
  "message-queue": ({ config, onChange }) => (
    <Grid>
      <Field label="Messages / month">
        <Num value={config.messageQueueM} onChange={v => onChange("messageQueueM", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  ),
  "event-bus": ({ config, onChange }) => (
    <Grid>
      <Field label="Events Published / month">
        <Num value={config.eventBusMillions} onChange={v => onChange("eventBusMillions", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  ),
  "monitoring-logging": ({ config, onChange }) => (
    <Grid>
      <Field label="Log Ingestion / month">
        <Num value={config.logIngestGb} onChange={v => onChange("logIngestGb", v)} min={1} max={100000} unit="GB" />
      </Field>
    </Grid>
  ),
  "secrets-manager": ({ config, onChange }) => (
    <Grid>
      <Field label="Secrets Stored">
        <Num value={config.secretsCount} onChange={v => onChange("secretsCount", v)} min={1} max={10000} unit="secrets" />
      </Field>
      <Field label="API Calls / month">
        <Num value={config.secretsCallsK} onChange={v => onChange("secretsCallsK", v)} min={1} max={1000000} unit="K calls" />
      </Field>
    </Grid>
  ),
  "dns": ({ config, onChange }) => (
    <Grid>
      <Field label="Queries / month">
        <Num value={config.dnsQueriesM} onChange={v => onChange("dnsQueriesM", v)} min={1} max={100000} unit="million" />
      </Field>
    </Grid>
  ),
  "data-transfer": ({ config, onChange }) => (
    <Grid>
      <Field label="Egress Data / month">
        <Num value={config.dataTransferGb} onChange={v => onChange("dataTransferGb", v)} min={1} max={1000000} unit="GB" />
      </Field>
    </Grid>
  ),
  "snapshot": ({ config, onChange }) => (
    <Grid>
      <Field label="Snapshot Storage">
        <Num value={config.snapshotGb} onChange={v => onChange("snapshotGb", v)} min={1} max={100000} unit="GB" />
      </Field>
    </Grid>
  ),
  "backup": ({ config, onChange }) => (
    <Grid>
      <Field label="Backup Storage">
        <Num value={config.backupStorageGb} onChange={v => onChange("backupStorageGb", v)} min={1} max={100000} unit="GB" />
      </Field>
    </Grid>
  ),
  "registry": ({ config, onChange }) => (
    <Grid>
      <Field label="Image Storage">
        <Num value={config.registryGb} onChange={v => onChange("registryGb", v)} min={1} max={10000} unit="GB" />
      </Field>
    </Grid>
  ),
  "file-storage": ({ config, onChange }) => (
    <Grid>
      <Field label="Storage Class">
        <Sel
          value={config.fileStorageClass}
          onChange={v => onChange("fileStorageClass", v)}
          opts={[
            { id: "standard", label: "Standard (frequent access)" },
            { id: "ia",       label: "Infrequent Access" },
          ]}
        />
      </Field>
      <Field label="Storage Size">
        <Num value={config.fileStorageGb} onChange={v => onChange("fileStorageGb", v)} min={1} max={100000} unit="GB" />
      </Field>
    </Grid>
  ),
};

// No-config services (show a minimal info card)
const NO_CONFIG_SERVICES = new Set<ServiceId>([
  "vpc", "internet-gateway", "public-subnet", "private-subnet",
  "nacl", "route-table", "security-group", "acm", "elastic-ip",
  "bastion-host", "vpn-gateway",
]);

// ── Service Card ──────────────────────────────────────────────────────────────

function ServiceCard({
  serviceId,
  cloud,
  config,
  onChange,
  instanceTypes,
  defaultOpen,
}: {
  serviceId: ServiceId;
  cloud: CloudId;
  config: ServiceConfig;
  onChange: ServiceConfiguratorProps["onChange"];
  instanceTypes: { id: string; label: string }[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = SERVICE_META[serviceId] ?? { icon: "⬜", label: serviceId, desc: "" };
  const color = CLOUD_COLOR[cloud];
  const noConfig = NO_CONFIG_SERVICES.has(serviceId);

  function renderConfig() {
    if (noConfig) {
      return (
        <div style={{ color: "#64748b", fontSize: "0.82rem", padding: "0.25rem 0" }}>
          No additional configuration required — this service has a fixed or $0 cost.
        </div>
      );
    }
    if (serviceId === "vm-instance") return <VmConfig cloud={cloud} config={config} onChange={onChange} instanceTypes={instanceTypes} />;
    if (serviceId === "control-plane") return <EksConfig cloud={cloud} config={config} onChange={onChange} instanceTypes={instanceTypes} />;
    if (serviceId === "managed-database") return <DbConfig cloud={cloud} config={config} onChange={onChange} />;
    if (serviceId === "serverless-compute") return <ServerlessConfig cloud={cloud} config={config} onChange={onChange} />;
    if (serviceId === "functions") return <FunctionConfig config={config} onChange={onChange} />;
    if (serviceId === "cache") return <CacheConfig cloud={cloud} config={config} onChange={onChange} />;
    if (serviceId === "block-storage") return <BlockStorageConfig cloud={cloud} config={config} onChange={onChange} />;
    if (serviceId === "object-storage") return <ObjectStorageConfig cloud={cloud} config={config} onChange={onChange} />;
    if (serviceId === "app-load-balancer" || serviceId === "load-balancer") return <LbConfig cloud={cloud} config={config} onChange={onChange} />;
    if (serviceId === "cdn") return <CdnConfig cloud={cloud} config={config} onChange={onChange} />;
    const SimpleComp = SIMPLE_CONFIGS[serviceId];
    if (SimpleComp) return <SimpleComp config={config} onChange={onChange} />;
    return (
      <div style={{ color: "#64748b", fontSize: "0.82rem" }}>
        No additional configuration required for this service.
      </div>
    );
  }

  return (
    <div style={{
      border: `1px solid ${open ? color + "60" : "#e2e8f0"}`,
      borderRadius: "0.6rem",
      background: "#fff",
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          background: open ? `${color}08` : "#fafafa",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          borderBottom: open ? `1px solid ${color}30` : "none",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{meta.icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", display: "block" }}>
            {meta.label}
          </span>
          <span style={{ fontSize: "0.73rem", color: "#64748b" }}>{meta.desc}</span>
        </span>
        <span style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          padding: "0.2rem 0.5rem",
          borderRadius: "99px",
          background: `${color}18`,
          color,
          whiteSpace: "nowrap",
        }}>
          {CLOUD_LABEL[cloud]}
        </span>
        <span style={{ color: "#94a3b8", fontSize: "0.85rem", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
      </button>

      {/* Card body */}
      {open && (
        <div style={{ padding: "1rem" }}>
          {renderConfig()}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Order services so compute comes first, infrastructure last
const SERVICE_ORDER: ServiceId[] = [
  "control-plane", "vm-instance", "serverless-compute", "functions",
  "managed-database", "cache",
  "app-load-balancer", "load-balancer",
  "block-storage", "file-storage", "object-storage", "registry",
  "cdn", "nat-gateway", "waf", "api-gateway",
  "message-queue", "event-bus",
  "monitoring-logging", "secrets-manager", "dns",
  "backup", "snapshot", "data-transfer",
  "bastion-host", "acm", "vpn-gateway", "elastic-ip",
  "internet-gateway", "public-subnet", "private-subnet",
  "vpc", "nacl", "route-table", "security-group",
];

export function ServiceConfigurator({ selected, cloud, config, onChange, instanceTypes }: ServiceConfiguratorProps) {
  if (selected.size === 0) return null;

  const ordered = SERVICE_ORDER.filter(id => selected.has(id));
  // Services selected but not in order list go at the end
  const extra = Array.from(selected).filter(id => !SERVICE_ORDER.includes(id as ServiceId)) as ServiceId[];
  const all = [...ordered, ...extra];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            {all.length} service{all.length !== 1 ? "s" : ""} to configure · click any card to expand
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {all.map((id, i) => (
          <ServiceCard
            key={id}
            serviceId={id}
            cloud={cloud}
            config={config}
            onChange={onChange}
            instanceTypes={instanceTypes}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

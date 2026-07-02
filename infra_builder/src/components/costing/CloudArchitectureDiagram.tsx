"use client";

import { useMemo } from "react";
import { getServiceLabel, type CloudId, type ServiceId } from "@/lib/kubernetes/cloud-cost";

// ── colour palette per service category ──────────────────────────────────────
const CAT: Record<string, { border: string; bg: string; text: string }> = {
  security: { border: "#dc2626", bg: "#fef2f2", text: "#dc2626" },
  network:  { border: "#0891b2", bg: "#f0f9ff", text: "#0891b2" },
  compute:  { border: "#7c3aed", bg: "#faf5ff", text: "#7c3aed" },
  storage:  { border: "#0d9488", bg: "#f0fdfa", text: "#0d9488" },
  data:     { border: "#d97706", bg: "#fffbeb", text: "#d97706" },
  ops:      { border: "#64748b", bg: "#f8fafc", text: "#64748b" },
  infra:    { border: "#16a34a", bg: "#f0fdf4", text: "#16a34a" },
};

// ── zone assignment ───────────────────────────────────────────────────────────
type ZoneId = "edge" | "igw" | "public" | "private-app" | "private-data" | "global";

// nacl and route-table render as subnet badges, not zone nodes
const BADGE_SERVICES = new Set<ServiceId>(["nacl", "route-table"] as ServiceId[]);

const SERVICE_ZONE: Partial<Record<ServiceId, ZoneId | "vpc-meta">> = {
  // Internet edge (outside VPC)
  waf:                  "edge",
  cdn:                  "edge",
  dns:                  "edge",
  "api-gateway":        "edge",
  "elastic-ip":         "edge",
  acm:                  "edge",
  // Internet Gateway (VPC boundary — single centred node)
  "internet-gateway":   "igw",
  // Public subnet
  "app-load-balancer":  "public",
  "load-balancer":      "public",
  "nat-gateway":        "public",
  "vpn-gateway":        "public",
  "public-subnet":      "public",
  "bastion-host":       "public",
  // Private subnet — App Tier
  "control-plane":      "private-app",
  "vm-instance":        "private-app",
  "serverless-compute": "private-app",
  functions:            "private-app",
  registry:             "private-app",
  "secrets-manager":    "private-app",
  "private-subnet":     "private-app",
  "security-group":     "private-app",
  // Private subnet — Data Tier
  "managed-database":   "private-data",
  cache:                "private-data",
  "block-storage":      "private-data",
  "file-storage":       "private-data",
  "message-queue":      "private-data",
  "event-bus":          "private-data",
  snapshot:             "private-data",
  // Managed / Global (no subnet)
  "object-storage":     "global",
  "monitoring-logging": "global",
  backup:               "global",
  // VPC meta (triggers VPC wrapper, no node rendered)
  vpc:                  "vpc-meta",
};

// ── node metadata ─────────────────────────────────────────────────────────────
const NODE_META: Partial<Record<ServiceId, { cat: string; icon: string }>> = {
  waf:                  { cat: "security", icon: "🛡️" },
  cdn:                  { cat: "network",  icon: "🌐" },
  dns:                  { cat: "network",  icon: "📡" },
  "api-gateway":        { cat: "compute",  icon: "🔀" },
  "elastic-ip":         { cat: "network",  icon: "🔗" },
  acm:                  { cat: "security", icon: "🔏" },
  "internet-gateway":   { cat: "infra",    icon: "🌍" },
  "app-load-balancer":  { cat: "network",  icon: "⚖️" },
  "load-balancer":      { cat: "network",  icon: "⚡" },
  "nat-gateway":        { cat: "network",  icon: "🔄" },
  "vpn-gateway":        { cat: "security", icon: "🔐" },
  "public-subnet":      { cat: "infra",    icon: "🟢" },
  "bastion-host":       { cat: "security", icon: "🏰" },
  "control-plane":      { cat: "compute",  icon: "⎈"  },
  "vm-instance":        { cat: "compute",  icon: "🖥️" },
  "serverless-compute": { cat: "compute",  icon: "☁️" },
  functions:            { cat: "compute",  icon: "λ"  },
  registry:             { cat: "storage",  icon: "📦" },
  "secrets-manager":    { cat: "security", icon: "🔑" },
  "private-subnet":     { cat: "infra",    icon: "🔒" },
  "security-group":     { cat: "security", icon: "🔥" },
  "managed-database":   { cat: "data",     icon: "🗄️" },
  cache:                { cat: "data",     icon: "⚡" },
  "block-storage":      { cat: "storage",  icon: "💾" },
  "file-storage":       { cat: "storage",  icon: "📁" },
  "message-queue":      { cat: "data",     icon: "📨" },
  "event-bus":          { cat: "data",     icon: "📢" },
  snapshot:             { cat: "storage",  icon: "📸" },
  "object-storage":     { cat: "storage",  icon: "🪣" },
  "monitoring-logging": { cat: "ops",      icon: "📊" },
  backup:               { cat: "ops",      icon: "💿" },
  vpc:                  { cat: "infra",    icon: "🏠" },
};

// ── edges with workflow labels ────────────────────────────────────────────────
interface Edge { a: ServiceId; b: ServiceId; label?: string; dashed?: boolean }
const EDGES: Edge[] = [
  // Edge → IGW / Public
  { a: "waf",                b: "app-load-balancer",  label: "filter traffic" },
  { a: "cdn",                b: "app-load-balancer",  label: "cache miss" },
  { a: "dns",                b: "app-load-balancer",  label: "SSL termination" },
  { a: "dns",                b: "api-gateway",        label: "resolve" },
  { a: "acm",                b: "app-load-balancer",  label: "TLS cert",        dashed: true },
  { a: "api-gateway",        b: "app-load-balancer" },
  { a: "elastic-ip",         b: "app-load-balancer",  label: "static IP" },
  { a: "elastic-ip",         b: "load-balancer",      label: "static IP" },
  { a: "internet-gateway",   b: "app-load-balancer",  label: "HTTP/HTTPS" },
  { a: "internet-gateway",   b: "load-balancer",      label: "TCP/UDP" },
  { a: "internet-gateway",   b: "nat-gateway",        label: "outbound route" },
  // Public → Private App
  { a: "app-load-balancer",  b: "control-plane",      label: "route traffic" },
  { a: "app-load-balancer",  b: "vm-instance",        label: "HTTP traffic" },
  { a: "load-balancer",      b: "control-plane",      label: "TCP" },
  { a: "load-balancer",      b: "vm-instance",        label: "TCP" },
  { a: "nat-gateway",        b: "vm-instance",        label: "outbound NAT" },
  { a: "vpn-gateway",        b: "control-plane",      label: "private link" },
  { a: "vpn-gateway",        b: "vm-instance",        label: "private link" },
  { a: "bastion-host",       b: "vm-instance",        label: "SSH/RDP",         dashed: true },
  // Private App internal
  { a: "control-plane",      b: "vm-instance",        label: "schedule pods" },
  { a: "control-plane",      b: "serverless-compute", label: "schedule pods" },
  { a: "registry",           b: "vm-instance",        label: "pull images" },
  { a: "registry",           b: "serverless-compute", label: "pull images" },
  { a: "registry",           b: "functions",          label: "pull images" },
  { a: "secrets-manager",    b: "vm-instance",        label: "inject secrets",  dashed: true },
  { a: "secrets-manager",    b: "managed-database",   label: "DB creds",        dashed: true },
  { a: "secrets-manager",    b: "functions",          label: "inject secrets",  dashed: true },
  // App → Data
  { a: "vm-instance",        b: "managed-database",   label: "SQL queries" },
  { a: "vm-instance",        b: "cache",              label: "cache r/w" },
  { a: "vm-instance",        b: "block-storage",      label: "read/write" },
  { a: "vm-instance",        b: "file-storage",       label: "NFS mount" },
  { a: "vm-instance",        b: "message-queue",      label: "publish msgs" },
  { a: "vm-instance",        b: "event-bus",          label: "emit events" },
  { a: "serverless-compute", b: "managed-database",   label: "SQL queries" },
  { a: "serverless-compute", b: "cache",              label: "cache r/w" },
  { a: "functions",          b: "managed-database",   label: "SQL queries" },
  { a: "functions",          b: "cache",              label: "cache r/w" },
  { a: "functions",          b: "event-bus",          label: "emit events" },
  // Data internal
  { a: "block-storage",      b: "snapshot",           label: "snapshot" },
  { a: "message-queue",      b: "functions",          label: "trigger" },
  { a: "event-bus",          b: "functions",          label: "trigger" },
  // App / Data → Global managed
  { a: "vm-instance",        b: "object-storage",     label: "store objects" },
  { a: "vm-instance",        b: "monitoring-logging", label: "send logs",       dashed: true },
  { a: "control-plane",      b: "monitoring-logging", label: "scrape metrics",  dashed: true },
  { a: "serverless-compute", b: "object-storage",     label: "store objects" },
  { a: "functions",          b: "object-storage",     label: "store objects" },
  { a: "backup",             b: "managed-database",   label: "scheduled backup" },
  { a: "backup",             b: "block-storage",      label: "scheduled backup" },
];

// ── layout constants ──────────────────────────────────────────────────────────
const NW = 148;           // node width
const NH = 44;            // node height
const H_GAP = 14;         // horizontal gap between nodes
const V_GAP = 12;         // vertical gap between node rows
const CW = 920;           // canvas width
const CLOUD_PAD_X = 10;   // cloud box outer padding
const CLOUD_HEADER = 44;  // cloud/region header height at top
const PAD_X = 24;         // zone x padding inside cloud box
const ZW = CW - PAD_X * 2;       // outer zone width  (872)
const ZW_INNER = ZW - 40;         // subnet zone width  (832)
const ZX_INNER = PAD_X + 20;      // subnet zone x start
const ZONE_LABEL_H = 32;  // zone label row height (label + sublabel)
const ZONE_PAD_B = 12;    // zone bottom breathing room
const ZONE_SIDE_PAD = 14; // zone side padding inside
const ZONE_GAP = 16;      // vertical gap between zone boxes
const VPC_HEADER_H = 28;  // VPC box header space

// ── cloud provider config ─────────────────────────────────────────────────────
const CLOUD_CFG: Record<CloudId, {
  name: string; shortName: string;
  cloudColor: string; cloudFill: string;
  regionLabel: string;
  vpcLabel: string;
}> = {
  eks: {
    name: "Amazon Web Services (AWS)",
    shortName: "AWS",
    cloudColor: "#f59e0b",
    cloudFill: "#fffbeb",
    regionLabel: "Region",
    vpcLabel: "VPC — Virtual Private Cloud",
  },
  aks: {
    name: "Microsoft Azure",
    shortName: "Azure",
    cloudColor: "#0078d4",
    cloudFill: "#eff6ff",
    regionLabel: "Azure Region",
    vpcLabel: "Virtual Network (VNet)",
  },
  gke: {
    name: "Google Cloud Platform (GCP)",
    shortName: "GCP",
    cloudColor: "#1a73e8",
    cloudFill: "#eff6ff",
    regionLabel: "GCP Region",
    vpcLabel: "VPC Network",
  },
};

const AZ_LABELS: Record<CloudId, string> = {
  eks: "Availability Zone (AZ-a / AZ-b)",
  aks: "Availability Zone (Zone 1 / Zone 2)",
  gke: "Zone (us-central1-a / us-central1-b)",
};

// ── zone visual styles ────────────────────────────────────────────────────────
const ZONE_STYLE: Record<ZoneId, {
  label: string; sub: string;
  fill: string; stroke: string; labelColor: string;
}> = {
  edge: {
    label: "Internet / Global Edge",
    sub: "WAF · CDN · DNS · API Gateway · ACM · Elastic IP",
    fill: "#dbeafe", stroke: "#3b82f6", labelColor: "#1d4ed8",
  },
  igw: {
    label: "", sub: "",
    fill: "transparent", stroke: "transparent", labelColor: "transparent",
  },
  public: {
    label: "Public Subnet",
    sub: "internet-accessible · has public IPs · NACL & Route Table at boundary",
    fill: "#dcfce7", stroke: "#22c55e", labelColor: "#15803d",
  },
  "private-app": {
    label: "Private Subnet — App Tier",
    sub: "no direct internet · LB-routed only · Security Group protects instances",
    fill: "#eff6ff", stroke: "#60a5fa", labelColor: "#1d4ed8",
  },
  "private-data": {
    label: "Private Subnet — Data Tier",
    sub: "isolated · App Tier access only · no internet route",
    fill: "#fff7ed", stroke: "#fb923c", labelColor: "#c2410c",
  },
  global: {
    label: "Managed / Global Services",
    sub: "no VPC subnet required · regionally or globally managed",
    fill: "#faf5ff", stroke: "#c084fc", labelColor: "#7e22ce",
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function zoneBoxH(count: number, zoneW: number): number {
  const innerW = zoneW - ZONE_SIDE_PAD * 2;
  const perRow = Math.max(1, Math.floor((innerW + H_GAP) / (NW + H_GAP)));
  const rows = Math.ceil(count / perRow);
  return ZONE_LABEL_H + rows * NH + (rows - 1) * V_GAP + ZONE_PAD_B;
}

function placeNodes(
  ids: ServiceId[],
  boxX: number, boxY: number, boxW: number,
): Map<ServiceId, [number, number]> {
  const m = new Map<ServiceId, [number, number]>();
  if (!ids.length) return m;
  const innerW = boxW - ZONE_SIDE_PAD * 2;
  const perRow = Math.max(1, Math.floor((innerW + H_GAP) / (NW + H_GAP)));
  const rows = Math.ceil(ids.length / perRow);
  const contentH = rows * NH + (rows - 1) * V_GAP;
  const startY = boxY + ZONE_LABEL_H + (zoneBoxH(ids.length, boxW) - ZONE_LABEL_H - ZONE_PAD_B - contentH) / 2;
  ids.forEach((id, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = row < rows - 1 ? perRow : ids.length - row * perRow;
    const rowW = inRow * NW + (inRow - 1) * H_GAP;
    const startX = boxX + ZONE_SIDE_PAD + (innerW - rowW) / 2;
    m.set(id, [startX + col * (NW + H_GAP) + NW / 2, startY + row * (NH + V_GAP) + NH / 2]);
  });
  return m;
}

function borderPt(ox: number, oy: number, tx: number, ty: number, pad = 5): [number, number] {
  const dx = tx - ox, dy = ty - oy;
  const d = Math.hypot(dx, dy);
  if (d < 1) return [ox, oy];
  const ux = dx / d, uy = dy / d;
  const t = Math.min(
    Math.abs(ux) > 1e-9 ? (NW / 2 + pad) / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-9 ? (NH / 2 + pad) / Math.abs(uy) : Infinity,
  );
  return [ox + ux * t, oy + uy * t];
}

function trimLabel(s: string, max = 17): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── component ─────────────────────────────────────────────────────────────────
export function CloudArchitectureDiagram({
  selected,
  cloud,
  region,
}: {
  selected: Set<ServiceId>;
  cloud: CloudId;
  region?: string;
}) {
  const cfg = CLOUD_CFG[cloud];

  // ── group selected services by zone ─────────────────────────────────────────
  const groups = useMemo(() => {
    const g: Record<string, ServiceId[]> = {
      edge: [], igw: [], public: [], "private-app": [], "private-data": [], global: [],
    };
    let hasVpcMeta = false;
    const showNacl = selected.has("nacl" as ServiceId);
    const showRouteTable = selected.has("route-table" as ServiceId);
    for (const id of selected) {
      if (BADGE_SERVICES.has(id as ServiceId)) continue; // rendered as subnet badge, not node
      const z = SERVICE_ZONE[id as ServiceId];
      if (!z) continue;
      if (z === "vpc-meta") { hasVpcMeta = true; continue; }
      g[z].push(id as ServiceId);
    }
    return { ...g, hasVpcMeta, showNacl, showRouteTable } as
      Record<string, ServiceId[]> & { hasVpcMeta: boolean; showNacl: boolean; showRouteTable: boolean };
  }, [selected]);

  // ── compute zone boxes + node positions ──────────────────────────────────────
  const layout = useMemo(() => {
    const np = new Map<ServiceId, [number, number]>();
    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
    // Start below cloud/region header
    let y = CLOUD_HEADER + 15;

    // EDGE zone
    if (groups.edge.length > 0) {
      const h = zoneBoxH(groups.edge.length, ZW);
      boxes.edge = { x: PAD_X, y, w: ZW, h };
      placeNodes(groups.edge, PAD_X, y, ZW).forEach((v, k) => np.set(k, v));
      y += h + ZONE_GAP;
    }

    // IGW — standalone centred node
    let igwCentre: [number, number] | null = null;
    const hasInner =
      groups.public.length + groups["private-app"].length + groups["private-data"].length > 0;

    if (groups.igw.length > 0) {
      igwCentre = [CW / 2, y + NH / 2];
      np.set("internet-gateway" as ServiceId, igwCentre);
      y += NH + ZONE_GAP;
    } else if (hasInner && groups.edge.length > 0) {
      y += 10;
    }

    // VPC container
    const vpcTop = y;
    const hasVpc = hasInner || groups.hasVpcMeta;
    let vpcBox: { x: number; y: number; w: number; h: number } | null = null;

    if (hasVpc) {
      y += VPC_HEADER_H;
    }

    for (const { key, zW, zX } of [
      { key: "public",       zW: ZW_INNER, zX: ZX_INNER },
      { key: "private-app",  zW: ZW_INNER, zX: ZX_INNER },
      { key: "private-data", zW: ZW_INNER, zX: ZX_INNER },
    ]) {
      const g = groups[key] as ServiceId[];
      if (!g.length) continue;
      const h = zoneBoxH(g.length, zW);
      boxes[key] = { x: zX, y, w: zW, h };
      placeNodes(g, zX, y, zW).forEach((v, k) => np.set(k, v));
      y += h + ZONE_GAP;
    }

    if (hasVpc) {
      y -= ZONE_GAP;
      y += 12;
      vpcBox = { x: PAD_X, y: vpcTop, w: ZW, h: y - vpcTop };
      y += ZONE_GAP;
    }

    // Global managed services
    if (groups.global.length > 0) {
      const h = zoneBoxH(groups.global.length, ZW);
      boxes.global = { x: PAD_X, y, w: ZW, h };
      placeNodes(groups.global, PAD_X, y, ZW).forEach((v, k) => np.set(k, v));
      y += h;
    }

    return { np, boxes, vpcBox, igwCentre, canvasH: y + 20 };
  }, [groups]);

  const { np: nodePos, boxes, vpcBox, igwCentre, canvasH } = layout;

  const activeIds = useMemo(
    () =>
      (Array.from(selected) as ServiceId[]).filter(
        (id) => NODE_META[id] && nodePos.has(id),
      ),
    [selected, nodePos],
  );

  if (activeIds.length === 0) return null;

  const activeEdges = useMemo(
    () =>
      EDGES.filter(
        ({ a, b }) =>
          selected.has(a) && selected.has(b) && nodePos.has(a) && nodePos.has(b),
      ),
    [selected, nodePos],
  );

  const displayRegion = region ?? (cloud === "eks" ? "us-east-1" : cloud === "aks" ? "eastus" : "us-central1");

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 className="arch-trace__title">Architecture Diagram</h3>
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 0.8rem" }}>
        {cfg.shortName} VPC-style architecture with workflow labels — updates live as you select services.
      </p>

      <div
        style={{
          border: "1px solid var(--card-border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
          background: "#f8fafc",
        }}
      >
        <svg
          viewBox={`0 0 ${CW} ${canvasH}`}
          style={{ display: "block", width: "100%", height: "auto" }}
          aria-label="Cloud architecture diagram"
        >
          <defs>
            <marker id="arr"     markerWidth="9"  markerHeight="7"  refX="9"  refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7"   fill="#94a3b8" />
            </marker>
            <marker id="arr-sec" markerWidth="8"  markerHeight="6"  refX="8"  refY="3"   orient="auto">
              <polygon points="0 0, 8 3, 0 6"     fill="#94a3b870" />
            </marker>
          </defs>

          {/* ── Canvas background ─────────────────────────────────────── */}
          <rect x="0" y="0" width={CW} height={canvasH} fill="#f8fafc" />

          {/* ── Cloud Provider outer box ──────────────────────────────── */}
          <rect
            x={CLOUD_PAD_X} y={CLOUD_PAD_X}
            width={CW - CLOUD_PAD_X * 2} height={canvasH - CLOUD_PAD_X * 2}
            rx={14}
            fill={cfg.cloudFill}
            stroke={cfg.cloudColor}
            strokeWidth={2}
            strokeDasharray="10 5"
          />

          {/* Cloud provider badge */}
          <rect x={CLOUD_PAD_X} y={CLOUD_PAD_X} width={260} height={26} rx={8}
            fill={cfg.cloudColor} />
          <text x={CLOUD_PAD_X + 10} y={CLOUD_PAD_X + 17}
            fontSize={11} fontWeight={800} fontFamily="system-ui,sans-serif"
            fill="white" letterSpacing="0.03em">
            ☁  {cfg.name}
          </text>

          {/* Region badge */}
          <rect x={CLOUD_PAD_X + 270} y={CLOUD_PAD_X} width={220} height={26} rx={8}
            fill="white" stroke={cfg.cloudColor} strokeWidth={1.5} />
          <text x={CLOUD_PAD_X + 278} y={CLOUD_PAD_X + 17}
            fontSize={10} fontWeight={700} fontFamily="system-ui,sans-serif"
            fill={cfg.cloudColor}>
            {cfg.regionLabel}: {displayRegion}
          </text>

          {/* AZ indicator */}
          <text x={CLOUD_PAD_X + 500} y={CLOUD_PAD_X + 17}
            fontSize={9} fontWeight={400} fontFamily="system-ui,sans-serif"
            fill="#64748b">
            {AZ_LABELS[cloud]}
          </text>

          {/* ── VPC Container box ─────────────────────────────────────── */}
          {vpcBox && (
            <g>
              <rect
                x={vpcBox.x} y={vpcBox.y} width={vpcBox.w} height={vpcBox.h}
                rx={10} fill="#f0fdf4" stroke="#86efac" strokeWidth={2} strokeDasharray="8 4"
              />
              <rect x={vpcBox.x + 8} y={vpcBox.y - 1} width={250} height={22}
                rx={6} fill="#dcfce7" stroke="#86efac" strokeWidth={1} />
              <text x={vpcBox.x + 18} y={vpcBox.y + 14}
                fontSize={10} fontWeight={700} fontFamily="system-ui,sans-serif"
                fill="#15803d" letterSpacing="0.03em">
                {cfg.vpcLabel}
              </text>
            </g>
          )}

          {/* ── Zone boxes ────────────────────────────────────────────── */}
          {(["edge", "public", "private-app", "private-data", "global"] as ZoneId[]).map((zid) => {
            const box = boxes[zid];
            if (!box) return null;
            const st = ZONE_STYLE[zid];
            const isSubnet = zid === "public" || zid === "private-app" || zid === "private-data";
            return (
              <g key={zid}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h}
                  rx={10} fill={st.fill} stroke={st.stroke} strokeWidth={1.5} />

                {/* Zone label */}
                <text x={box.x + 12} y={box.y + 17}
                  fontSize={9.5} fontWeight={700} fontFamily="system-ui,sans-serif"
                  fill={st.labelColor} letterSpacing="0.04em">
                  {st.label}
                </text>
                <text x={box.x + 12} y={box.y + 28}
                  fontSize={8} fontFamily="system-ui,sans-serif" fill={st.stroke}>
                  {st.sub}
                </text>

                {/* NACL badge on subnet boxes */}
                {isSubnet && groups.showNacl && (
                  <g>
                    <rect
                      x={box.x + box.w - 58} y={box.y + 6}
                      width={50} height={18} rx={5}
                      fill="#fef3c7" stroke="#f59e0b" strokeWidth={1.2}
                    />
                    <text
                      x={box.x + box.w - 33} y={box.y + 18}
                      fontSize={8} fontWeight={700} fontFamily="system-ui,sans-serif"
                      fill="#b45309" textAnchor="middle">
                      🛡 NACL
                    </text>
                  </g>
                )}

                {/* Route Table badge on subnet boxes */}
                {isSubnet && groups.showRouteTable && (
                  <g>
                    <rect
                      x={box.x + box.w - (groups.showNacl ? 114 : 58)} y={box.y + 6}
                      width={50} height={18} rx={5}
                      fill="#eff6ff" stroke="#3b82f6" strokeWidth={1.2}
                    />
                    <text
                      x={box.x + box.w - (groups.showNacl ? 89 : 33)} y={box.y + 18}
                      fontSize={8} fontWeight={700} fontFamily="system-ui,sans-serif"
                      fill="#1d4ed8" textAnchor="middle">
                      📋 R.Table
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── Internet Gateway (standalone centred node) ────────────── */}
          {igwCentre && (() => {
            const [ncx, ncy] = igwCentre;
            const meta = NODE_META["internet-gateway" as ServiceId]!;
            const c = CAT[meta.cat];
            return (
              <g transform={`translate(${ncx - NW / 2},${ncy - NH / 2})`}>
                <rect width={NW} height={NH} rx={8} fill={c.bg} stroke={c.border} strokeWidth={1.8} />
                <text x={14} y={NH / 2 + 5} fontSize={14} textAnchor="middle"
                  dominantBaseline="middle" fontFamily="system-ui,sans-serif">{meta.icon}</text>
                <text x={NW / 2 + 4} y={NH / 2 + 1} textAnchor="middle"
                  dominantBaseline="middle" fontSize={10} fontWeight={700}
                  fontFamily="system-ui,sans-serif" fill={c.text}>
                  {trimLabel(getServiceLabel(cloud, "internet-gateway" as ServiceId), 18)}
                </text>
              </g>
            );
          })()}

          {/* ── Zone-level flow arrows ─────────────────────────────────── */}
          {/* edge → IGW / VPC */}
          {boxes.edge && (igwCentre || vpcBox) && (() => {
            const x = CW / 2;
            const y1 = boxes.edge.y + boxes.edge.h + 2;
            const y2 = igwCentre ? igwCentre[1] - NH / 2 - 4 : vpcBox!.y + 2;
            return <line x1={x} y1={y1} x2={x} y2={y2}
              stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arr)" />;
          })()}
          {/* IGW → public subnet */}
          {igwCentre && boxes.public && (() => {
            const x = CW / 2;
            return <line x1={x} y1={igwCentre[1] + NH / 2 + 2} x2={x} y2={boxes.public.y - 2}
              stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arr)" />;
          })()}
          {/* public → private-app */}
          {boxes.public && boxes["private-app"] && (() => {
            const x = CW / 2;
            return <line x1={x} y1={boxes.public.y + boxes.public.h + 2} x2={x} y2={boxes["private-app"].y - 2}
              stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arr)" />;
          })()}
          {/* private-app → private-data */}
          {boxes["private-app"] && boxes["private-data"] && (() => {
            const x = CW / 2;
            return <line x1={x} y1={boxes["private-app"].y + boxes["private-app"].h + 2}
              x2={x} y2={boxes["private-data"].y - 2}
              stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arr)" />;
          })()}
          {/* VPC → global */}
          {vpcBox && boxes.global && (() => {
            const x = CW / 2;
            return <line x1={x} y1={vpcBox.y + vpcBox.h + 2} x2={x} y2={boxes.global.y - 2}
              stroke="#94a3b870" strokeWidth={1.5} strokeDasharray="5 4" markerEnd="url(#arr)" />;
          })()}

          {/* ── Service connection edges with workflow labels ──────────── */}
          {activeEdges.map(({ a: from, b: to, label, dashed: isDashed }) => {
            const fp = nodePos.get(from);
            const tp = nodePos.get(to);
            if (!fp || !tp) return null;
            const [ox, oy] = fp, [tx, ty] = tp;
            const [sx, sy] = borderPt(ox, oy, tx, ty);
            const [ex, ey] = borderPt(tx, ty, ox, oy);
            const midY = (sy + ey) / 2;
            // bezier midpoint: x=(sx+ex)/2, y=midY
            const lx = (sx + ex) / 2;
            const ly = midY;
            // Offset label away from the line: right for vertical, up for horizontal
            const isVert = Math.abs(ey - sy) > Math.abs(ex - sx);
            const lox = isVert ? lx + 8 : lx;
            const loy = isVert ? ly : ly - 9;
            const useSecStyle = isDashed || from === "secrets-manager" || from === "monitoring-logging";
            const estW = label ? Math.max(40, label.length * 5.2) : 0;
            return (
              <g key={`${from}-${to}`}>
                <path
                  d={`M ${sx} ${sy} C ${sx} ${midY} ${ex} ${midY} ${ex} ${ey}`}
                  fill="none"
                  stroke={useSecStyle ? "#94a3b870" : "#94a3b8"}
                  strokeWidth={useSecStyle ? 1.2 : 1.5}
                  strokeDasharray={useSecStyle ? "5 4" : undefined}
                  markerEnd={useSecStyle ? "url(#arr-sec)" : "url(#arr)"}
                  opacity={0.85}
                />
                {label && (
                  <g>
                    <rect
                      x={lox - estW / 2 - 3} y={loy - 8}
                      width={estW + 6} height={13} rx={3}
                      fill="white" fillOpacity={0.92}
                      stroke="#e2e8f0" strokeWidth={0.5}
                    />
                    <text
                      x={lox} y={loy + 2}
                      textAnchor="middle"
                      fontSize={7.5}
                      fontFamily="system-ui,sans-serif"
                      fill="#475569"
                    >
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── Service nodes ──────────────────────────────────────────── */}
          {activeIds
            .filter((id) => !(id === ("internet-gateway" as ServiceId) && igwCentre))
            .map((id) => {
              const pos = nodePos.get(id);
              if (!pos) return null;
              const [ncx, ncy] = pos;
              const meta = NODE_META[id]!;
              const c = CAT[meta.cat];
              const lbl = trimLabel(getServiceLabel(cloud, id), 18);
              return (
                <g key={id} transform={`translate(${ncx - NW / 2},${ncy - NH / 2})`}>
                  <rect width={NW} height={NH} rx={8} fill={c.bg} stroke={c.border} strokeWidth={1.8} />
                  <text x={14} y={NH / 2 + 5} fontSize={14} textAnchor="middle"
                    dominantBaseline="middle" fontFamily="system-ui,sans-serif">{meta.icon}</text>
                  <text x={NW / 2 + 4} y={NH / 2 + 1} textAnchor="middle"
                    dominantBaseline="middle" fontSize={10} fontWeight={700}
                    fontFamily="system-ui,sans-serif" fill={c.text}>{lbl}</text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "0.75rem", flexWrap: "wrap",
        marginTop: "0.55rem", fontSize: "0.72rem",
        color: "var(--text-muted)", alignItems: "center",
      }}>
        {Object.entries(CAT).map(([cat, c]) => (
          <span key={cat} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{
              display: "inline-block", width: 10, height: 10, borderRadius: 3,
              background: c.border, flexShrink: 0,
            }} />
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </span>
        ))}
        <span style={{ borderLeft: "1px solid var(--card-border)", paddingLeft: "0.75rem" }}>
          🛡 NACL = subnet-level stateless firewall
        </span>
        <span>
          📋 R.Table = subnet route table
        </span>
        <span style={{ marginLeft: "auto" }}>
          ── solid = traffic flow &nbsp;·&nbsp; - - - dashed = side-channel
        </span>
      </div>
    </div>
  );
}

export default CloudArchitectureDiagram;

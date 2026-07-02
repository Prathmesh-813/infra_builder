"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AWS_REGIONS,
  AZURE_REGIONS,
  GCP_REGIONS,
  AWS_INSTANCE_TYPES,
  AZURE_VM_TYPES,
  GCP_MACHINE_TYPES,
  getServicesFor,
  getRegionTriplet,
  getServiceLabel,
  getServicePrice,
  type CloudId,
  type ServiceId,
  type ServicePriceResult,
  type CrossCloudRegions,
} from "@/lib/kubernetes/cloud-cost";
import { CloudArchitectureDiagram } from "./CloudArchitectureDiagram";
import { TerraformDownload } from "./TerraformDownload";
import { DeploymentDownload } from "./DeploymentDownload";
import type { DeploymentSvcConfig } from "@/lib/kubernetes/deployment-generator";
import {
  ServiceConfigurator,
  DEFAULT_SERVICE_CONFIG,
  type ServiceConfig,
} from "./ServiceConfigurator";
import {
  ALT_CLOUDS,
  getAltCloudServicePrice,
  type AltCloudId,
} from "@/lib/kubernetes/cloud-cost-alt";

interface CloudOption {
  id: CloudId;
  label: string;
  accent: string;
  flag: string;
  regions: { value: string; label: string }[];
  instanceTypes: { id: string; label: string }[];
}

const CLOUDS: CloudOption[] = [
  { id: "eks", label: "AWS",          flag: "🟠", accent: "#ea580c", regions: AWS_REGIONS,   instanceTypes: AWS_INSTANCE_TYPES },
  { id: "aks", label: "Azure",        flag: "🔵", accent: "#326ce5", regions: AZURE_REGIONS,  instanceTypes: AZURE_VM_TYPES },
  { id: "gke", label: "Google Cloud", flag: "🟢", accent: "#16a34a", regions: GCP_REGIONS,    instanceTypes: GCP_MACHINE_TYPES },
];

interface ComparisonRow {
  serviceId: ServiceId;
  aws: ServicePriceResult;
  azure: ServicePriceResult;
  gcp: ServicePriceResult;
}

const sel: React.CSSProperties = { marginTop: "0.3rem", padding: "0.5rem 0.65rem", borderRadius: "0.5rem", border: "1px solid var(--card-border)", fontSize: "0.85rem" };

export function CostingExplorer() {
  // ── cloud & region ───────────────────────────────────────────────────────────
  const [cloud, setCloud]   = useState<CloudOption>(CLOUDS[0]);
  const [region, setRegion] = useState(CLOUDS[0].regions[0].value);

  // ── service selection & search ───────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<ServiceId>>(new Set(["control-plane"]));
  const [searchQuery, setSearchQuery] = useState("");

  // ── per-service configuration ─────────────────────────────────────────────────
  const [svcConfig, setSvcConfig] = useState<ServiceConfig>({
    ...DEFAULT_SERVICE_CONFIG,
    instanceType: CLOUDS[0].instanceTypes[2].id,
  });

  function setConfig<K extends keyof ServiceConfig>(key: K, value: ServiceConfig[K]) {
    setSvcConfig(prev => ({ ...prev, [key]: value }));
    setComparisonRows(null);
  }

  // Legacy aliases so buildParams still works without major changes
  const instanceType    = svcConfig.instanceType;
  const serverlessSize  = svcConfig.serverlessSize;
  const blockStorageType = svcConfig.blockStorageType;
  const blockStorageGb   = svcConfig.blockStorageGb;
  const fileStorageType  = svcConfig.fileStorageType;
  const fileStorageGb    = svcConfig.fileStorageGb;
  const registryGb       = svcConfig.registryGb;
  const objectStorageGb  = svcConfig.objectStorageGb;
  const dataTransferGb   = svcConfig.dataTransferGb;
  const cdnGb            = svcConfig.cdnGb;
  const snapshotGb       = svcConfig.snapshotGb;
  const functionsMillions  = svcConfig.functionsMillions;
  const apiCallsMillions   = svcConfig.apiCallsMillions;
  const eventBusMillions   = svcConfig.eventBusMillions;

  const deploySvc: DeploymentSvcConfig = {
    dbEngine:        svcConfig.dbEngine,
    dbVersion:       svcConfig.dbVersion,
    cacheEngine:     svcConfig.cacheEngine,
    cacheNodeType:   svcConfig.cacheNodeType,
    objectStorageGb: svcConfig.objectStorageGb,
  };

  // ── results ───────────────────────────────────────────────────────────────────
  const [comparisonRows,  setComparisonRows]  = useState<ComparisonRow[] | null>(null);
  const [mappedRegions,   setMappedRegions]   = useState<CrossCloudRegions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [inrRate, setInrRate] = useState(83.5);

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then((d: { rates?: { INR?: number } }) => {
        if (d.rates?.INR && d.rates.INR > 0) setInrRate(d.rates.INR);
      })
      .catch(() => { /* keep default 83.5 */ });
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────────
  const services = useMemo(() => getServicesFor(cloud.id), [cloud]);
  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(s => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  }, [services, searchQuery]);

  function pickCloud(c: CloudOption) {
    setCloud(c);
    setRegion(c.regions[0].value);
    setSvcConfig({ ...DEFAULT_SERVICE_CONFIG, instanceType: c.instanceTypes[2].id });
    setSelected(new Set(["control-plane"]));
    setComparisonRows(null);
    setSearchQuery("");
  }

  function toggleService(id: ServiceId) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setComparisonRows(null);
  }

  // ── fetch: all 3 clouds in parallel ──────────────────────────────────────────
  async function getCosting() {
    if (selected.size === 0) { setError("Select at least one service first."); return; }
    setLoading(true);
    setError(null);
    try {
      const triplet = getRegionTriplet(cloud.id, region);
      setMappedRegions(triplet);

      const rows: ComparisonRow[] = await Promise.all(
        Array.from(selected).map(async (id) => {
          function buildArgs(cloudId: CloudId, targetRegion: string) {
            const primary = cloudId === cloud.id;
            let instType: string | undefined;
            if (id === "vm-instance"        && primary) instType = instanceType;
            if (id === "serverless-compute" && primary) instType = serverlessSize;
            let stType: string | undefined;
            if (id === "block-storage" && primary) stType = blockStorageType;
            if (id === "file-storage"  && primary) stType = fileStorageType;
            let stGb: number | undefined;
            if      (id === "block-storage")  stGb = blockStorageGb;
            else if (id === "file-storage")   stGb = fileStorageGb;
            else if (id === "registry")       stGb = registryGb;
            else if (id === "object-storage") stGb = objectStorageGb;
            else if (id === "data-transfer")  stGb = dataTransferGb;
            else if (id === "cdn")            stGb = cdnGb;
            else if (id === "snapshot")       stGb = snapshotGb;
            else if (id === "functions")      stGb = functionsMillions;
            else if (id === "api-gateway")    stGb = apiCallsMillions;
            else if (id === "event-bus")      stGb = eventBusMillions;
            return { cloud: cloudId, service: id as ServiceId, region: targetRegion, instanceType: instType, storageType: stType, storageGb: stGb };
          }

          const fetchCloud = (cId: CloudId, reg: string) =>
            getServicePrice(buildArgs(cId, reg));

          const today = new Date().toISOString().slice(0, 10);
          const fallback = (cId: CloudId): ServicePriceResult => ({
            service: id,
            hourlyUsd: null,
            monthlyUsd: 0,
            source: "static",
            note: `Pricing unavailable for ${cId} — check network or try again`,
            asOf: today,
          });

          const [awsR, azureR, gcpR] = await Promise.allSettled([
            fetchCloud("eks", triplet.awsRegion),
            fetchCloud("aks", triplet.azureRegion),
            fetchCloud("gke", triplet.gcpRegion),
          ]);
          return {
            serviceId: id as ServiceId,
            aws:   awsR.status   === "fulfilled" ? awsR.value   : fallback("eks"),
            azure: azureR.status === "fulfilled" ? azureR.value : fallback("aks"),
            gcp:   gcpR.status   === "fulfilled" ? gcpR.value   : fallback("gke"),
          };
        })
      );

      setComparisonRows(rows);
    } catch (e) {
      setError("Pricing API error — " + (e instanceof Error ? e.message : "try again"));
    } finally {
      setLoading(false);
    }
  }

  // ── unified 8-cloud column definitions ───────────────────────────────────────
  const ALL_COLS: { id: string; label: string; flag: string; accent: string; isAlt: boolean }[] = [
    { id: "eks",     label: "AWS",       flag: "🟠", accent: "#ea580c", isAlt: false },
    { id: "aks",     label: "Azure",     flag: "🔵", accent: "#326ce5", isAlt: false },
    { id: "gke",     label: "GCP",       flag: "🟢", accent: "#16a34a", isAlt: false },
    { id: "ibm",     label: "IBM Cloud", flag: "🔷", accent: "#0f62fe", isAlt: true  },
    { id: "oci",     label: "Oracle",    flag: "🔴", accent: "#c74634", isAlt: true  },
    { id: "alibaba", label: "Alibaba",   flag: "🟠", accent: "#ff6a00", isAlt: true  },
    { id: "do",      label: "DO",        flag: "🌊", accent: "#0080ff", isAlt: true  },
    { id: "linode",  label: "Linode",    flag: "🟢", accent: "#00b050", isAlt: true  },
  ];

  // ── totals & cheapest ─────────────────────────────────────────────────────────
  const totalAws   = comparisonRows?.reduce((s, r) => s + r.aws.monthlyUsd,   0) ?? 0;
  const totalAzure = comparisonRows?.reduce((s, r) => s + r.azure.monthlyUsd, 0) ?? 0;
  const totalGcp   = comparisonRows?.reduce((s, r) => s + r.gcp.monthlyUsd,   0) ?? 0;

  function rowCheapest(prices: Record<string, number>): string | null {
    const nonZero = Object.entries(prices).filter(([, v]) => v > 0);
    if (nonZero.length === 0) return null;
    return nonZero.reduce((a, b) => a[1] <= b[1] ? a : b)[0];
  }

  const liveTag  = (src: string) => src === "live" || src === "live-cached";
  const srcBadge = (src: string) => (
    <span style={{ fontSize: "0.7rem", color: liveTag(src) ? "#16a34a" : "#94a3b8" }}>
      {liveTag(src) ? "● Live" : "○ Est."}
    </span>
  );

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <main className="app-shell">
      <h1 className="section-title">Cloud Service Costing — Compare All Clouds</h1>
      <p className="section-description">
        Choose a cloud and region, search and select services, configure them, then click{" "}
        <strong>Compare All Clouds</strong>. AWS, Azure, and Google Cloud prices appear side-by-side — regions
        automatically mapped to nearest geographic equivalents. Green = cheapest option per row.
      </p>

      {/* ── Step 1: Cloud + Region ─────────────────────────────────────────────── */}
      <h3 className="arch-trace__title" style={{ marginTop: "1.5rem" }}>1. Choose Primary Cloud &amp; Region</h3>
      <div className="wcc__scenarios" style={{ marginBottom: "0.75rem" }}>
        {CLOUDS.map(c => (
          <button key={c.id} onClick={() => pickCloud(c)} className="wcc__card"
            style={{ borderColor: c.accent, background: cloud.id === c.id ? `${c.accent}18` : "#fafafa", cursor: "pointer", textAlign: "left", width: "100%", font: "inherit" }}>
            <h3 className="wcc__card-title" style={{ color: c.accent }}>{c.flag} {c.label}</h3>
            <p className="wcc__text" style={{ margin: 0, fontSize: "0.78rem" }}>
              {c.id === "eks" ? "34 regions · Live pricing via AWS Price List API" :
               c.id === "aks" ? "39 regions · Live pricing via Azure Retail Prices API" :
               "37 regions · Static reference (no public API)"}
            </p>
          </button>
        ))}
      </div>
      <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", fontWeight: 600, maxWidth: "28rem" }}>
        Region — other clouds mapped to nearest equivalent automatically
        <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...sel, maxWidth: "28rem" }}>
          {cloud.regions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>

      {/* ── Step 2: Select services ────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2rem", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3 className="arch-trace__title" style={{ margin: 0 }}>2. Select Services</h3>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={() => { setSelected(new Set(services.map(s => s.id))); setComparisonRows(null); }}
            style={{ fontSize: "0.8rem", fontWeight: 600, color: cloud.accent, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
          <button onClick={() => { setSelected(new Set()); setComparisonRows(null); }}
            style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ position: "relative", maxWidth: "30rem", margin: "0.65rem 0 0.5rem" }}>
        <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem", pointerEvents: "none", opacity: 0.5 }}>🔍</span>
        <input
          type="text"
          placeholder={`Search ${services.length} services… e.g. "load balancer", "S3", "EventBridge"`}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "0.5rem 2rem 0.5rem 2.1rem", borderRadius: "0.6rem", border: "1px solid var(--card-border)", fontSize: "0.85rem", background: "#fafafa", boxSizing: "border-box" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}
            style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
        )}
      </div>
      {searchQuery && (
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0 0 0.4rem" }}>
          {filteredServices.length} of {services.length} services match
        </p>
      )}

      <div className="wcc__scenarios">
        {filteredServices.map(s => {
          const checked = selected.has(s.id);
          return (
            <label key={s.id} className="wcc__card"
              style={{ borderColor: cloud.accent, background: checked ? `${cloud.accent}14` : "#fafafa", cursor: "pointer", display: "block", width: "100%" }}>
              <h3 className="wcc__card-title" style={{ color: cloud.accent, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleService(s.id)} />
                {s.label}
              </h3>
              <p className="wcc__text">{s.desc}</p>
            </label>
          );
        })}
        {filteredServices.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "1rem 0" }}>
            No services match &ldquo;{searchQuery}&rdquo; — <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: cloud.accent, fontWeight: 600 }}>clear search</button>
          </p>
        )}
      </div>

      {/* ── Architecture preview — updates as services are selected ──────────── */}
      {selected.size > 0 && (
        <CloudArchitectureDiagram selected={selected} cloud={cloud.id} region={region} />
      )}

      {/* ── Step 3: Configure each selected service ───────────────────────────── */}
      {selected.size > 0 && (
        <>
          <h3 className="arch-trace__title" style={{ marginTop: "2rem" }}>3. Configure Selected Services</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0.25rem 0 0.85rem" }}>
            Expand each service card to set OS, engine, instance type, storage, and more.
            Changes are reflected in the cost comparison and the generated Terraform files.
          </p>
          <ServiceConfigurator
            selected={selected}
            cloud={cloud.id}
            config={svcConfig}
            onChange={setConfig}
            instanceTypes={cloud.instanceTypes}
          />

          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={getCosting} disabled={loading}
              style={{ padding: "0.65rem 1.5rem", borderRadius: "0.6rem", border: "none", background: cloud.accent, color: "white", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "wait" : "pointer" }}>
              {loading ? "Fetching prices…" : `4. Compare All Clouds (${selected.size} service${selected.size !== 1 ? "s" : ""})`}
            </button>
            {loading && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Fetching live prices from AWS, Azure &amp; GCP APIs…</span>}
          </div>
        </>
      )}

      {error && (
        <div className="arch-diagram__legend" style={{ borderColor: "#dc2626", marginBottom: "1rem" }}>
          <div>{error}</div>
        </div>
      )}

      {/* ── Step 4: Unified Cross-Cloud Comparison Table (all 8 clouds) ────────── */}
      {comparisonRows && mappedRegions && (
        <>
          <h3 className="arch-trace__title" style={{ marginTop: "1.5rem" }}>4. Side-by-Side Comparison — All Clouds</h3>

          {/* Region mapping banner */}
          <div style={{ background: "#f8fafc", border: "1px solid var(--card-border)", borderRadius: "0.6rem", padding: "0.65rem 0.9rem", marginBottom: "0.9rem", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "inherit" }}>Live regions:</strong>{" "}
            <span style={{ color: "#ea580c", fontWeight: 600 }}>🟠 AWS</span> {mappedRegions.awsRegion} ({mappedRegions.awsLabel})
            {" → "}
            <span style={{ color: "#326ce5", fontWeight: 600 }}>🔵 Azure</span> {mappedRegions.azureRegion} ({mappedRegions.azureLabel})
            {" → "}
            <span style={{ color: "#16a34a", fontWeight: 600 }}>🟢 GCP</span> {mappedRegions.gcpRegion} ({mappedRegions.gcpLabel})
            {" · "}IBM, Oracle, Alibaba, DO, Linode columns show static June 2026 reference prices — hover cells for notes.
            {" "}The <strong style={{ color: cloud.accent }}>selected cloud</strong> column is highlighted; <span style={{ color: "#16a34a" }}>↓</span> marks the cheapest per row.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="wcc__table" style={{ minWidth: "92rem" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "11rem" }}>Service</th>
                  {ALL_COLS.map(col => {
                    const isSelected = col.id === cloud.id;
                    return (
                      <th key={col.id} style={{
                        minWidth: "8.5rem",
                        color: col.accent,
                        fontWeight: isSelected ? 800 : 500,
                        background: isSelected ? `${col.accent}10` : undefined,
                        borderBottom: isSelected ? `3px solid ${col.accent}` : undefined,
                      }}>
                        <div>{col.flag} {col.label}</div>
                        {isSelected && <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.04em" }}>◀ SELECTED</div>}
                        {col.isAlt && !isSelected && <div style={{ fontSize: "0.62rem", color: "#94a3b8", fontWeight: 400 }}>○ Est.</div>}
                      </th>
                    );
                  })}
                  <th style={{ minWidth: "7.5rem", color: "#b45309" }}>💰 INR<br /><span style={{ fontSize: "0.65rem", fontWeight: 400 }}>({cloud.label})</span></th>
                  <th style={{ minWidth: "6.5rem" }}>Cheapest</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => {
                  const prices: Record<string, number> = {
                    eks: row.aws.monthlyUsd,
                    aks: row.azure.monthlyUsd,
                    gke: row.gcp.monthlyUsd,
                    ...Object.fromEntries(ALT_CLOUDS.map(c => [c.id, getAltCloudServicePrice(c.id as AltCloudId, row.serviceId).monthlyUsd])),
                  };
                  const cheapId = rowCheapest(prices);
                  const selectedPrice = cloud.id === "eks" ? row.aws.monthlyUsd : cloud.id === "aks" ? row.azure.monthlyUsd : row.gcp.monthlyUsd;

                  return (
                    <tr key={row.serviceId}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {getServiceLabel(cloud.id, row.serviceId)}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          <span title={row.aws.note}>AWS: {row.aws.service}</span>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          <span title={row.azure.note}>Az: {row.azure.service}</span>
                        </div>
                      </td>
                      {ALL_COLS.map(col => {
                        const price = prices[col.id];
                        const isSelected = col.id === cloud.id;
                        const isCheapest = col.id === cheapId;
                        const mainResult = col.id === "eks" ? row.aws : col.id === "aks" ? row.azure : col.id === "gke" ? row.gcp : null;
                        const altResult = col.isAlt ? getAltCloudServicePrice(col.id as AltCloudId, row.serviceId) : null;
                        return (
                          <td key={col.id} title={altResult?.note ?? mainResult?.note ?? ""} style={{
                            background: isSelected ? `${col.accent}12` : undefined,
                            borderLeft: isSelected ? `3px solid ${col.accent}` : undefined,
                          }}>
                            <div style={{ fontWeight: isSelected ? 700 : 400, fontSize: "0.85rem" }}>
                              ${price.toFixed(2)}
                              {isCheapest && price > 0 && (
                                <span title="Cheapest for this service" style={{ color: "#16a34a", marginLeft: "0.35rem", fontSize: "0.75rem" }}>↓</span>
                              )}
                              {price === 0 && <span style={{ color: "#16a34a", fontSize: "0.72rem", marginLeft: "0.3rem" }}>Free</span>}
                            </div>
                            {mainResult?.hourlyUsd !== null && mainResult?.hourlyUsd !== undefined && (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>${mainResult.hourlyUsd.toFixed(4)}/hr</div>
                            )}
                            {altResult?.hourlyUsd !== null && altResult?.hourlyUsd !== undefined && altResult.hourlyUsd > 0 && (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>${altResult.hourlyUsd.toFixed(4)}/hr</div>
                            )}
                            <div style={{ marginTop: "0.15rem" }}>
                              {mainResult ? srcBadge(mainResult.source) : <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>○ Est.</span>}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ background: "#fffbeb" }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.85rem" }}>
                          ₹{Math.round(selectedPrice * inrRate).toLocaleString("en-IN")}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                          @ ₹{inrRate.toFixed(1)}/$
                        </div>
                      </td>
                      <td>
                        {cheapId ? (() => {
                          const cheapCol = ALL_COLS.find(c => c.id === cheapId);
                          return cheapCol ? (
                            <span style={{ color: cheapCol.accent, fontWeight: 700, fontSize: "0.82rem" }}>
                              {cheapCol.flag} {cheapCol.label}
                            </span>
                          ) : null;
                        })() : <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const altTotals = Object.fromEntries(
                    ALT_CLOUDS.map(c => [c.id, comparisonRows.reduce((s, r) => s + getAltCloudServicePrice(c.id as AltCloudId, r.serviceId).monthlyUsd, 0)])
                  );
                  const allTotals: Record<string, number> = { eks: totalAws, aks: totalAzure, gke: totalGcp, ...altTotals };
                  const cheapTotalId = rowCheapest(allTotals);
                  const cheapTotalCol = cheapTotalId ? ALL_COLS.find(c => c.id === cheapTotalId) : null;
                  const selectedTotal = cloud.id === "eks" ? totalAws : cloud.id === "aks" ? totalAzure : totalGcp;
                  return (
                    <tr style={{ borderTop: "2px solid var(--card-border)", fontWeight: 700 }}>
                      <td>TOTAL ({comparisonRows.length} service{comparisonRows.length !== 1 ? "s" : ""})</td>
                      {ALL_COLS.map(col => {
                        const total = allTotals[col.id];
                        const isSelected = col.id === cloud.id;
                        const isCheapest = col.id === cheapTotalId;
                        return (
                          <td key={col.id} style={{
                            color: col.accent,
                            fontWeight: isSelected ? 700 : 400,
                            background: isSelected ? `${col.accent}12` : undefined,
                            borderLeft: isSelected ? `3px solid ${col.accent}` : undefined,
                          }}>
                            ${total.toFixed(2)}
                            {isCheapest && <span style={{ color: "#16a34a", marginLeft: "0.3rem" }}>↓</span>}
                          </td>
                        );
                      })}
                      <td style={{ background: "#fffbeb" }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.82rem" }}>
                          ₹{Math.round(selectedTotal * inrRate).toLocaleString("en-IN")}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                          {cloud.label} · @ ₹{inrRate.toFixed(1)}/$
                        </div>
                      </td>
                      <td>
                        {cheapTotalCol ? (
                          <span style={{ color: cheapTotalCol.accent, fontWeight: 700, fontSize: "0.82rem" }}>
                            {cheapTotalCol.flag} {cheapTotalCol.label}
                          </span>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          <p className="wcc__text" style={{ marginTop: "0.6rem", fontSize: "0.8rem" }}>
            ● Live = fetched in real-time from the provider&apos;s public API (no auth required).{" "}
            ○ Est. = static reference price (July 2026) for IBM, Oracle, Alibaba, DO, Linode — always verify on the provider&apos;s pricing page.{" "}
            Prices exclude taxes, support plans, reserved/committed-use discounts, and free-tier credits.{" "}
            INR rate fetched from open.er-api.com. Highlighted column = your selected primary cloud. ↓ = cheapest per row across all 8 clouds.
          </p>
        </>
      )}

      {/* ── Step 6: Terraform Download ───────────────────────────────────────── */}
      {selected.size > 0 && (
        <TerraformDownload selected={selected} cloud={cloud.id} region={region} />
      )}

      {/* ── Step 6: Deployment files ─────────────────────────────────────────── */}
      {selected.size > 0 && (
        <DeploymentDownload
          selected={selected}
          cloud={cloud.id}
          region={region}
          svc={deploySvc}
        />
      )}
    </main>
  );
}

export default CostingExplorer;

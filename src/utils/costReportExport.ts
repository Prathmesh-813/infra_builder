import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import type { ComparisonResult } from './costComparisonEngine';
import { PROVIDER_META } from '../data/costComparisonData';

export interface ExportServiceConfig {
  serviceId: string;
  serviceName: string;
  category: string;
  configs: Array<{
    provider: string;
    providerLabel: string;
    fields: Record<string, string | number | boolean>;
  }>;
}

export interface ExportData {
  date: string;
  totalCosts: Record<string, number>;
  services: Array<{
    name: string;
    category: string;
    providers: Array<{
      name: string;
      cost: number;
      basis: string;
      isWinner: boolean;
    }>;
    winner: string;
    savings: number;
  }>;
  configDetails: ExportServiceConfig[];
}

function sanitizeProvider(id: string): 'aws' | 'azure' | 'gcp' | 'onprem' {
  if (id === 'aws' || id === 'azure' || id === 'gcp' || id === 'onprem') return id;
  return 'aws';
}

export function buildExportData(
  results: ComparisonResult[],
  providerTotals: { id: string; total: number }[],
  configDetails?: ExportServiceConfig[],
): ExportData {
  const totalCosts: Record<string, number> = {};
  for (const t of providerTotals) {
    totalCosts[t.id] = t.total;
  }

  const services = results.map(r => {
    const avgs = r.providers.map(p => ({ ...p, avg: (p.monthlyMin + p.monthlyMax) / 2 }))
      .sort((a, b) => a.avg - b.avg);
    const minAvg = avgs[0]?.avg ?? 0;
    const maxAvg = avgs[avgs.length - 1]?.avg ?? 0;
    const savings = maxAvg > 0 ? Math.round((1 - minAvg / maxAvg) * 100) : 0;

    return {
      name: r.serviceName,
      category: r.category,
      providers: avgs.map(p => ({
        name: p.providerLabel,
        cost: p.avg,
        basis: p.basis,
        isWinner: p.avg === minAvg,
      })),
      winner: avgs[0]?.providerLabel ?? '',
      savings,
    };
  });

  return { date: new Date().toISOString(), totalCosts, services, configDetails: configDetails ?? [] };
}

export async function exportToPDF(element: HTMLElement, filename: string = 'cost-comparison-report') {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0f172a',
    logging: false,
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = pdfHeight;
  let position = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${filename}.pdf`);
}

export function exportToExcel(data: ExportData, filename: string = 'cost-comparison-report') {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows: (string | number)[][] = [
    ['Cost Comparison Report'],
    [`Generated: ${new Date(data.date).toLocaleString()}`],
    [],
    ['Provider', 'Total Monthly Cost'],
  ];
  for (const [id, total] of Object.entries(data.totalCosts)) {
    const meta = PROVIDER_META[sanitizeProvider(id)];
    summaryRows.push([meta?.label ?? id, Math.round(total)]);
  }
  summaryRows.push(
    [],
    ['* Costs are monthly estimates in USD'],
  );

  // Add yearly projections
  const grandTotal = Object.values(data.totalCosts).reduce((s, v) => s + v, 0);
  summaryRows.push(
    [],
    ['Annual Projection'],
    ['1-Year Total', `$${Math.round(grandTotal * 12).toLocaleString()}`],
    ['3-Year Total', `$${Math.round(grandTotal * 36).toLocaleString()}`],
    ['5-Year Total', `$${Math.round(grandTotal * 60).toLocaleString()}`],
  );

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Per-service detail
  const detailRows: (string | number)[][] = [
    ['Service', 'Category', 'Provider', 'Monthly Cost', 'Configuration Basis', 'Best Value', 'Savings %'],
  ];
  for (const svc of data.services) {
    for (const p of svc.providers) {
      detailRows.push([
        svc.name,
        svc.category,
        p.name,
        Math.round(p.cost),
        p.basis,
        p.isWinner ? 'Yes' : '',
        p.isWinner ? `${svc.savings}%` : '',
      ]);
    }
  }
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, detailSheet, 'Services');

  // Auto-size columns
  const colWidths = detailRows[0].map((_, i) => ({
    wch: Math.max(...detailRows.map(r => String(r[i] ?? '').length)) + 2,
  }));
  detailSheet['!cols'] = colWidths;

  // Configuration Details sheet
  if (data.configDetails.length > 0) {
    const configRows: (string | number | boolean)[][] = [
      ['Configuration Details'],
      [`Generated: ${new Date(data.date).toLocaleString()}`],
      [],
      ['Service', 'Category', 'Provider', 'Parameter', 'Value'],
    ];
    for (const svc of data.configDetails) {
      for (const cfg of svc.configs) {
        for (const [key, val] of Object.entries(cfg.fields)) {
          configRows.push([svc.serviceName, svc.category, cfg.providerLabel, key, val]);
        }
      }
    }
    const configSheet = XLSX.utils.aoa_to_sheet(configRows);
    const configColWidths = configRows[0].map((_, i) => ({
      wch: Math.max(...configRows.map(r => String(r[i] ?? '').length)) + 2,
    }));
    configSheet['!cols'] = configColWidths;
    XLSX.utils.book_append_sheet(wb, configSheet, 'Configuration');
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

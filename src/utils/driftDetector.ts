import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';

export interface ParsedResource {
  type: string;
  name: string;
  provider: string;
  attributes: Record<string, string>;
}

export interface DriftItem {
  resourceType: string;
  resourceName: string;
  status: 'synced' | 'drifted' | 'missing' | 'untracked';
  generatedAttrs: Record<string, string>;
  realAttrs: Record<string, string>;
  diffAttrs: Array<{
    key: string;
    generated: string;
    real: string;
    changed: boolean;
  }>;
}

export interface DriftReport {
  items: DriftItem[];
  summary: {
    synced: number;
    drifted: number;
    missing: number;
    untracked: number;
    total: number;
  };
}

function stripQuotes(s: string): string {
  return s.replace(/^"/, '').replace(/"$/, '');
}

function normalizeValue(v: string): string {
  return stripQuotes(v.trim()).replace(/\s+/g, ' ');
}

export function parseHCLResources(hcl: string): ParsedResource[] {
  const resources: ParsedResource[] = [];
  const regex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*)\}/gs;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(hcl)) !== null) {
    const type = match[1];
    const name = match[2];
    const body = match[3];
    const attrs: Record<string, string> = {};

    const attrRegex = /^\s{2}(\w[\w_]*)\s*=\s*(.+?)\s*$/gm;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(body)) !== null) {
      const val = attrMatch[2].trim();
      if (!val.startsWith('{') && !val.startsWith('[')) {
        attrs[attrMatch[1]] = normalizeValue(val);
      }
    }

    resources.push({ type, name, provider: '', attributes: attrs });
  }

  return resources;
}

export function parseTFState(tfstate: string): ParsedResource[] {
  const resources: ParsedResource[] = [];

  try {
    const parsed = JSON.parse(tfstate);
    const rawResources = parsed.values?.root_module?.resources ?? parsed.resources ?? [];

    for (const res of rawResources) {
      if (res.mode !== 'managed') continue;

      const instances = res.instances ?? [res];
      for (const inst of instances) {
        const attrs: Record<string, string> = {};
        const attributes = inst.attributes ?? inst;

        for (const [k, v] of Object.entries(attributes)) {
          if (v !== null && typeof v !== 'object' && v !== undefined) {
            attrs[k] = String(v);
          }
        }

        resources.push({
          type: res.type ?? res.resource_type ?? '',
          name: res.name ?? '',
          provider: res.provider ?? '',
          attributes: attrs,
        });
      }
    }
  } catch {
    // Invalid JSON
  }

  return resources;
}

function getComparableAttrs(attrs: Record<string, string>): Record<string, string> {
  const skipKeys = new Set(['id', 'arn', 'tags_all', 'tags', 'owner_id', 'vpc_id']);
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (!skipKeys.has(k)) {
      result[k] = v;
    }
  }
  return result;
}

export function detectDrift(
  _generatedNodes: Node<ResourceNodeData>[],
  realResources: ParsedResource[],
  generatedCode: string,
): DriftReport {
  const generated = parseHCLResources(generatedCode);
  const items: DriftItem[] = [];
  const matchedKeys = new Set<string>();

  for (const gen of generated) {
    const real = realResources.find(
      r => r.type === gen.type && (r.name === gen.name || r.attributes.name === gen.name),
    );

    if (!real) {
      items.push({
        resourceType: gen.type,
        resourceName: gen.name,
        status: 'missing',
        generatedAttrs: gen.attributes,
        realAttrs: {},
        diffAttrs: Object.entries(gen.attributes).map(([k, v]) => ({
          key: k,
          generated: v,
          real: '',
          changed: true,
        })),
      });
      continue;
    }

    matchedKeys.add(`${real.type}.${real.name}`);

    const genComp = getComparableAttrs(gen.attributes);
    const realComp = getComparableAttrs(real.attributes);
    const allKeys = new Set([...Object.keys(genComp), ...Object.keys(realComp)]);
    const diffAttrs: DriftItem['diffAttrs'] = [];
    let hasDiff = false;

    for (const k of allKeys) {
      const gv = genComp[k] ?? '';
      const rv = realComp[k] ?? '';
      const changed = gv !== rv;
      if (changed) hasDiff = true;
      diffAttrs.push({ key: k, generated: gv, real: rv, changed });
    }

    items.push({
      resourceType: gen.type,
      resourceName: gen.name,
      status: hasDiff ? 'drifted' : 'synced',
      generatedAttrs: gen.attributes,
      realAttrs: real.attributes,
      diffAttrs,
    });
  }

  for (const real of realResources) {
    const key = `${real.type}.${real.name}`;
    if (!matchedKeys.has(key)) {
      items.push({
        resourceType: real.type,
        resourceName: real.name,
        status: 'untracked',
        generatedAttrs: {},
        realAttrs: real.attributes,
        diffAttrs: Object.entries(real.attributes).map(([k, v]) => ({
          key: k,
          generated: '',
          real: v,
          changed: true,
        })),
      });
    }
  }

  const summary = { synced: 0, drifted: 0, missing: 0, untracked: 0, total: items.length };
  for (const item of items) summary[item.status]++;

  return { items, summary };
}

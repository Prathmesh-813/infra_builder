/**
 * Lightweight HCL parser for Terraform resource blocks.
 * Parses `resource "type" "name" { ... }` blocks and extracts
 * key configuration values. Supports nested blocks and simple types.
 */

export interface ParsedResource {
  resourceType: string;
  resourceName: string;
  config: Record<string, string | number | boolean>;
}

/**
 * Simple regex-based HCL parser that extracts resource blocks
 * and their top-level config fields.
 */
export function parseHCL(hcl: string): ParsedResource[] {
  const results: ParsedResource[] = [];

  // Match: resource "type" "name" {
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = resourceRegex.exec(hcl)) !== null) {
    const resourceType = match[1];
    const resourceName = match[2];
    const blockStart = match.index;
    const blockBody = extractBlockBody(hcl, blockStart + match[0].length - 1);

    if (blockBody === null) continue;

    const config = extractConfig(blockBody);

    // Only include if we found meaningful config
    if (Object.keys(config).length > 0) {
      results.push({ resourceType, resourceName, config });
    }
  }

  return results;
}

/**
 * Extract the body of a block starting at `openBraceIndex` (the { character).
 * Returns the text between matching { }.
 */
function extractBlockBody(hcl: string, openBraceIndex: number): string | null {
  let depth = 1;
  let i = openBraceIndex + 1;
  while (i < hcl.length && depth > 0) {
    if (hcl[i] === '{') depth++;
    else if (hcl[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return hcl.slice(openBraceIndex + 1, i - 1);
}

/**
 * Extract key = value pairs from a block body.
 * Handles: strings, numbers, booleans, simple nested blocks.
 */
function extractConfig(body: string): Record<string, string | number | boolean> {
  const config: Record<string, string | number | boolean> = {};

  // Match: key = "value" (strings)
  const stringRegex = /^\s*(\w+)\s*=\s*"([^"]*)"\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = stringRegex.exec(body)) !== null) {
    const key = m[1];
    // Skip fields that are computed references (contain dots)
    if (!m[2].includes('.')) {
      config[key] = m[2];
    }
  }

  // Match: key = number or key = true/false
  const literalRegex = /^\s*(\w+)\s*=\s*(\d+|true|false)\s*$/gm;
  while ((m = literalRegex.exec(body)) !== null) {
    const key = m[1];
    const val = m[2];
    if (val === 'true') config[key] = true;
    else if (val === 'false') config[key] = false;
    else config[key] = Number(val);
  }

  // Match: key = [ "val1", "val2" ] → store as comma-separated string
  const arrayRegex = /^\s*(\w+)\s*=\s*\[([^\]]*)\]\s*$/gm;
  while ((m = arrayRegex.exec(body)) !== null) {
    const key = m[1];
    const items = m[2].split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean);
    if (items.length > 0) {
      config[key] = items.join(',');
    }
  }

  // Extract "tags" block: tags = { Name = "..." ... }
  const tagsBlockRegex = /tags\s*=\s*\{([^}]*)\}/;
  const tagsMatch = body.match(tagsBlockRegex);
  if (tagsMatch) {
    const tagNameMatch = tagsMatch[1].match(/Name\s*=\s*"([^"]+)"/);
    if (tagNameMatch) {
      config.tags_name = tagNameMatch[1];
    }
  }

  return config;
}

/**
 * Update a canvas node's config based on parsed HCL data.
 * Returns the updated config merged with the existing one.
 */
export function mergeParsedConfig(
  parsed: ParsedResource,
  existingConfig: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const merged = { ...existingConfig };

  for (const [key, value] of Object.entries(parsed.config)) {
    // Only update fields that the existing config already has (or add new ones)
    merged[key] = value;
  }

  return merged;
}

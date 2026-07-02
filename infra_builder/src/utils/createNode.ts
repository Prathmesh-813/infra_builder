// Shared node factory so the drag-drop, the add-node panel, and edge-splice all
// create canvas nodes the same way (default config from the definition's fields,
// a clean snake_case name, and a unique id).
import type { Node } from 'reactflow';
import type { ResourceDefinition, ResourceNodeData } from '../types/resources';

let counter = Math.floor(Date.now() % 1_000_000) + 1;

export function createNode(
  definition: ResourceDefinition,
  position: { x: number; y: number },
): Node<ResourceNodeData> {
  const id = `node_${++counter}`;
  const defaultConfig: Record<string, string | number | boolean> = {};
  definition.fields.forEach((f) => {
    if (f.default !== undefined) defaultConfig[f.key] = f.default as string | number | boolean;
  });
  const cleanName = definition.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return {
    id,
    type: 'resourceNode',
    position,
    data: {
      resourceType: definition.type,
      resourceName: `${cleanName}_${counter}`,
      config: defaultConfig,
      definition,
    },
  };
}

// Auto-arrange the canvas with dagre's layered graph layout.
// Default direction is LR (left→right), which matches the nodes' left/right
// connection handles, so edges flow naturally across the board.
import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';

export type LayoutDirection = 'LR' | 'TB';

const DEFAULT_W = 230;
const DEFAULT_H = 120;

export function layoutWithDagre(
  nodes: Node<unknown>[],
  edges: Edge[],
  direction: LayoutDirection = 'LR',
): Node<unknown>[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 110, marginx: 24, marginy: 24 });

  nodes.forEach((n) => {
    // Use the real rendered size when ReactFlow has measured it; else a sensible default.
    g.setNode(n.id, { width: n.width ?? DEFAULT_W, height: n.height ?? DEFAULT_H });
  });
  edges.forEach((e) => {
    if (e.source && e.target) g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const w = n.width ?? DEFAULT_W;
    const h = n.height ?? DEFAULT_H;
    // dagre returns node centres; ReactFlow positions are top-left.
    return {
      ...n,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
      // Clear any stale absolute position so the new layout takes effect cleanly.
      positionAbsolute: undefined,
    };
  });
}

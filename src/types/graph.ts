export interface GraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    type?: string;
    label: string;
    fields?: Record<string, any>;
    config?: Record<string, any>;
  };
}

import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
} from 'reactflow';
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'ansible' | 'crossplane' | 'costcompare';
export type CrossplaneCloud = 'aws' | 'azure' | 'gcp';

interface AppState {
  nodes: Node<any>[];
  edges: Edge[];
  selectedNodeId: string | null;
  providerRegion: string;
  providerProfile: string;
  cloudProvider: CloudProvider;
  crossplaneCloud: CrossplaneCloud;

  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection | Edge) => void;
  addNode: (node: Node<any>) => void;
  setNodes: (nodes: Node<any>[]) => void;
  addBlueprint: (nodes: Node<any>[], edges: Edge[]) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setProviderRegion: (region: string) => void;
  setProviderProfile: (profile: string) => void;
  setCloudProvider: (provider: CloudProvider) => void;
  setCrossplaneCloud: (cloud: CrossplaneCloud) => void;
  clearCanvas: () => void;
}

// Coalesce rapid changes (e.g. a drag) into a single undo step.
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }) as T;
}

export const useStore = create<AppState>()(
  temporal(
    (set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  providerRegion: 'us-east-1',
  providerProfile: 'default',
  cloudProvider: 'aws',
  crossplaneCloud: 'aws',

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection: Connection | Edge) =>
    set((state) => ({ edges: addEdge(connection, state.edges) })),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  setNodes: (nodes) => set({ nodes }),

  addBlueprint: (newNodes, newEdges) =>
    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges],
    })),

  updateNodeConfig: (nodeId, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                config: { ...n.data.config, ...config } as Record<string, string | number | boolean>,
              },
            }
          : n
      ),
    })),

  updateNodeName: (nodeId, name) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, resourceName: name } } : n
      ),
    })),

  deleteNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    })),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setProviderRegion: (region) => set({ providerRegion: region }),
  setProviderProfile: (profile) => set({ providerProfile: profile }),
  setCloudProvider: (provider) => set({ cloudProvider: provider, nodes: [], edges: [], selectedNodeId: null }),
  setCrossplaneCloud: (cloud) => set({ crossplaneCloud: cloud }),
  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null }),
    }),
    {
      // Only node/edge changes are undoable; ignore selection/provider churn.
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      limit: 100,
      equality: (a, b) => a.nodes === b.nodes && a.edges === b.edges,
      handleSet: (handleSet) =>
        debounce(handleSet as (...args: never[]) => void, 250) as typeof handleSet,
    },
  ),
);

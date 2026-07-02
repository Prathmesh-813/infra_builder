// Coordinates the add-node panel between the canvas "+" FAB and the on-edge "+"
// insert buttons (which live in separate components). When opened from an edge,
// `spliceEdgeId` tells the Canvas to insert the chosen node into that edge.
import { create } from 'zustand';

interface BuilderUiState {
  pickerOpen: boolean;
  spliceEdgeId: string | null;
  openPicker: () => void;
  openPickerForEdge: (edgeId: string) => void;
  closePicker: () => void;
}

export const useBuilderUi = create<BuilderUiState>((set) => ({
  pickerOpen: false,
  spliceEdgeId: null,
  openPicker: () => set({ pickerOpen: true, spliceEdgeId: null }),
  openPickerForEdge: (edgeId) => set({ pickerOpen: true, spliceEdgeId: edgeId }),
  closePicker: () => set({ pickerOpen: false, spliceEdgeId: null }),
}));

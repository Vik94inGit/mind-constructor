// Reducer for useNodeDragAndDrop.ts's own drag UI state: the single-node
// drag position, the group-drag position map, and the circle-join drop
// target highlight. Three related useState calls before this — each one
// individually simple, but MapPage had to wire three separate setters (plus
// two refs) through as hook params to keep them in sync with each other.
// Consolidating them here lets the hook own this state outright and hand
// MapPage back one small, read-only slice instead.
export type Pt = { x: number; y: number };

export interface DragUIState {
  drag: { nodeId: string; x: number; y: number } | null;
  group: Map<string, Pt> | null;
  dropTarget: { nodeId: string; valid: boolean } | null;
}

export const initialDragUIState: DragUIState = { drag: null, group: null, dropTarget: null };

export type DragUIAction =
  // Clears all three at once — the shape every drag interaction ends in,
  // whether it settled (onUp), was cancelled by a touch long-press turning
  // into a multiselect toggle instead, or (implicitly, via groupClear)
  // finished as a group drag.
  | { type: "reset" }
  | { type: "dragSet"; nodeId: string; x: number; y: number }
  | { type: "dropTargetSet"; nodeId: string; valid: boolean }
  | { type: "dropTargetClear" }
  | { type: "groupStart"; positions: Map<string, Pt> }
  // Sets one member's position within the group map, falling back to
  // `fallback` (the drag's own startPositions snapshot) if the group
  // somehow isn't set yet — mirrors the defensive `prev ?? startPositions`
  // pattern the original per-field useState setters used, kept as-is rather
  // than assumed-safe-to-drop during this move.
  | { type: "groupSetMember"; id: string; pos: Pt; fallback: Map<string, Pt> }
  | { type: "groupClear" };

export function dragUIReducer(state: DragUIState, action: DragUIAction): DragUIState {
  switch (action.type) {
    case "reset":
      return initialDragUIState;
    case "dragSet":
      return { ...state, drag: { nodeId: action.nodeId, x: action.x, y: action.y } };
    case "dropTargetSet":
      return { ...state, dropTarget: { nodeId: action.nodeId, valid: action.valid } };
    case "dropTargetClear":
      return { ...state, dropTarget: null };
    case "groupStart":
      return { ...state, group: action.positions };
    case "groupSetMember": {
      const next = new Map(state.group ?? action.fallback);
      next.set(action.id, action.pos);
      return { ...state, group: next };
    }
    case "groupClear":
      return { ...state, group: null };
    default:
      return state;
  }
}

import { useReducer } from "react";

// The canvas's own interaction mode: at most one of choosing nodes, packing
// nodes into a container, or drawing a separator line is active at a time —
// each one takes over what a click on the canvas/a node means, and shares the
// bottom-sheet slot with the node panel. Previously five independent booleans/
// values per mode (chooseMode; packMode + packContainerId + packSelection +
// packError; drawMode + drawPoints + drawHover + drawBlocked + drawSaving),
// which could in principle drift out of sync with each other (packMode true
// with packContainerId still null, say). A discriminated union makes that
// state unrepresentable: a pack's container/picks/error only exist at all
// when `kind` is "pack", checked once by the type system instead of by every
// call site that touches them.
export interface Pt {
  x: number;
  y: number;
}

export type DrawBlockReason = "spot" | "crossing";

export type CanvasMode =
  | { kind: "none" }
  | { kind: "choose" }
  | { kind: "pack"; containerId: string; picks: Set<string>; error: string | null }
  | { kind: "draw"; points: Pt[]; hover: Pt | null; blocked: DrawBlockReason | null; saving: boolean };

export type CanvasModeAction =
  | { type: "reset" }
  | { type: "chooseStart" }
  | { type: "packStart"; containerId: string }
  // Toggles a node in or out of the current pack's picks, and clears any
  // stale "not eligible" error — same as picking a valid one always did.
  | { type: "packToggle"; nodeId: string }
  | { type: "packSetError"; error: string | null }
  | { type: "drawStart" }
  | { type: "drawAddPoint"; point: Pt }
  | { type: "drawUndoPoint" }
  | { type: "drawClearPoints" }
  | { type: "drawSetHover"; hover: Pt | null }
  | { type: "drawSetBlocked"; blocked: DrawBlockReason | null }
  | { type: "drawSetSaving"; saving: boolean };

const NONE: CanvasMode = { kind: "none" };

// Every action but "reset"/"...Start" is a no-op if the mode has since moved
// on to something else (or back to none) — e.g. a line-drawing action that
// resolves after the user has already exited draw mode just returns the
// current state unchanged, rather than resurrecting stale draw state. The
// *decision* of whether an action is currently allowed (is this node
// eligible to pack, is this point free to draw to, …) is made by the caller
// before dispatching — this reducer only ever applies what it's told.
function reducer(state: CanvasMode, action: CanvasModeAction): CanvasMode {
  switch (action.type) {
    case "reset":
      return NONE;
    case "chooseStart":
      return { kind: "choose" };
    case "packStart":
      return { kind: "pack", containerId: action.containerId, picks: new Set(), error: null };
    case "packToggle": {
      if (state.kind !== "pack") return state;
      const picks = new Set(state.picks);
      if (picks.has(action.nodeId)) picks.delete(action.nodeId);
      else picks.add(action.nodeId);
      return { ...state, picks, error: null };
    }
    case "packSetError":
      return state.kind === "pack" ? { ...state, error: action.error } : state;
    case "drawStart":
      return { kind: "draw", points: [], hover: null, blocked: null, saving: false };
    case "drawAddPoint":
      return state.kind === "draw" ? { ...state, points: [...state.points, action.point] } : state;
    case "drawUndoPoint":
      return state.kind === "draw" ? { ...state, points: state.points.slice(0, -1) } : state;
    case "drawClearPoints":
      return state.kind === "draw" ? { ...state, points: [] } : state;
    case "drawSetHover":
      return state.kind === "draw" ? { ...state, hover: action.hover } : state;
    case "drawSetBlocked":
      return state.kind === "draw" ? { ...state, blocked: action.blocked } : state;
    case "drawSetSaving":
      return state.kind === "draw" ? { ...state, saving: action.saving } : state;
    default:
      return state;
  }
}

export function useCanvasMode() {
  return useReducer(reducer, NONE);
}

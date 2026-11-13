import { useCallback, useReducer } from "react";
import type { NodeDoc } from "../types";

// The map's pop-up menus: a node's menu (right-click or hold on a node), a
// zone's menu (right-click or hold on a zone) and the canvas menu
// (right-click or hold on empty canvas). Only one is ever open, so they are
// one value instead of three: opening a menu replaces whichever was open, and
// no caller has to remember to close the other two first.
export type CanvasMenu =
  | { kind: "node"; node: NodeDoc; x: number; y: number }
  | { kind: "zone"; rootId: string; x: number; y: number }
  // Screen coordinates place the menu; canvas ones are where a new node goes.
  | { kind: "canvas"; screenX: number; screenY: number; canvasX: number; canvasY: number };

export type CanvasMenuAction = { type: "open"; menu: CanvasMenu } | { type: "close" };

/** Exported for direct unit testing; useCanvasMenu is this reducer in useReducer. */
export function canvasMenuReducer(state: CanvasMenu | null, action: CanvasMenuAction): CanvasMenu | null {
  switch (action.type) {
    case "open":
      return action.menu;
    case "close":
      return state === null ? state : null;
    default:
      return state;
  }
}

export function useCanvasMenu() {
  const [menu, dispatch] = useReducer(canvasMenuReducer, null);
  const openMenu = useCallback((next: CanvasMenu) => dispatch({ type: "open", menu: next }), []);
  const closeMenu = useCallback(() => dispatch({ type: "close" }), []);
  return {
    openMenu,
    closeMenu,
    nodeMenu: menu?.kind === "node" ? menu : null,
    zoneMenu: menu?.kind === "zone" ? menu : null,
    canvasMenu: menu?.kind === "canvas" ? menu : null,
  };
}

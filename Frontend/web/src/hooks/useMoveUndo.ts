import { useCallback, useEffect, useRef, useState } from "react";
import * as nodesApi from "../api/nodes";
import type { NodeDoc } from "../types";
import { nodeRefId } from "../utils/nodeType";

// Undo for moves on the map: every drag records where its nodes were before
// (their icon spot, puzzle-card spot and parent), and undo puts the last one
// back — Ctrl+Z / Cmd+Z, or the undo button. Other changes (deleting a node)
// share the same stack through recordUndo, with their own way back. Kept per page visit, newest
// last, capped so a long session doesn't hold on to everything.
const MAX_STEPS = 50;

export type MoveSnapshot = Pick<NodeDoc, "nodeId" | "x" | "y" | "cardX" | "cardY" | "parentId">;

/** A change other than a move: how to take it back, and what to say if that fails. */
interface CustomStep {
  run: () => Promise<void>;
  errorMessage: string;
}
type Step = MoveSnapshot[] | CustomStep;

function snapshotOf(n: NodeDoc): MoveSnapshot {
  return { nodeId: n.nodeId, x: n.x, y: n.y, cardX: n.cardX, cardY: n.cardY, parentId: n.parentId };
}

/**
 * The fields that put a node back: its spots, and — only when the drag
 * changed it — its parent as a plain id (what PATCH takes).
 */
export function restorePatch(s: MoveSnapshot, current?: NodeDoc): Partial<NodeDoc> {
  const patch: Partial<NodeDoc> = { x: s.x, y: s.y, cardX: s.cardX ?? null, cardY: s.cardY ?? null };
  const before = nodeRefId(s.parentId) ?? null;
  if (current && (nodeRefId(current.parentId) ?? null) !== before) patch.parentId = before;
  return patch;
}

interface Params {
  nodes: NodeDoc[];
  upsertNode: (node: NodeDoc) => void;
  setActionError: (message: string | null) => void;
  errorMessage: string;
  /** Off while typing, presenting or in another mode that owns the keyboard. */
  keysEnabled: boolean;
}

export function useMoveUndo({ nodes, upsertNode, setActionError, errorMessage, keysEnabled }: Params) {
  const stack = useRef<Step[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [depth, setDepth] = useState(0);

  const recordMove = useCallback((before: NodeDoc[]) => {
    if (before.length === 0) return;
    stack.current.push(before.map(snapshotOf));
    if (stack.current.length > MAX_STEPS) stack.current.shift();
    setDepth(stack.current.length);
  }, []);

  const recordUndo = useCallback((run: () => Promise<void>, failMessage: string) => {
    stack.current.push({ run, errorMessage: failMessage });
    if (stack.current.length > MAX_STEPS) stack.current.shift();
    setDepth(stack.current.length);
  }, []);

  const undo = useCallback(async () => {
    const step = stack.current.pop();
    setDepth(stack.current.length);
    if (!step) return;
    setActionError(null);
    if (!Array.isArray(step)) {
      try {
        await step.run();
      } catch {
        setActionError(step.errorMessage);
      }
      return;
    }
    try {
      const restored = await Promise.all(step.map((s) => nodesApi.updateNode(s.nodeId, restorePatch(s, nodesRef.current.find((n) => n.nodeId === s.nodeId)))));
      restored.forEach(upsertNode);
    } catch {
      setActionError(errorMessage);
    }
  }, [upsertNode, setActionError, errorMessage]);

  useEffect(() => {
    if (!keysEnabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "z" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      // Text fields keep their own undo.
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      e.preventDefault();
      void undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keysEnabled, undo]);

  return { recordMove, recordUndo, undo, canUndo: depth > 0 };
}

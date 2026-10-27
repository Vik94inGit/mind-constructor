import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { linksToMove, takeParentPlace, redirectRefusal } from "../utils/edgeRedirect";
import type { HeadPatch, RedirectRefusal } from "../utils/edgeRedirect";
import { nodeRefId, zoneParentId } from "../utils/nodeType";
import type { Translation } from "../i18n/translations";
import type { CanvasMode, CanvasModeAction } from "./useCanvasMode";
import type { EdgeDoc, NodeDoc } from "../types";

type NewLink = Parameters<typeof edgesApi.createEdge>[1];

interface Params {
  mapId: string | undefined;
  mode: CanvasMode;
  dispatchMode: Dispatch<CanvasModeAction>;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  posFor: (node: NodeDoc) => { x: number; y: number };
  /** useNodeDragAndDrop's own saves: a branch moved to a new parent, and a head plan. */
  redirectParent: (child: NodeDoc, parent: NodeDoc) => Promise<boolean>;
  saveHeadPlan: (patches: HeadPatch[]) => Promise<boolean>;
  setEdges: Dispatch<SetStateAction<EdgeDoc[]>>;
  upsertEdge: (edge: EdgeDoc) => void;
  refreshInsights: (mapId: string) => void;
  setActionError: (message: string | null) => void;
  setContextMenu: (menu: null) => void;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  t: Translation;
}

// Changing a parent as its own mode: Change parent on the node's panel puts
// the panel and the ghosts away, and the next node tapped becomes the parent.
// The child's branch moves to it, and so does its link to the old parent
// (utils/edgeRedirect.ts linksToMove). Swap with parent goes through here too.
export function useReparent({
  mapId,
  mode,
  dispatchMode,
  nodes,
  edges,
  isOwnNode,
  posFor,
  redirectParent,
  saveHeadPlan,
  setEdges,
  upsertEdge,
  refreshInsights,
  setActionError,
  setContextMenu,
  setSelectedId,
  setMultiSelectIds,
  t,
}: Params) {
  const reparentMode = mode.kind === "reparent";
  const reparentError = mode.kind === "reparent" ? mode.error : null;
  const reparentChild = mode.kind === "reparent" ? (nodes.find((n) => n.nodeId === mode.childId) ?? null) : null;
  useEffect(() => {
    if (reparentMode && !reparentChild) dispatchMode({ type: "reset" });
  }, [reparentMode, reparentChild, dispatchMode]);
  // Escape leaves it, like Cancel.
  useEffect(() => {
    if (!reparentMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatchMode({ type: "reset" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reparentMode, dispatchMode]);

  function refusalMessage(reason: RedirectRefusal): string {
    if (reason === "same") return t.ui.canvas.reparentSame;
    if (reason === "ownBranch") return t.ui.errors.dropOnOwnBranch;
    if (reason === "attack") return t.ui.errors.attackParent;
    return t.ui.errors.parentNotOwn;
  }
  function startReparent(child: NodeDoc) {
    setContextMenu(null);
    setActionError(null);
    setSelectedId(null);
    setMultiSelectIds(new Set());
    dispatchMode({ type: "reparentStart", childId: child.nodeId });
  }
  // A node tapped while in the mode.
  function pickNewParent(node: NodeDoc) {
    if (!reparentChild || node.nodeId === reparentChild.nodeId) return;
    // Its own parent tapped: it takes that parent's place instead.
    if (node.nodeId === zoneParentId(reparentChild)) {
      const plan = takeParentPlace(reparentChild, nodes, edges, isOwnNode, posFor);
      if (typeof plan === "string") {
        dispatchMode({ type: "reparentSetError", error: refusalMessage(plan) });
        return;
      }
      dispatchMode({ type: "reset" });
      void headZone(reparentChild);
      return;
    }
    const refusal = redirectRefusal(reparentChild, node, nodes, isOwnNode);
    if (refusal) {
      dispatchMode({ type: "reparentSetError", error: refusalMessage(refusal) });
      return;
    }
    dispatchMode({ type: "reset" });
    void reparentTo(reparentChild, node);
  }
  // A child swapped with its parent (Swap with parent on its panel, or the
  // parent tapped in reparent mode): it takes the parent's place, the
  // zone's nodes and the old parent hang from it, and the old parent's links
  // move to it (utils/edgeRedirect.ts takeParentPlace).
  async function headZone(child: NodeDoc) {
    if (!mapId) return;
    const plan = takeParentPlace(child, nodes, edges, isOwnNode, posFor);
    if (!plan) return;
    if (typeof plan === "string") {
      setActionError(refusalMessage(plan));
      return;
    }
    if (!(await saveHeadPlan(plan.patches))) return;
    await moveLinks(plan);
  }
  async function moveLinks(links: { remove: EdgeDoc[]; create: NewLink[] }) {
    if (!mapId) return;
    try {
      for (const e of links.remove) {
        await edgesApi.deleteEdge(e.edgeId);
        setEdges((prev) => prev.filter((x) => x.edgeId !== e.edgeId));
      }
      for (const link of links.create) upsertEdge(await edgesApi.createEdge(mapId, link));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.removeLink);
    } finally {
      refreshInsights(mapId);
    }
  }
  async function reparentTo(child: NodeDoc, parent: NodeDoc) {
    if (!mapId) return;
    const links = linksToMove(child.nodeId, nodeRefId(child.parentId) ?? null, parent.nodeId, edges);
    if (!(await redirectParent(child, parent))) return;
    await moveLinks(links);
  }

  return { reparentMode, reparentChild, reparentError, startReparent, pickNewParent, headZone };
}

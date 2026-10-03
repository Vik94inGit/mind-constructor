import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import {
  CANVAS_W,
  CANVAS_H,
  avoidOverlap,
  getCirclePackSpacing,
  nodeObstacles,
  pickNonOverlappingPosition,
} from "../utils/canvasLayout";
import type { Obstacle, ViewportBounds } from "../utils/canvasLayout";
import { layoutTemplate } from "../utils/templates";
import type { TemplateKind, TemplateNodeKey } from "../utils/templates";
import { sleep } from "../utils/sleep";
import type { Translation } from "../i18n/translations";
import type { NodeDoc, NodeType } from "../types";

type Pt = { x: number; y: number };

// A node not yet created — its text is still being typed into the inline
// input hovering at (x,y), styled with `type`'s icon. Nothing is sent to the
// backend until that input confirms with real text (see
// PendingNodeCard/confirmPendingCreate). parentId set only when reached via
// the right-click menu's "Create branch" or a quick-add ghost; null (the
// toolbar's own "+ Add node" button) means a regular, parent-less node.
export interface PendingCreate {
  x: number;
  y: number;
  type: NodeType;
  parentId: string | null;
  /** A ghost template's starter phrase the input opens with. */
  text?: string;
}

// applyTemplate's own reveal pace — long enough that each node in a growing
// template branch reads as its own discrete step (plus its celebrate burst),
// not a flash of everything at once.
const TEMPLATE_NODE_STAGGER_MS = 250;

interface Params {
  mapId: string | undefined;
  positions: Map<string, Pt>;
  pendingCreate: PendingCreate | null;
  setPendingCreate: Dispatch<SetStateAction<PendingCreate | null>>;
  upsertNode: (node: NodeDoc) => void;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setActionError: (message: string | null) => void;
  obstaclePoints: (exclude?: Set<string>) => Pt[];
  bigNodeObstacles: (excludeRootIds?: Set<string>) => Obstacle[];
  viewportBounds: () => ViewportBounds;
  showNodes: (ids: string[]) => void;
  showNotice: (message: string) => void;
  /** Pushes whatever the just-placed nodes cover out of their way — see useStructureGuard. */
  keepStructure?: (pinned: Map<string, Pt>, added?: NodeDoc[]) => Promise<void>;
  t: Translation;
}

export function useNodeCreation({
  mapId,
  positions,
  pendingCreate,
  setPendingCreate,
  upsertNode,
  setCelebrateIds,
  setSelectedId,
  setMultiSelectIds,
  setActionError,
  obstaclePoints,
  bigNodeObstacles,
  viewportBounds,
  showNodes,
  showNotice,
  keepStructure,
  t,
}: Params) {
  // Grows a template branch (see utils/templates.ts) from `root`: every node
  // is a real node with its prompt as title + text, created parents-first so
  // each one can hang from the previous, geometrized in a ring around `root`
  // (layoutTemplate's own "around the king" placement) rather than appearing
  // all at once — each one gets its own celebrate burst (same creation
  // effect confirmPendingCreate uses) and a deliberate pause before the
  // next, so growing a whole template branch reads as it building itself
  // step by step instead of popping in as a single flash.
  async function applyTemplate(kind: TemplateKind, root: NodeDoc) {
    if (!mapId) return;
    const rootPos = positions.get(root.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    // Same obstacle set createCircle's own children-fanning uses (plain
    // nodes, root included explicitly, plus every existing zone backdrop) —
    // without it, layoutTemplate had no idea what else was already on the
    // canvas near root and could spiral its nodes straight on top of it.
    const placed = layoutTemplate(
      kind,
      rootPos,
      [...nodeObstacles([...obstaclePoints(), rootPos]), ...bigNodeObstacles()],
    );
    // The template keeps its shape: anything already sitting where it grows
    // is moved aside first, so the new branch never lands on top of it.
    const planId = (key: TemplateNodeKey) => `template:${key}`;
    await keepStructure?.(
      new Map([[root.nodeId, rootPos], ...placed.map((p) => [planId(p.key), { x: p.x, y: p.y }] as [string, Pt])]),
      placed.map(
        (p) =>
          ({
            nodeId: planId(p.key),
            type: p.type,
            x: p.x,
            y: p.y,
            parentId: p.parentKey ? planId(p.parentKey) : root.nodeId,
          }) as NodeDoc,
      ),
    );
    const ids = new Map<TemplateNodeKey, string>();
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const copy = t.ui.templates.nodes[p.key];
      const node = await nodesApi.createNode(mapId, {
        text: copy.text,
        title: copy.title,
        type: p.type,
        order: p.order,
        x: p.x,
        y: p.y,
        parentId: p.parentKey ? ids.get(p.parentKey) : root.nodeId,
      });
      ids.set(p.key, node.nodeId);
      upsertNode(node);
      setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
      if (i < placed.length - 1) await sleep(TEMPLATE_NODE_STAGGER_MS);
    }
    // Brings the whole newly-grown ring into view — spiraling out from root
    // can easily land later nodes past whatever's currently on-screen.
    showNodes(Array.from(ids.values()));
    showNotice(t.ui.templates.created(placed.length));
  }

  // Fires once the inline pending-node input (see PendingNodeCard) actually
  // confirms with non-empty text — the one place any node-creation path
  // (toolbar, double-click, "Create branch", quick-add) ends up.
  async function confirmPendingCreate(text: string, type: NodeType) {
    if (!pendingCreate || !mapId) return;
    const { x, y, parentId } = pendingCreate;
    setActionError(null);
    try {
      const node = await nodesApi.createNode(mapId, { text, type, x, y, parentId });
      upsertNode(node);
      setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
      // The new node stays where it was put; whatever it covers moves aside.
      void keepStructure?.(new Map([[node.nodeId, { x, y }]]), [node]);
      // Deselect rather than select the freshly-created node — same "close
      // the panel after creating a node" behavior NodePanel's own
      // handleAttack/handleProtect follow, applied to every other
      // node-creation path (toolbar, double-click, quick-add) that ends up
      // here too. Used to select it instead, opening its panel right away;
      // this leaves the canvas clear so the create-flow itself reads as
      // finished rather than immediately handing you another panel.
      setSelectedId(null);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createNode);
    } finally {
      setPendingCreate(null);
    }
  }

  // AddMenu's "Create circle" — a root plus 2 children, parented to it, so
  // the result is an instant, already-formed circle (nodeGroups needs 2+
  // direct children) rather than needing to branch twice by hand.
  // Sequential, not Promise.all: the children's own create calls need the
  // root's real (server-assigned) nodeId as their parentId, so the root
  // has to actually finish first.
  async function createCircle() {
    if (!mapId) return;
    setActionError(null);
    try {
      const rootPos = pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
      const root = await nodesApi.createNode(mapId, {
        text: t.ui.canvas.newCircleText,
        type: "unknown",
        x: rootPos.x,
        y: rootPos.y,
        parentId: null,
      });
      upsertNode(root);
      setCelebrateIds((prev) => new Set(prev).add(root.nodeId));

      // Two children fanned either side of straight up from the root —
      // same angle-from-vertical idea QuickAddGhosts' own ring uses, just
      // two fixed slots instead of one per node type. getCirclePackSpacing
      // (not getNodeMinDist), same reasoning as layoutTemplate's own switch
      // — these two are deliberately fanned around a shared root, not two
      // unrelated nodes that happened to land near each other.
      const radius = getCirclePackSpacing();
      const children = await Promise.all(
        [-50, 50].map(async (deg) => {
          const angle = (-90 + deg) * (Math.PI / 180);
          const desired = { x: rootPos.x + radius * Math.cos(angle), y: rootPos.y + radius * Math.sin(angle) };
          const placed = avoidOverlap(
            desired,
            [...nodeObstacles([...obstaclePoints(), rootPos]), ...bigNodeObstacles()],
            viewportBounds(),
          );
          return nodesApi.createNode(mapId, {
            // "Option" (not "unknown", like the root) — an all-"unknown"
            // trio would still draw a zone now (circleSentiment returns
            // "neutral" for a tied/no-vote group instead of skipping it —
            // see nodeGroups' own doc comment), but a flat gray backdrop is
            // a duller first impression than an actual colored one. Giving
            // both children a real (positive) type up front means "Create
            // circle" shows a leaning, halo-colored circle immediately.
            text: t.ui.canvas.newNodeText,
            type: "Option",
            x: placed.x,
            y: placed.y,
            parentId: root.nodeId,
          });
        }),
      );
      children.forEach((c) => {
        upsertNode(c);
        setCelebrateIds((prev) => new Set(prev).add(c.nodeId));
      });
      const circle = [root, ...children];
      void keepStructure?.(new Map(circle.map((n) => [n.nodeId, { x: n.x ?? rootPos.x, y: n.y ?? rootPos.y }])), circle);

      setMultiSelectIds(new Set());
      setSelectedId(root.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createCircle);
    }
  }

  return { confirmPendingCreate, applyTemplate, createCircle };
}

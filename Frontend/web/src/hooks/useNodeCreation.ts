import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { CANVAS_W, CANVAS_H, getCirclePackSpacing, nodeObstacles } from "../utils/canvasLayout";
import type { Obstacle, ViewportBounds } from "../utils/canvasLayout";
import { NEW_NODE_ID } from "../utils/zoneRules";
import type { ExtraNode, MovingNode } from "../utils/zoneRules";
import { layoutTemplate, MAP_KIND_ROOTS } from "../utils/templates";
import type { TemplateKind, TemplateNodeKey } from "../utils/templates";
import { sleep } from "../utils/sleep";
import type { Translation } from "../i18n/translations";
import type { MapKind, NodeDoc, NodeType } from "../types";

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

// What "Text → nodes" (map/TextToNodesModal.tsx) asks to have made: the
// whole text as an optional main node, each marked piece as a node (hanging
// from the main node when there is one), placed on the free spots it already
// found — the main node on the first. Pieces listed in `packed` didn't get a
// spot of their own: they're folded into the main node right away.
export interface TextNodesPlan {
  text: string;
  rootType: NodeType;
  withRoot: boolean;
  pieces: { id: string; text: string; type: NodeType }[];
  packed: Set<string>;
  spots: Pt[];
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
  /** Where `moving` lands when put at `desired`, under the zone rules (utils/zoneRules.ts). */
  placeNode: (desired: Pt, moving: MovingNode[], extra?: ExtraNode[]) => Pt;
  viewportBounds: () => ViewportBounds;
  showNodes: (ids: string[]) => void;
  showNotice: (message: string) => void;
  /** Opens a just-created node's panel on its text field, ready to write more (see confirmPendingCreate). */
  openNewNode: (node: NodeDoc, at: Pt) => void;
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
  placeNode,
  viewportBounds,
  showNodes,
  showNotice,
  openNewNode,
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
  async function applyTemplate(kind: TemplateKind, root: NodeDoc, at?: Pt) {
    if (!mapId) return;
    // `at`: a root created a moment ago isn't in `positions` yet.
    const rootPos = at ?? positions.get(root.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    // Same obstacle set createCircle's own children-fanning uses (plain
    // nodes, root included explicitly, plus every existing zone backdrop) —
    // without it, layoutTemplate had no idea what else was already on the
    // canvas near root and could spiral its nodes straight on top of it.
    const placed = layoutTemplate(
      kind,
      rootPos,
      [...nodeObstacles([...obstaclePoints(), rootPos]), ...bigNodeObstacles()],
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
      // The new node's panel opens straight away on its text field, so the
      // short line typed into the inline input can grow into the full text
      // (and pictures) without a second click.
      openNewNode(node, { x, y });
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
      // The whole circle's spots are worked out before creating anything, so
      // each child is placed knowing where the root and its sibling are and
      // the zone they make follows the zone rules (see placeNode).
      const view = viewportBounds();
      const rootPos = placeNode({ x: (view.minX + view.maxX) / 2, y: (view.minY + view.maxY) / 2 }, [
        { nodeId: NEW_NODE_ID, parentId: null },
      ]);
      // Two children fanned either side of straight up from the root —
      // same angle-from-vertical idea QuickAddGhosts' own ring uses, just
      // two fixed slots instead of one per node type. getCirclePackSpacing
      // (not getNodeMinDist), same reasoning as layoutTemplate's own switch
      // — these two are deliberately fanned around a shared root, not two
      // unrelated nodes that happened to land near each other.
      const ROOT_ID = `${NEW_NODE_ID}:root`;
      const radius = getCirclePackSpacing();
      const placedSoFar: ExtraNode[] = [{ nodeId: ROOT_ID, parentId: null, pos: rootPos }];
      const childPositions = [-50, 50].map((deg, i) => {
        const angle = (-90 + deg) * (Math.PI / 180);
        const desired = { x: rootPos.x + radius * Math.cos(angle), y: rootPos.y + radius * Math.sin(angle) };
        const pos = placeNode(desired, [{ nodeId: `${NEW_NODE_ID}:${i}`, parentId: ROOT_ID }], placedSoFar);
        placedSoFar.push({ nodeId: `${NEW_NODE_ID}:${i}`, parentId: ROOT_ID, pos });
        return pos;
      });
      const root = await nodesApi.createNode(mapId, {
        text: t.ui.canvas.newCircleText,
        type: "unknown",
        x: rootPos.x,
        y: rootPos.y,
        parentId: null,
      });
      upsertNode(root);
      setCelebrateIds((prev) => new Set(prev).add(root.nodeId));

      const children = await Promise.all(
        childPositions.map((placed) =>
          nodesApi.createNode(mapId, {
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
          }),
        ),
      );
      children.forEach((c) => {
        upsertNode(c);
        setCelebrateIds((prev) => new Set(prev).add(c.nodeId));
      });

      setMultiSelectIds(new Set());
      setSelectedId(root.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createCircle);
    }
  }

  // The empty canvas's right-click menu ("Analyze a problem", "Plan a goal"…):
  // the same starter structure a new map of that kind is seeded with (see
  // utils/seedMap.ts), grown right where the user clicked — its root node
  // first, then the rest of the template around it.
  async function growStructure(kind: MapKind, desired: Pt) {
    if (!mapId) return;
    setActionError(null);
    const root = MAP_KIND_ROOTS[kind];
    const pos = placeNode(desired, [{ nodeId: NEW_NODE_ID, parentId: null }]);
    try {
      const copy = t.ui.templates.nodes[root.key];
      const rootNode = await nodesApi.createNode(mapId, {
        text: copy.text,
        title: copy.title,
        type: root.type,
        x: pos.x,
        y: pos.y,
        parentId: null,
      });
      upsertNode(rootNode);
      setCelebrateIds((prev) => new Set(prev).add(rootNode.nodeId));
      setSelectedId(null);
      await sleep(TEMPLATE_NODE_STAGGER_MS);
      await applyTemplate(root.template, rootNode, pos);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createNode);
    }
  }

  // "Text → nodes": makes everything a TextNodesPlan asks for, in order — the
  // main node first (the pieces need its real id as their parent), then each
  // piece on its spot, then packs the pieces that didn't fit into the main
  // node in one request. Throws on failure; the modal shows the error.
  async function createFromText(plan: TextNodesPlan, onProgress?: (done: number, total: number) => void) {
    if (!mapId) return;
    setActionError(null);
    const total = (plan.withRoot ? 1 : 0) + plan.pieces.length;
    let done = 0;
    const shownIds: string[] = [];
    let rootId: string | null = null;
    let spot = 0;
    if (plan.withRoot) {
      const at = plan.spots[spot++];
      const root = await nodesApi.createNode(mapId, { text: plan.text, type: plan.rootType, x: at.x, y: at.y, parentId: null });
      rootId = root.nodeId;
      upsertNode(root);
      setCelebrateIds((prev) => new Set(prev).add(root.nodeId));
      shownIds.push(root.nodeId);
      onProgress?.(++done, total);
    }
    // Pieces that get a spot first, so the ones about to be packed (created
    // on the main node's own spot) are on the canvas for as short a moment
    // as possible before they fold away.
    const ordered = [...plan.pieces.filter((p) => !plan.packed.has(p.id)), ...plan.pieces.filter((p) => plan.packed.has(p.id))];
    const packedIds: string[] = [];
    for (const piece of ordered) {
      const isPacked = plan.packed.has(piece.id) && rootId !== null;
      const at = isPacked ? plan.spots[0] : plan.spots[spot++];
      const node = await nodesApi.createNode(mapId, { text: piece.text, type: piece.type, x: at.x, y: at.y, parentId: rootId });
      upsertNode(node);
      if (isPacked) {
        packedIds.push(node.nodeId);
      } else {
        setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
        shownIds.push(node.nodeId);
      }
      onProgress?.(++done, total);
    }
    if (rootId && packedIds.length > 0) {
      const res = await nodesApi.packNodes(rootId, packedIds);
      upsertNode(res.container);
      res.members.forEach(upsertNode);
    }
    setMultiSelectIds(new Set());
    setSelectedId(null);
    showNodes(shownIds);
    showNotice(t.ui.textNodes.created(total, packedIds.length));
  }

  return { confirmPendingCreate, applyTemplate, createCircle, growStructure, createFromText };
}

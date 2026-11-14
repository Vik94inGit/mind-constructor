import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { CANVAS_W, CANVAS_H, NODE_FOOTPRINT, getCirclePackSpacing, nodeObstacles } from "../utils/canvasLayout";
import type { Obstacle, ViewportBounds } from "../utils/canvasLayout";
import { MIN_NODE_GAP, NEW_NODE_ID } from "../utils/zoneRules";
import type { ExtraNode, MovingNode } from "../utils/zoneRules";
import { layoutTemplate, MAP_KIND_ROOTS } from "../utils/templates";
import { addStructurePicture } from "../utils/structurePicture";
import type { TemplateKind, TemplateNodeKey } from "../utils/templates";
import { sleep } from "../utils/sleep";
import { layoutPicture, newPictureId, pictureNodeType } from "../utils/pictures";
import type { PictureKind } from "../utils/pictures";
import { piecesParentsFirst } from "../utils/textSplit";
import { splitNodeText } from "../utils/nodeText";
import { boxObstacle } from "../utils/drawnBox";
import type { CanvasBox } from "../utils/drawnBox";
import type { Translation } from "../i18n/translations";
import type { MapKind, NodeDoc, NodeType } from "../types";
import { track } from "../utils/usage";
import * as offline from "../offline/sync";

type Pt = { x: number; y: number };

/** What a leveled template grew: the questions of its first round, shown now, and how many rounds wait behind it. */
interface TemplateRounds {
  shown: number;
  later: number;
}

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
  /** A starter phrase picked from the quick-add ring — the new node's prompt (its placeholder), never its text. */
  prompt?: string;
  /** Picked from the emoji ghost ring (QuickAddGhosts) — optional: writing the text straight away makes the node without one. */
  emoji?: string;
}

// What "Text → nodes" (map/TextToNodesModal.tsx) asks to have made: the
// whole text as an optional main node, each marked piece as a node (hanging
// from the main node when there is one), placed on the free spots it already
// found — the main node on the first. A piece can instead hang from another
// piece (which becomes its parent) or from a node already on the map, and
// then it's placed beside that node rather than on a spot. Pieces listed in
// `packed` didn't get a spot of their own: they're folded into the main node
// right away.
export interface TextNodesPlan {
  text: string;
  rootType: NodeType;
  withRoot: boolean;
  /** A node on the map the main node hangs from; null for none. */
  rootParentId?: string | null;
  /** parentId: another piece's id or a node already on the map; absent means the main node. */
  pieces: { id: string; text: string; type: NodeType; parentId?: string }[];
  packed: Set<string>;
  spots: Pt[];
  /**
   * Splitting a node already on the map: its pieces hang from it, and when
   * `text` is a string the node keeps only that (what no piece took).
   */
  splitNode?: { nodeId: string; text: string | null };
}

// applyTemplate's own reveal pace — long enough that each node in a growing
// template branch reads as its own discrete step (plus its celebrate burst),
// not a flash of everything at once.
const TEMPLATE_NODE_STAGGER_MS = 250;
// A picture's dots come in quicker: there are more of them, and they read as
// one drawing being dotted out rather than a structure growing.
const PICTURE_DOT_STAGGER_MS = 120;

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
  placeNode: (desired: Pt, moving: MovingNode[], extra?: ExtraNode[], opts?: { obstacles?: Obstacle[] }) => Pt;
  /** What a node really covers on the canvas now (utils/drawnBox.ts), when it's drawn. */
  drawnBoxOf?: (nodeId: string) => CanvasBox | null;
  viewportBounds: () => ViewportBounds;
  showNodes: (ids: string[]) => void;
  /** Frames the view on these canvas points (useCanvasFraming's showPoints). */
  showPoints: (pts: Pt[]) => void;
  showNotice: (message: string) => void;
  /** Called once a node is made (see confirmPendingCreate): the moment it's written, before the server has answered. */
  onCreated: (node: NodeDoc, at: Pt) => void;
  /**
   * Puts the saved node in place of the draft shown while it was on its way
   * (`node` null: takes the draft away, the create failed).
   */
  replaceNode: (draftId: string, node: NodeDoc | null) => void;
  /**
   * A template or a picture has grown: every node it made, to take back in one
   * step (Undo, or the notice's own button), with the notice to show.
   */
  onStructureMade?: (ids: string[], message: string) => void;
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
  showPoints,
  showNotice,
  onCreated,
  replaceNode,
  onStructureMade,
  drawnBoxOf,
  t,
}: Params) {
  // Grows a template branch (see utils/templates.ts) from `root`: every node
  // is a ghost: empty text and no title, only its prompt (shown as the
  // node's placeholder until someone writes in it), created parents-first so
  // each one can hang from the previous, geometrized in a ring around `root`
  // (layoutTemplate's own "around the king" placement) rather than appearing
  // all at once — each one gets its own celebrate burst (same creation
  // effect confirmPendingCreate uses) and a deliberate pause before the
  // next, so growing a whole template branch reads as it building itself
  // step by step instead of popping in as a single flash.
  // `made` collects each node's id as it lands, so a template cut short can
  // still be taken back.
  // Only the first round shows straight away (a later one stays off the map
  // until it opens, hooks/useLevelReveal.ts), so only it is staggered in and
  // framed; what it returns is what the notice tells about the rounds.
  async function growTemplate(kind: TemplateKind, root: NodeDoc, made: string[], at?: Pt): Promise<TemplateRounds | undefined> {
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
    const firstLevel = Math.min(...placed.map((p) => p.level));
    const rounds = new Set(placed.map((p) => p.level)).size;
    const shown: string[] = [];
    const ids = new Map<TemplateNodeKey, string>();
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const node = await nodesApi.createNode(mapId, {
        text: "",
        prompt: t.ui.templates.nodes[p.key],
        type: p.type,
        order: p.order,
        level: p.level,
        x: p.x,
        y: p.y,
        parentId: p.parentKey ? ids.get(p.parentKey) : root.nodeId,
      });
      ids.set(p.key, node.nodeId);
      made.push(node.nodeId);
      upsertNode(node);
      if (p.level !== firstLevel) continue;
      shown.push(node.nodeId);
      setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
      if (placed.slice(i + 1).some((q) => q.level === firstLevel)) await sleep(TEMPLATE_NODE_STAGGER_MS);
    }
    // Brings the newly-grown first ring into view — spiraling out from root
    // can easily land later nodes past whatever's currently on-screen.
    showNodes(shown);
    return { shown: shown.length, later: rounds - 1 };
  }

  // Whatever a template or picture made, offered back in one step.
  function structureMade(made: string[], rounds?: TemplateRounds) {
    if (made.length === 0) return;
    const message =
      rounds && rounds.later > 0 && rounds.shown > 0
        ? t.ui.templates.createdRounds(rounds.shown, rounds.later)
        : t.ui.templates.created(made.length);
    if (onStructureMade) onStructureMade(made, message);
    else showNotice(message);
  }

  // A template grown from a node already on the map (its panel): the node stays if it's undone.
  async function applyTemplate(kind: TemplateKind, root: NodeDoc, at?: Pt) {
    const made: string[] = [];
    let rounds: TemplateRounds | undefined;
    try {
      rounds = await growTemplate(kind, root, made, at);
    } finally {
      structureMade(made, rounds);
    }
  }

  // Fires once the inline pending-node input (see PendingNodeCard) actually
  // confirms with non-empty text — the one place any node-creation path
  // (toolbar, double-click, "Create branch", quick-add) ends up.
  // Empty text with a prompt makes a ghost (see NodeDoc.ghost).
  // The node lands on the map at once, as a draft under a temporary id
  // (api/nodes.ts draftNode), and the panel closes: nobody waits on the
  // server to see what they just wrote. Once the server answers, the saved
  // node takes the draft's place (same card, no second burst); if it
  // refuses, the draft goes and the error shows.
  // `overflow`: pasted text that didn't fit (utils/nodeText.ts), to go into
  // new nodes carrying on from this one once it's made (see carryText).
  async function confirmPendingCreate(text: string, type: NodeType, images: string[] = [], prompt?: string, overflow?: string) {
    if (!pendingCreate || !mapId) return;
    const { x, y, parentId, emoji } = pendingCreate;
    setActionError(null);
    const input = { text, type, x, y, parentId, ...(emoji ? { emoji } : {}), ...(prompt ? { prompt } : {}) };
    const draft: NodeDoc = { ...nodesApi.draftNode(mapId, input), ...(images.length ? { images } : {}) };
    track({ name: "node_created", props: { type } });
    upsertNode(draft);
    setCelebrateIds((prev) => new Set(prev).add(draft.nodeId));
    setPendingCreate(null);
    // The text was written in NewNodePanel already, so nothing opens
    // after it: the node lands and the map is in view again.
    onCreated(draft, { x, y });
    let made: NodeDoc | null = null;
    try {
      let node = await nodesApi.createNode(mapId, input);
      // Pictures added while writing it (NewNodePanel) go on once it exists.
      if (images.length) node = await nodesApi.updateNode(node.nodeId, { images });
      offline.noteSaved(draft.nodeId, node.nodeId);
      replaceNode(draft.nodeId, node);
      setSelectedId((prev) => (prev === draft.nodeId ? node.nodeId : prev));
      setMultiSelectIds((prev) => (prev.has(draft.nodeId) ? new Set([...prev].map((id) => (id === draft.nodeId ? node.nodeId : id))) : prev));
      made = node;
    } catch (err) {
      replaceNode(draft.nodeId, null);
      setSelectedId((prev) => (prev === draft.nodeId ? null : prev));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createNode);
    }
    if (made && overflow) await carryText(made, overflow, { x, y });
  }

  // Text that ran past a node's limit (MAX_NODE_TEXT), carried on into new
  // nodes: as many as it takes, every one hanging from `from` and of its
  // type, and numbered in reading order (Node.order: `from` is 1 unless it
  // already has a number, the pieces count on from it). They're laid out in
  // a row under `from`, clear of everything `from` really draws — a node
  // shown as a card covers far more than an icon (see utils/drawnBox.ts) —
  // and of each other, under the zone rules.
  // Resolves false if a node couldn't be made (the error is shown).
  async function carryText(from: NodeDoc, rest: string, at?: Pt): Promise<boolean> {
    if (!mapId) return false;
    const pieces = splitNodeText(rest);
    if (pieces.length === 0) return true;
    setActionError(null);
    const fromAt = at ?? positions.get(from.nodeId) ?? { x: from.x ?? CANVAS_W / 2, y: from.y ?? CANVAS_H / 2 };
    const box = drawnBoxOf?.(from.nodeId) ?? null;
    const obstacles = box ? [boxObstacle(box, MIN_NODE_GAP * 4)] : [];
    const firstOrder = from.order ?? 1;
    const placed: ExtraNode[] = [];
    const made: string[] = [];
    // Each piece is first tried right of the one before, the first under `from`.
    let desired: Pt = { x: fromAt.x, y: box ? box.y + box.h / 2 + NODE_FOOTPRINT.h / 2 + MIN_NODE_GAP * 4 : fromAt.y + NODE_FOOTPRINT.h };
    try {
      if (from.order == null) upsertNode(await nodesApi.updateNode(from.nodeId, { order: firstOrder }));
      for (let i = 0; i < pieces.length; i++) {
        const pos = placeNode(desired, [{ nodeId: NEW_NODE_ID, parentId: from.nodeId }], placed, { obstacles });
        const node = await nodesApi.createNode(mapId, {
          text: pieces[i],
          type: from.type,
          x: pos.x,
          y: pos.y,
          parentId: from.nodeId,
          order: Math.min(9999, firstOrder + i + 1),
        });
        upsertNode(node);
        setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
        placed.push({ nodeId: node.nodeId, parentId: from.nodeId, pos });
        made.push(node.nodeId);
        desired = { x: pos.x + NODE_FOOTPRINT.w + MIN_NODE_GAP * 4, y: pos.y };
      }
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.textOverflow.failed);
      return false;
    } finally {
      if (made.length) showNodes([from.nodeId, ...made]);
    }
    showNotice(t.ui.textOverflow.carried(made.length));
    return true;
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
    const made: string[] = [];
    let rounds: TemplateRounds | undefined;
    try {
      const rootNode = await nodesApi.createNode(mapId, {
        text: "",
        prompt: t.ui.templates.nodes[root.key],
        type: root.type,
        x: pos.x,
        y: pos.y,
        parentId: null,
      });
      made.push(rootNode.nodeId);
      upsertNode(rootNode);
      setCelebrateIds((prev) => new Set(prev).add(rootNode.nodeId));
      setSelectedId(null);
      // The kind's painting on the root, fetched while the rest grows round it.
      void addStructurePicture(rootNode.nodeId, kind).then((pictured) => pictured && upsertNode(pictured));
      await sleep(TEMPLATE_NODE_STAGGER_MS);
      const grown = await growTemplate(root.template, rootNode, made, pos);
      // Its root asks a question of its own too.
      rounds = grown && { ...grown, shown: grown.shown + 1 };
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createNode);
    } finally {
      structureMade(made, rounds);
    }
  }

  // "Draw a picture" (utils/pictures.ts): the picture's dots as ghosts, one
  // node per dot, centered as near `desired` as the map has room for. Each
  // ghost asks its own question about the picture's theme (a stop sign's are
  // all about what stops you), numbered like a connect-the-dots page,
  // and is the node type the picture stands for (a bulb's dots are Ideas, a
  // stop sign's Problems; a picture for fun is Ideas); none hangs from
  // another, so a picture never makes a zone.
  async function drawPicture(kind: PictureKind, desired: Pt) {
    if (!mapId) return;
    setActionError(null);
    const dots = layoutPicture(kind, desired, [...nodeObstacles(obstaclePoints()), ...bigNodeObstacles()]);
    track({ name: "picture_drawn" });
    const id = newPictureId();
    const questions = t.ui.pictures.questions[kind];
    const type = pictureNodeType(kind);
    setSelectedId(null);
    setMultiSelectIds(new Set());
    // The whole picture in view before its first dot lands, so it is seen being dotted out.
    showPoints(dots);
    const made: string[] = [];
    try {
      for (let dot = 0; dot < dots.length; dot++) {
        const node = await nodesApi.createNode(mapId, {
          text: "",
          prompt: `${dot + 1}. ${questions[dot % questions.length]}`,
          type,
          x: dots[dot].x,
          y: dots[dot].y,
          parentId: null,
          picture: { id, kind, dot },
        });
        made.push(node.nodeId);
        upsertNode(node);
        setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
        await sleep(PICTURE_DOT_STAGGER_MS);
      }
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.pictures.failed);
    } finally {
      structureMade(made);
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
      const root = await nodesApi.createNode(mapId, {
        text: plan.text,
        type: plan.rootType,
        x: at.x,
        y: at.y,
        parentId: plan.rootParentId ?? null,
      });
      rootId = root.nodeId;
      upsertNode(root);
      setCelebrateIds((prev) => new Set(prev).add(root.nodeId));
      shownIds.push(root.nodeId);
      onProgress?.(++done, total);
    }
    // Pieces that get a spot first, so the ones about to be packed (created
    // on the main node's own spot) are on the canvas for as short a moment
    // as possible before they fold away — but always parents before the
    // pieces hanging from them, so each one's parent already has its real id.
    const pieceIds = new Set(plan.pieces.map((p) => p.id));
    const createdIds = new Map<string, string>();
    // New nodes placed beside a map node so far — the next one keeps clear of them.
    const placedBeside: ExtraNode[] = [];
    const packedIds: string[] = [];
    const ordered = piecesParentsFirst([
      ...plan.pieces.filter((p) => !plan.packed.has(p.id)),
      ...plan.pieces.filter((p) => plan.packed.has(p.id)),
    ]);
    for (const piece of ordered) {
      const besideMapNode = !!piece.parentId && !pieceIds.has(piece.parentId);
      const parentId = !piece.parentId
        ? rootId
        : pieceIds.has(piece.parentId)
          ? (createdIds.get(piece.parentId) ?? rootId)
          : piece.parentId;
      const isPacked = !besideMapNode && plan.packed.has(piece.id) && rootId !== null;
      let at: Pt;
      if (besideMapNode) {
        const parentAt = positions.get(piece.parentId!) ?? plan.spots[0] ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
        at = placeNode(parentAt, [{ nodeId: NEW_NODE_ID, parentId }], placedBeside);
      } else {
        at = isPacked ? plan.spots[0] : plan.spots[spot++];
      }
      const node = await nodesApi.createNode(mapId, { text: piece.text, type: piece.type, x: at.x, y: at.y, parentId });
      createdIds.set(piece.id, node.nodeId);
      if (besideMapNode) placedBeside.push({ nodeId: node.nodeId, parentId, pos: at });
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
    if (plan.splitNode?.text) {
      upsertNode(await nodesApi.updateNode(plan.splitNode.nodeId, { text: plan.splitNode.text }));
    }
    setMultiSelectIds(new Set());
    setSelectedId(null);
    showNodes(shownIds);
    showNotice(t.ui.textNodes.created(total, packedIds.length));
  }

  return { confirmPendingCreate, carryText, applyTemplate, createCircle, growStructure, createFromText, drawPicture };
}

import { useEffect, useReducer, useRef } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import {
  avoidOverlap,
  footprintObstacles,
  CANVAS_H,
  CANVAS_W,
  dropTargetDistance,
  FULL_CANVAS_BOUNDS,
  getZoneReach,
  isDescendant,
} from "../utils/canvasLayout";
import type { NodeGroup, ViewportBounds } from "../utils/canvasLayout";
import type { ExtraNode, MovingNode } from "../utils/zoneRules";
import { nodeRefId, zoneParentId } from "../utils/nodeType";
import { storedSpots } from "../utils/cardSpace";
import { dragUIReducer, initialDragUIState } from "./dragUIState";
import type { Translation } from "../i18n/translations";
import type { NodeDoc } from "../types";
import type { Snap } from "../utils/cardGlue";
import { startTrail } from "../utils/followTrail";
import { MAGNET_BUTTON_FAR_FACTOR, MAGNET_FAR_FACTOR, magnetPulls } from "../utils/parentMagnet";
import type { Trail } from "../utils/followTrail";
import { redirectSpot } from "../utils/edgeRedirect";

type Pt = { x: number; y: number };

// How long after a long-press finger lifts its trailing click is still swallowed.
const LONG_PRESS_CLICK_GRACE_MS = 400;
// A member dragged within this many zone reaches (getZoneReach) of its root
// stays in its circle; only past that is it pulled out.
const MEMBER_REACH_FACTOR = 1.5;
// Holding a finger still this long on a node is a hold, not a tap.
const LONG_PRESS_MS = 500;
// How far a finger may wander before a press stops being a tap or a hold and
// becomes a drag. Below it the node stays put, so grazing one while tapping
// never moves it.
const TOUCH_DRAG_SLOP = 10;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;


interface Params {
  nodes: NodeDoc[];
  positions: Map<string, Pt>;
  nodeGroups: NodeGroup[];
  chooseMode: boolean;
  packMode: boolean;
  drawMode: boolean;
  multiSelectIds: Set<string>;
  moveMode: boolean;
  isOwnNode: (node: NodeDoc) => boolean;
  handleNodeClick: (node: NodeDoc, shiftKey?: boolean) => void;
  posFor: (node: NodeDoc) => Pt;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  viewportBounds: () => ViewportBounds;
  obstaclePoints: (exclude?: Set<string>) => Pt[];
  /** Where `moving` lands when dropped at `desired`, under the zone rules (utils/zoneRules.ts). */
  /** free: only keep clear of other nodes and their text, not the zone rules (a drag the user aimed). */
  placeNode: (desired: Pt, moving: MovingNode[], extra?: ExtraNode[], opts?: { free?: boolean }) => Pt;
  /** How much of the canvas a node covers at the current zoom (canvasLayout's freeFootprintScale). */
  footprintScale?: number;
  upsertNode: (node: NodeDoc) => void;
  setActionError: (message: string | null) => void;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  // Shared with the canvas's own marquee-select and every node's onClick
  // (see suppressNextClick's own doc comment in MapPage) — not
  // drag-specific, so it stays MapPage-owned and passed in, unlike
  // dragState/groupDragState/dropTarget/dragMoved/groupDragToken below,
  // which this hook now owns outright (see hooks/dragUIState.ts).
  suppressNextClick: MutableRefObject<boolean>;
  t: Translation;
  /** The fields that save a move of `node` to `pt` — its puzzle-card spot or its icon spot (utils/cardSpace.ts). Plain x/y when absent. */
  spotFor?: (node: NodeDoc, pt: Pt) => Partial<NodeDoc>;
  /** Cards glue together (utils/cardGlue.ts): where `node` dragged to (x,y) glues on, if a card is close. */
  snapFor?: (node: NodeDoc, x: number, y: number) => Snap | null;
  /** A card was dropped glued to another (`snap.partnerId`). */
  onSnapped?: (node: NodeDoc, snap: Snap) => void;
  /** Cards never pile up: where a card let go at (x,y) can sit clear of the others, or null for a node that isn't a card on the board. */
  clearSpotFor?: (node: NodeDoc, x: number, y: number) => Pt | null;
  /** Every node that moves along with `node` as one unit (a glued block), `node` first. */
  clusterFor?: (node: NodeDoc) => string[];
  /**
   * Touch: holding a node still. Return true when that was handled (a puzzle
   * card opens its menu — lock, detach…); otherwise the hold toggles the node
   * in or out of the multi-selection.
   */
  onHold?: (node: NodeDoc, clientX: number, clientY: number) => boolean;
  /** Its owner locked this text block (utils/blockLock.ts) — held in place like Node.locked. */
  isBlockLocked?: (nodeId: string) => boolean;
  /** A drag is about to save: the moved nodes as they were before it, for undo (hooks/useMoveUndo.ts). */
  recordMove?: (before: NodeDoc[]) => void;
}

// The node drag/drop system: single-node reposition-or-join-a-circle,
// group ("follow the leader") drag, and touch's own long-press-to-
// multiselect disambiguation — see onNodePointerDown's own doc comment
// below for the full shape of each path.
export function useNodeDragAndDrop({
  nodes,
  positions,
  nodeGroups,
  chooseMode,
  packMode,
  drawMode,
  multiSelectIds,
  moveMode,
  isOwnNode,
  handleNodeClick,
  posFor,
  screenToCanvas,
  viewportBounds,
  obstaclePoints,
  placeNode,
  footprintScale = 1,
  upsertNode,
  setActionError,
  setNodes,
  setSelectedId,
  setMultiSelectIds,
  suppressNextClick,
  t,
  spotFor = (_node, pt) => ({ x: pt.x, y: pt.y }),
  snapFor,
  onSnapped,
  clearSpotFor,
  clusterFor,
  onHold,
  isBlockLocked,
  recordMove,
}: Params) {
  // Held in place: a member of the chosen circle (Node.locked), or a text
  // block its owner locked.
  const held = (n: NodeDoc) => !!n.locked || !!isBlockLocked?.(n.nodeId);
  // Single-node drag position, group-drag position map, and circle-join
  // drop-target highlight — see hooks/dragUIState.ts.
  const [dragUI, dispatch] = useReducer(dragUIReducer, initialDragUIState);
  const dragMoved = useRef(false);
  // Bumped at the start of every group drag; a follower's catch-up
  // animation checks its own captured token against this on each hop and
  // bails out the moment it no longer matches — i.e. a new group drag
  // started (or this one's own drop logic already ran) before it finished,
  // so its now-stale writes never land on top of whatever drag superseded
  // it.
  const groupDragToken = useRef(0);
  // The running group-drag trail (see utils/followTrail.ts): stops its timer
  // and lets the drop it belongs to save at once.
  const stopTrail = useRef<(() => void) | null>(null);
  useEffect(() => () => stopTrail.current?.(), []);

  // What dragging `dragged` to (x,y) would land it on, if anything — the
  // nearest other node whose card (plus a small margin, dropTargetDistance)
  // the drop lands on. Every restriction on
  // *joining* a circle this way (own-node-only, the 7-node cap, matching
  // sentiment) has been removed — any node can be dropped onto any other to
  // join its circle, any number of nodes, any mix of sentiment, same
  // "fully open" spirit combat and pack/protect creation already follow.
  // The one thing still checked is cycle-safety, not a restriction so much
  // as a correctness guard: dropping a node onto its own descendant would
  // close the parentId chain into a loop, which every bit of code that
  // walks that chain (nodeGroups, radialPositions, isDescendant itself)
  // assumes can never happen. null means the pointer isn't over anything
  // droppable at all, so the drag ends as a plain reposition instead.
  function findDropTarget(
    dragged: NodeDoc,
    x: number,
    y: number,
  ): { target: NodeDoc; valid: boolean; reason?: string } | null {
    // An attack stays tied to what it hit: it can only join another attack,
    // making a zone of attacks. Anything else can join an attack's zone too.
    let closest: NodeDoc | null = null;
    let closestDist = Infinity;
    for (const n of nodes) {
      if (n.nodeId === dragged.nodeId || (dragged.isWeapon && !n.isWeapon)) continue;
      const p = positions.get(n.nodeId);
      if (!p) continue;
      const d = dropTargetDistance({ x, y }, p, footprintScale);
      if (d !== null && d < closestDist) {
        closest = n;
        closestDist = d;
      }
    }
    if (!closest) return null;
    const target = closest;
    if (isDescendant(target.nodeId, dragged.nodeId, nodes)) {
      return { target, valid: false, reason: t.ui.errors.dropOnOwnBranch };
    }
    return { target, valid: true };
  }

  // A parent pulls its own nodes left too far back in once it has moved
  // (utils/parentMagnet.ts): the children that will move when `moved` lands
  // at its new spots, and where to. Cards on the board keep their own spots.
  function pullsFor(moved: Map<string, Pt>, farFactor = MAGNET_FAR_FACTOR): { pulls: Map<string, Pt>; pulled: NodeDoc[] } {
    const canPull = (n: NodeDoc) => {
      const p = positions.get(n.nodeId);
      return isOwnNode(n) && !n.isWeapon && !held(n) && !!p && !clearSpotFor?.(n, p.x, p.y);
    };
    const pulls = magnetPulls(moved, nodes, positions, canPull, obstaclePoints, viewportBounds(), undefined, footprintScale, farFactor);
    return { pulls, pulled: nodes.filter((n) => pulls.has(n.nodeId)) };
  }

  // Moves the pulled children over at once (the map glides them there, see
  // usePositionGlide) and saves them; any that don't save go back.
  // Several nodes' new spots, saved in one request (nodesApi.moveNodes).
  function moveAll(spots: Map<string, Partial<NodeDoc>>) {
    return nodesApi.moveNodes(Array.from(spots, ([nodeId, spot]) => ({ nodeId, ...spot })));
  }

  // Shown at their new spots at once, put back if the save fails.
  async function saveSpots(members: NodeDoc[], spots: Map<string, Partial<NodeDoc>>) {
    const before = new Map(members.map((n) => [n.nodeId, storedSpots(n)]));
    setNodes((prev) => prev.map((n) => (spots.has(n.nodeId) ? { ...n, ...spots.get(n.nodeId)! } : n)));
    try {
      (await moveAll(spots)).forEach(upsertNode);
    } catch {
      setNodes((prev) => prev.map((n) => (before.has(n.nodeId) ? { ...n, ...before.get(n.nodeId)! } : n)));
      setActionError(t.ui.errors.moveNodes);
    }
  }

  async function savePulls(pulls: Map<string, Pt>, pulled: NodeDoc[]) {
    if (pulled.length === 0) return;
    await saveSpots(pulled, new Map(pulled.map((n) => [n.nodeId, spotFor(n, pulls.get(n.nodeId)!)])));
  }

  // The parent's magnet button: calls every one of its own nodes outside the
  // zone back in, where it stands. How many it pulled; undo puts them back.
  async function magnetize(parent: NodeDoc): Promise<number> {
    const at = positions.get(parent.nodeId);
    if (!at) return 0;
    const { pulls, pulled } = pullsFor(new Map([[parent.nodeId, at]]), MAGNET_BUTTON_FAR_FACTOR);
    if (pulled.length === 0) return 0;
    setActionError(null);
    recordMove?.(pulled);
    await savePulls(pulls, pulled);
    return pulled.length;
  }

  // A branch arrow's parent end let go over another node (hooks/useEdgeRedirect.ts):
  // `child` now hangs from `parent`, and the zones redraw to fit. The child
  // stays put when its new zone can take it in where it is; sitting far out,
  // it comes in next to its new parent (utils/edgeRedirect.ts). Either way the
  // zone rules settle it — out of any zone it no longer belongs to, zones not
  // crossing — and its own nodes left too far follow it. A card on the board
  // keeps its spot. One undo step puts the parent and the spots back.
  async function redirectParent(child: NodeDoc, parent: NodeDoc) {
    const from = positions.get(child.nodeId) ?? posFor(child);
    const to = positions.get(parent.nodeId) ?? posFor(parent);
    const card = !!clearSpotFor?.(child, from.x, from.y);
    // Close enough already: it stays exactly where it is. (Settling it anyway
    // would keep it inside the part of the map on screen, and on a phone,
    // panned over to the new parent, that yanked it across the map.)
    const want = redirectSpot(from, to, getZoneReach());
    const stays = card || held(child) || (want.x === from.x && want.y === from.y);
    const placed = stays ? from : placeNode(want, [{ nodeId: child.nodeId, parentId: parent.nodeId }]);
    const moved = placed.x !== from.x || placed.y !== from.y;
    const { pulls, pulled } = moved ? pullsFor(new Map([[child.nodeId, placed]])) : { pulls: new Map<string, Pt>(), pulled: [] };
    recordMove?.([child, ...pulled]);
    setActionError(null);
    const before = { ...storedSpots(child), parentId: child.parentId };
    const spot = moved ? spotFor(child, placed) : {};
    setNodes((prev) => prev.map((n) => (n.nodeId === child.nodeId ? { ...n, ...spot, parentId: parent.nodeId } : n)));
    const pulling = savePulls(pulls, pulled);
    try {
      upsertNode(await nodesApi.updateNode(child.nodeId, { ...spot, parentId: parent.nodeId }));
    } catch (err) {
      setNodes((prev) => prev.map((n) => (n.nodeId === child.nodeId ? { ...n, ...before } : n)));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.changeParent);
    }
    await pulling;
  }

  // A finger held still on a node (touch's shift+click): toggles it in or out
  // of the group selection. Same contract onCanvasPointerDown's marquee onUp
  // already follows — starting a multi-selection always clears any stale
  // single selection, so it can't resurface (a NodePanel popping back open
  // for a node nobody re-picked) once the group empties back out. Phones fire
  // a click when the held finger lifts; without swallowing it, that click
  // selected the node on its own and threw the group away, so a second node
  // could never join. Some browsers send no click after a long press, so the
  // swallow only lasts until the finger could have lifted.
  function toggleIntoGroup(node: NodeDoc, lifted = false) {
    setSelectedId(null);
    setMultiSelectIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.nodeId)) next.delete(node.nodeId);
      else next.add(node.nodeId);
      return next;
    });
    suppressNextClick.current = true;
    const release = () => setTimeout(() => (suppressNextClick.current = false), LONG_PRESS_CLICK_GRACE_MS);
    if (lifted) release();
    else window.addEventListener("pointerup", release, { once: true });
  }

  // A finger held still on a node and lifted without moving: a puzzle card
  // opens its menu (onHold), anything else joins or leaves the group
  // selection. Done on the lift, not while the finger is still down, so
  // holding a node a moment before dragging it still drags it instead of
  // opening it.
  function finishHold(node: NodeDoc, clientX: number, clientY: number) {
    suppressNextClick.current = true;
    setTimeout(() => (suppressNextClick.current = false), LONG_PRESS_CLICK_GRACE_MS);
    if (onHold?.(node, clientX, clientY)) return;
    toggleIntoGroup(node, true);
  }

  function onNodePointerDown(node: NodeDoc, e: ReactPointerEvent) {
    if (chooseMode || packMode || drawMode) return;
    if (!isOwnNode(node)) return;

    // Group drag: the pointer-downed node is itself a member of a 2+-node
    // multi-selection — dragging it moves the whole selection, every member
    // under the finger at once, as one rigid shape. No circle-join drop-target
    // check here — a group drop is always a plain bulk reposition; each member
    // persists with its own PATCH /api/nodes/:nodeId (no bulk endpoint
    // exists). Skipped when the pointer-downed node itself is locked
    // (Node.locked — its circle is the currently-chosen one, see
    // handleCircleBackdropClick): a chosen cluster holds its position for
    // good, so falls through to the ordinary long-press/tap paths below.
    if (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId) && !held(node)) {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragMoved.current = false;
      const token = ++groupDragToken.current;
      // !n.locked too — a locked member caught up in a wider multi-selection
      // still can't move even if the node the drag actually started from
      // isn't itself locked.
      const memberIds = Array.from(multiSelectIds).filter((id) => {
        const n = nodes.find((nn) => nn.nodeId === id);
        return !!n && isOwnNode(n) && !n.isWeapon && !held(n);
      });
      const startPositions = new Map(
        memberIds.map((id) => [id, posFor(nodes.find((n) => n.nodeId === id)!)]),
      );
      dispatch({ type: "groupStart", positions: startPositions });
      const startPt = screenToCanvas(e.clientX, e.clientY);
      const margin = 60;
      const clamp = (x: number, y: number) => ({
        x: Math.min(CANVAS_W - margin, Math.max(margin, x)),
        y: Math.min(CANVAS_H - margin, Math.max(margin, y)),
      });

      // Follow the leader (utils/followTrail.ts): the node under the finger
      // tracks it live; every other member walks the leader's path a few
      // ticks behind the one in front of it, in small hops, and after the
      // drop keeps hopping until it reaches its own spot.
      stopTrail.current?.();
      const leaderStartPos = startPositions.get(node.nodeId)!;
      const trail = startTrail(node.nodeId, startPositions, !prefersReducedMotion(), (shown) =>
        dispatch({ type: "groupStart", positions: shown }),
      );
      stopTrail.current = trail.stop;
      function endTrail() {
        trail.stop();
        if (stopTrail.current === trail.stop) stopTrail.current = null;
      }

      function stop() {
        window.removeEventListener("pointermove", onGroupMove);
        window.removeEventListener("pointerup", onGroupUp);
        window.removeEventListener("pointercancel", onGroupCancel);
      }

      function onGroupMove(ev: PointerEvent) {
        const p = screenToCanvas(ev.clientX, ev.clientY);
        dragMoved.current = true;
        trail.lead({ x: p.x - startPt.x, y: p.y - startPt.y });
      }

      // The browser took the touch back (a system gesture, an incoming call):
      // the group goes back where it was, nothing saved.
      function onGroupCancel() {
        stop();
        endTrail();
        if (groupDragToken.current === token) dispatch({ type: "groupClear" });
      }

      async function onGroupUp(ev: PointerEvent) {
        stop();
        suppressNextClick.current = true;
        if (!dragMoved.current) {
          endTrail();
          dispatch({ type: "groupClear" });
          handleNodeClick(node, false);
          return;
        }
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const dx = p.x - startPt.x;
        const dy = p.y - startPt.y;
        setActionError(null);

        // The selection lands where it was let go, as one shape, nudged only
        // as far as it takes for no member to cover another node or its text
        // (see placeNode's "free" mode). Each member then steers clear of the
        // members already placed, in case the nudge pushed them together.
        const memberIdSet = new Set(memberIds);
        const externalObstacles = footprintObstacles(obstaclePoints(memberIdSet), 0, footprintScale);
        const leaderStart = startPositions.get(node.nodeId)!;
        const leaderTarget = placeNode(
          clamp(leaderStart.x + dx, leaderStart.y + dy),
          memberIds.map((id) => {
            const start = startPositions.get(id)!;
            return { nodeId: id, offset: { x: start.x - leaderStart.x, y: start.y - leaderStart.y } };
          }),
          [],
          { free: true },
        );
        const targets = new Map<string, Pt>([[node.nodeId, leaderTarget]]);
        for (const id of memberIds) {
          if (id === node.nodeId) continue;
          const start = startPositions.get(id)!;
          const placedSoFar = footprintObstacles(Array.from(targets.values()), 0, footprintScale);
          const keepShape = clamp(leaderTarget.x + start.x - leaderStart.x, leaderTarget.y + start.y - leaderStart.y);
          targets.set(id, avoidOverlap(keepShape, [...externalObstacles, ...placedSoFar], FULL_CANVAS_BOUNDS));
        }
        const { pulls, pulled } = pullsFor(targets);
        recordMove?.([...nodes.filter((n) => memberIds.includes(n.nodeId)), ...pulled]);

        // The leader lands at once; the rest hop after it to their own spots,
        // and all of them stay drawn there until the saves land, so nothing
        // flashes back to its old spot in between.
        await trail.land({ x: leaderTarget.x - leaderStartPos.x, y: leaderTarget.y - leaderStartPos.y }, targets);
        endTrail();
        dispatch({ type: "groupStart", positions: targets });
        const pulling = savePulls(pulls, pulled);
        const members = nodes.filter((n) => memberIdSet.has(n.nodeId));
        try {
          const updated = await moveAll(new Map(members.map((m) => [m.nodeId, spotFor(m, targets.get(m.nodeId)!)])));
          if (groupDragToken.current === token) updated.forEach(upsertNode);
        } catch (err) {
          setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.moveNodes);
        }
        if (groupDragToken.current === token) dispatch({ type: "groupClear" });
        await pulling;
      }

      window.addEventListener("pointermove", onGroupMove);
      window.addEventListener("pointerup", onGroupUp);
      window.addEventListener("pointercancel", onGroupCancel);
      return;
    }

    // A single node only drags in explicit move mode (the ✥ button), with a
    // mouse or a finger alike, so a click never relocates one and a swipe
    // across the map to look around never drags the node it started on: out
    // of move mode that swipe pans the map (NodeCard drops touch-none then).
    // In move mode a finger only drags once it really travels (past
    // TOUCH_DRAG_SLOP), so a tap or a graze stays a tap. This does not apply
    // to the group drag above, which works either way. A node held in place
    // (node.locked, a locked block) never drags; a long press still works on
    // any node, since picking it into a selection doesn't move anything.
    // Puzzle pieces clicked together drag as one (see clusterFor below), so a
    // puzzle with any piece held in place is held as a whole.
    const touch = e.pointerType === "touch";
    const canDrag = moveMode;
    const clusterIds = canDrag && !held(node) ? (clusterFor?.(node) ?? [node.nodeId]) : [node.nodeId];
    const clusterHeld = clusterIds.some((id) => {
      const n = nodes.find((nn) => nn.nodeId === id);
      return !!n && held(n);
    });
    if (!canDrag || held(node) || clusterHeld) {
      if (!touch) return;
      const touchStartX = e.clientX;
      const touchStartY = e.clientY;
      let heldLong = false;
      let wandered = false;
      const longPressTimer = setTimeout(() => {
        heldLong = true;
        navigator.vibrate?.(15); // subtle haptic confirmation; a silent no-op wherever unsupported
      }, LONG_PRESS_MS);
      function onIdleMove(ev: PointerEvent) {
        if (Math.hypot(ev.clientX - touchStartX, ev.clientY - touchStartY) > TOUCH_DRAG_SLOP) {
          wandered = true;
          clearTimeout(longPressTimer);
        }
      }
      function stopIdle() {
        clearTimeout(longPressTimer);
        window.removeEventListener("pointermove", onIdleMove);
        window.removeEventListener("pointerup", onIdleUp);
        window.removeEventListener("pointercancel", stopIdle);
      }
      function onIdleUp() {
        stopIdle();
        if (heldLong && !wandered) finishHold(node, touchStartX, touchStartY);
      }
      window.addEventListener("pointermove", onIdleMove);
      window.addEventListener("pointerup", onIdleUp);
      // The browser took the finger to pan the map: that is no hold.
      window.addEventListener("pointercancel", stopIdle);
      return;
    }

    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragMoved.current = false;
    const start = posFor(node);
    dispatch({ type: "dragSet", nodeId: node.nodeId, x: start.x, y: start.y });

    // screenToCanvas divides by `zoom` — canvasRef is visually scaled via a
    // CSS transform now (see the zoom controls below), so its own
    // getBoundingClientRect() reports a *rendered* size (CANVAS_W*zoom
    // pixels wide), not the CANVAS_W-unit coordinate space every position
    // in this file (node.x/y, positions, dragState, viewportBounds) is
    // expressed in. Every screen-pixel reading in this drag has to go
    // through this same conversion, or a drag started at any zoom level
    // other than 100% tracks the pointer at the wrong speed/direction.
    const startPt = screenToCanvas(e.clientX, e.clientY);
    const offsetX = startPt.x - start.x;
    const offsetY = startPt.y - start.y;

    // Puzzle pieces clicked together move as one: dragging any of them
    // carries the whole assembled puzzle along rigidly, every piece keeping
    // its place against the others. Such a drag is a plain move of the lot —
    // no clicking into another piece, joining a circle or leaving one.
    const clusterStart =
      clusterIds.length > 1
        ? new Map(
            clusterIds.flatMap((id) => {
              const n = nodes.find((nn) => nn.nodeId === id);
              return n ? [[id, id === node.nodeId ? start : posFor(n)] as const] : [];
            }),
          )
        : null;
    // The whole puzzle moved by (dx, dy), held inside the canvas as one —
    // the shift is cut short rather than any one piece clamped out of place.
    const movedCluster = (dx: number, dy: number) => {
      const margin = 60;
      const pts = Array.from(clusterStart!.values());
      const lo = (k: "x" | "y") => Math.min(...pts.map((pt) => pt[k]));
      const hi = (k: "x" | "y") => Math.max(...pts.map((pt) => pt[k]));
      const cdx = Math.min(CANVAS_W - margin - hi("x"), Math.max(margin - lo("x"), dx));
      const cdy = Math.min(CANVAS_H - margin - hi("y"), Math.max(margin - lo("y"), dy));
      return new Map(Array.from(clusterStart!, ([id, pt]) => [id, { x: pt.x + cdx, y: pt.y + cdy }]));
    };
    // Glued cards follow the one under the finger like a group drag does
    // (utils/followTrail.ts), starting once the drag really moves.
    let clusterTrail: Trail | null = null;
    const leadCluster = (moved: Map<string, Pt>) => {
      if (!clusterTrail) {
        stopTrail.current?.();
        clusterTrail = startTrail(node.nodeId, clusterStart!, !prefersReducedMotion(), (shown) =>
          dispatch({ type: "groupStart", positions: shown }),
        );
        stopTrail.current = clusterTrail.stop;
      }
      const at = moved.get(node.nodeId)!;
      return { trail: clusterTrail, shift: { x: at.x - start.x, y: at.y - start.y } };
    };
    const endClusterTrail = () => {
      clusterTrail?.stop();
      if (stopTrail.current === clusterTrail?.stop) stopTrail.current = null;
    };

    // Long-press, touch only: there's no keyboard on a phone to reach
    // shift+click or right-click, so a finger held still for LONG_PRESS_MS
    // and lifted without moving opens a puzzle card's menu (onHold) or toggles
    // the node into the multi-selection. The hold only counts on the lift: a
    // finger that rests on a node a moment and then moves still drags it.
    // Below TOUCH_DRAG_SLOP a finger's own jitter moves nothing, so a tap
    // stays a tap.
    let heldLong = false;
    const longPressTimer = touch
      ? setTimeout(() => {
          heldLong = true;
          navigator.vibrate?.(15); // subtle haptic confirmation; a silent no-op wherever unsupported
        }, LONG_PRESS_MS)
      : undefined;
    const pressX = e.clientX;
    const pressY = e.clientY;
    const pointerId = e.pointerId;

    function stop() {
      clearTimeout(longPressTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("pointerdown", onOtherDown);
    }

    // The browser took the touch back, or a second finger came down (a
    // pinch to zoom): the node goes back where it was, nothing saved, and
    // the lifted finger opens nothing.
    function onCancel() {
      stop();
      endClusterTrail();
      dispatch({ type: "reset" });
      suppressNextClick.current = true;
      setTimeout(() => (suppressNextClick.current = false), LONG_PRESS_CLICK_GRACE_MS);
    }
    function onOtherDown(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) onCancel();
    }

    // The piece the dragged one is currently clicked into, if any.
    let snappedTo: string | null = null;
    function onMove(ev: PointerEvent) {
      if (!dragMoved.current) {
        if (touch && Math.hypot(ev.clientX - pressX, ev.clientY - pressY) <= TOUCH_DRAG_SLOP) return;
        clearTimeout(longPressTimer);
      }
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
      dragMoved.current = true;
      if (clusterStart) {
        const { trail, shift } = leadCluster(movedCluster(x - start.x, y - start.y));
        trail.lead(shift);
        return;
      }
      // Close to a fitting puzzle piece: jump flush into it, and light the
      // partner up. A clicked-in piece isn't joining a circle, so the drop
      // target search is skipped.
      const snap = snapFor?.(node, x, y);
      if (snap) {
        if (snappedTo !== snap.partnerId) navigator.vibrate?.(10);
        snappedTo = snap.partnerId;
        dispatch({ type: "dragSet", nodeId: node.nodeId, x: snap.x, y: snap.y });
        dispatch({ type: "dropTargetSet", nodeId: snap.partnerId, valid: true });
        return;
      }
      snappedTo = null;
      dispatch({ type: "dragSet", nodeId: node.nodeId, x, y });
      const found = findDropTarget(node, x, y);
      dispatch(
        found ? { type: "dropTargetSet", nodeId: found.target.nodeId, valid: found.valid } : { type: "dropTargetClear" },
      );
    }

    async function onUp(ev: PointerEvent) {
      stop();
      // See suppressNextClick's own comment — this interaction's outcome
      // (below) is the real one; the click still about to fire on this same
      // node is the captured-pointer artifact, not a second user action.
      suppressNextClick.current = true;
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
      if (clusterStart && dragMoved.current) {
        recordMove?.(nodes.filter((n) => clusterStart.has(n.nodeId)));
        const moved = movedCluster(x - start.x, y - start.y);
        const { trail, shift } = leadCluster(moved);
        await trail.land(shift, moved);
        endClusterTrail();
        const members = nodes.filter((n) => moved.has(n.nodeId));
        dispatch({ type: "reset" });
        setActionError(null);
        await saveSpots(members, new Map(members.map((n) => [n.nodeId, spotFor(n, moved.get(n.nodeId)!)])));
        return;
      }
      const snap = dragMoved.current ? snapFor?.(node, x, y) : null;
      if (snap) {
        // Dropped clicked into another piece: it stays exactly there, flush
        // against its partner (no overlap nudging — sitting right against it
        // is the point), and the caller links the two.
        dispatch({ type: "reset" });
        recordMove?.([node]);
        const before = storedSpots(node);
        const spot = spotFor(node, snap);
        setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...spot } : n)));
        navigator.vibrate?.(20);
        onSnapped?.(node, snap);
        try {
          upsertNode(await nodesApi.updateNode(node.nodeId, spot));
        } catch (err) {
          setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...before } : n)));
          setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.moveNodes);
        }
        return;
      }
      const found = dragMoved.current ? findDropTarget(node, x, y) : null;
      dispatch({ type: "reset" });
      if (dragMoved.current) {
        if (found && !found.valid) {
          // Invalid drop (own descendant, per findDropTarget's own
          // isDescendant check) — cancel the whole move instead of falling
          // through to a plain reposition below. node.x/y were never
          // touched during the drag (only dragState was, and that's already
          // cleared above), so simply not persisting anything here is
          // enough to snap it back to where it started.
          setActionError(found.reason ?? t.ui.errors.cannotJoin);
          return;
        }
        if (found && found.valid) {
          // Dropped onto an eligible node — join its circle instead of a
          // plain reposition. Land just next to the target rather than
          // exactly on top of it: the nearest spot that covers no node
          // (placeNode's free mode, the person aimed it here).
          const target = found.target;
          const placed = placeNode({ x, y }, [{ nodeId: node.nodeId, parentId: target.nodeId }], [], { free: true });
          const { pulls, pulled } = pullsFor(new Map([[node.nodeId, placed]]));
          recordMove?.([node, ...pulled]);
          setActionError(null);
          // Moved over right away, same as a plain drop below — waiting for
          // the server left the node flashing back at its old spot (dragState
          // is already cleared above) until the response landed.
          const before = { x: node.x, y: node.y, parentId: node.parentId };
          setNodes((prev) =>
            prev.map((n) =>
              n.nodeId === node.nodeId ? { ...n, ...spotFor(node, placed), parentId: target.nodeId } : n,
            ),
          );
          const pulling = savePulls(pulls, pulled);
          try {
            const updated = await nodesApi.updateNode(node.nodeId, {
              ...spotFor(node, placed),
              parentId: target.nodeId,
            });
            upsertNode(updated);
          } catch (err) {
            setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...before } : n)));
            setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.joinCircle);
          }
          await pulling;
          return;
        }
        // A drop lands where it was let go, moved only as far as it takes not
        // to cover another node or its text (placeNode's free mode): the
        // person aimed it there, so the zone rules that place new nodes
        // don't second-guess it.
        //
        // Dragged clear of its own circle's backdrop (not just repositioned
        // within it) — read as "pull this node out", clearing parentId so it
        // stops being a member. Only applies to an actual *member* (its own
        // parentId points at the circle's root); dragging the root itself
        // just moves the root. A circle with only one member left after this
        // simply stops being one — nodeGroups requires 2+ children, so its
        // backdrop disappears on its own, no separate cleanup needed here.
        // An attack hangs from its target but is no member of its zone, so
        // only a zone of attacks it was dropped into counts here; leaving
        // that hangs it back from its target. The zone rules keep it outside
        // every castle, so it can't be dropped inside one.
        const parentId = zoneParentId(node) ?? undefined;
        const ownCircle = parentId ? nodeGroups.find((g) => g.rootId === parentId) : undefined;
        // Still a member at the raw drop point? Within one and a half zone
        // reaches of its root (see getZoneReach) it is. Past it, it leaves the circle —
        // so dragging a member outward can't stretch the zone across the map
        // — unless it is no farther out than it already was: a member that
        // already sat out there can be moved around or pulled back in
        // without being cut loose.
        const rootPos = ownCircle ? posFor(ownCircle.members[0]) : null;
        const dropDist = rootPos ? Math.hypot(x - rootPos.x, y - rootPos.y) : 0;
        const startDist = rootPos ? Math.hypot(start.x - rootPos.x, start.y - rootPos.y) : 0;
        const staysMember = !!ownCircle && (dropDist <= getZoneReach() * MEMBER_REACH_FACTOR || dropDist <= startDist);
        const leftCircle = !!ownCircle && !staysMember;
        // A card on the board keeps clear of the other cards instead — in
        // the board's own units, where the icon spacing means nothing.
        const cardSpot = clearSpotFor?.(node, x, y);
        const dropped =
          cardSpot ??
          placeNode({ x, y }, [{ nodeId: node.nodeId, ...(leftCircle ? { parentId: null } : {}) }], [], {
            free: !node.isWeapon,
          });
        // Its own nodes left too far follow it in (a card on the board doesn't pull).
        const { pulls, pulled } = cardSpot ? { pulls: new Map<string, Pt>(), pulled: [] } : pullsFor(new Map([[node.nodeId, dropped]]));
        recordMove?.([node, ...pulled]);

        // Remembered so a failed persist below can put the node back exactly
        // where it actually still is on the server, instead of leaving the
        // optimistic drop showing as "moved" when it never saved — that
        // silent mismatch (until the next reload happened to fix it) was the
        // real bug: a courtesy update still has to be honest about whether
        // it landed.
        const before = { ...storedSpots(node), parentId: node.parentId };
        const leftTo = node.isWeapon ? (nodeRefId(node.targetNodeId) ?? null) : null;
        const spot = spotFor(node, dropped);
        setNodes((prev) =>
          prev.map((n) =>
            n.nodeId === node.nodeId ? { ...n, ...spot, ...(leftCircle ? { parentId: leftTo } : {}) } : n,
          ),
        );
        const pulling = savePulls(pulls, pulled);
        try {
          if (leftCircle) {
            const updated = await nodesApi.updateNode(node.nodeId, { ...spot, parentId: leftTo });
            upsertNode(updated);
          } else {
            const updated = await nodesApi.updateNode(node.nodeId, spot);
            upsertNode(updated);
          }
        } catch (err) {
          setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...before } : n)));
          setActionError(
            err instanceof ApiRequestError ? err.message : leftCircle ? t.ui.errors.leaveCircle : t.ui.errors.moveNodes,
          );
        }
        await pulling;
      } else if (heldLong) {
        finishHold(node, pressX, pressY);
      } else {
        handleNodeClick(node);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    if (touch) window.addEventListener("pointerdown", onOtherDown);
  }

  return {
    onNodePointerDown,
    magnetize,
    redirectParent,
    dragState: dragUI.drag,
    groupDragState: dragUI.group,
    dropTarget: dragUI.dropTarget,
  };
}

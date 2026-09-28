import { useReducer, useRef } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { avoidOverlap, footprintObstacles, CANVAS_H, CANVAS_W, CIRCLE_DROP_RADIUS, isDescendant } from "../utils/canvasLayout";
import type { NodeGroup, Obstacle, ViewportBounds } from "../utils/canvasLayout";
import { nodeRefId } from "../utils/nodeType";
import { sleep } from "../utils/sleep";
import { dragUIReducer, initialDragUIState } from "./dragUIState";
import type { Translation } from "../i18n/translations";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Group-drag "follow the leader" catch-up — see onNodePointerDown's group-
// drag branch. Only the pointer-downed node ("the leader") tracks the
// pointer live; every other selected node stays put until the leader is
// dropped, then catches up to its own new offset in a few discrete hops
// instead of snapping there in one frame, staggered so the group reads as
// trailing after the leader rather than teleporting in lockstep with it.
const GROUP_FOLLOW_STEPS = 3;
const GROUP_FOLLOW_STEP_DELAY_MS = 130;
const GROUP_FOLLOW_STAGGER_MS = 90;

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
  // Preempts the majority-swap auto-reposition effect the instant a real
  // gesture starts on any node — see hooks/useMajoritySwap.ts.
  cancelMajoritySwap: () => void;
  posFor: (node: NodeDoc) => Pt;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  viewportBounds: () => ViewportBounds;
  obstaclePoints: (exclude?: Set<string>) => Pt[];
  bigNodeObstacles: (excludeRootIds?: Set<string>) => Obstacle[];
  zoomToEditAt: (x: number, y: number) => void;
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
  cancelMajoritySwap,
  posFor,
  screenToCanvas,
  viewportBounds,
  obstaclePoints,
  bigNodeObstacles,
  zoomToEditAt,
  upsertNode,
  setActionError,
  setNodes,
  setSelectedId,
  setMultiSelectIds,
  suppressNextClick,
  t,
}: Params) {
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

  // What dragging `dragged` to (x,y) would land it on, if anything — the
  // nearest other node within CIRCLE_DROP_RADIUS. Every restriction on
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
    let closest: NodeDoc | null = null;
    let closestDist = CIRCLE_DROP_RADIUS;
    for (const n of nodes) {
      if (n.nodeId === dragged.nodeId || n.isWeapon) continue;
      const p = positions.get(n.nodeId);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < closestDist) {
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

  function onNodePointerDown(node: NodeDoc, e: ReactPointerEvent) {
    // A real interaction with any node always preempts the majority-swap
    // auto-reposition effect outright (see hooks/useMajoritySwap.ts).
    // Unconditional, ahead of every other early return below: the effect
    // fighting a user's own gesture for the same node(s) would be far worse
    // than just stopping early here.
    cancelMajoritySwap();
    if (chooseMode || packMode || drawMode) return;
    if (!isOwnNode(node)) return;

    // Group drag: the pointer-downed node is itself a member of a 2+-node
    // multi-selection — dragging it moves the whole selection, not just
    // itself. Only this "leader" node actually tracks the pointer live;
    // every other selected node ("follower") stays put until the leader is
    // dropped, then catches up to the same offset the leader moved by, in a
    // few staggered hops (see GROUP_FOLLOW_* above) instead of snapping
    // there in lockstep — reads as the group trailing after the leader,
    // like a line of animals following one another, rather than the whole
    // cluster teleporting as one rigid block. No circle-join drop-target
    // check here at all (see the plan's own scope note) — a group drop is
    // always a plain bulk reposition; each member persists with its own
    // PATCH /api/nodes/:nodeId (no bulk endpoint exists). Skipped when the
    // pointer-downed node itself is locked (Node.locked — its circle is the
    // currently-chosen one, see handleCircleBackdropClick): a chosen
    // cluster holds its position for good, so falls through to the
    // ordinary long-press/tap paths below instead of starting a reposition.
    if (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId) && !node.locked) {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragMoved.current = false;
      const token = ++groupDragToken.current;
      // !n.locked too — a locked member caught up in a wider multi-selection
      // still can't move even if the node the drag actually started from
      // isn't itself locked.
      const memberIds = Array.from(multiSelectIds).filter((id) => {
        const n = nodes.find((nn) => nn.nodeId === id);
        return !!n && isOwnNode(n) && !n.isWeapon && !n.locked;
      });
      const followerIds = memberIds.filter((id) => id !== node.nodeId);
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

      // Only the leader's own entry moves during the live drag — followers
      // are left at their startPositions value (identical to their real
      // position, so nothing visually shifts for them yet).
      function onGroupMove(ev: PointerEvent) {
        const p = screenToCanvas(ev.clientX, ev.clientY);
        dragMoved.current = true;
        const leaderStart = startPositions.get(node.nodeId)!;
        dispatch({
          type: "groupSetMember",
          id: node.nodeId,
          pos: { x: leaderStart.x + (p.x - startPt.x), y: leaderStart.y + (p.y - startPt.y) },
          fallback: startPositions,
        });
      }

      async function onGroupUp(ev: PointerEvent) {
        window.removeEventListener("pointermove", onGroupMove);
        window.removeEventListener("pointerup", onGroupUp);
        suppressNextClick.current = true;
        if (!dragMoved.current) {
          dispatch({ type: "groupClear" });
          handleNodeClick(node, false);
          return;
        }
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const dx = p.x - startPt.x;
        const dy = p.y - startPt.y;
        setActionError(null);

        // Group drag had zero overlap protection at all before — only the
        // canvas-bounds clamp. Same nearest-clear-spot settle the single-node
        // drop now gets: every node NOT in this drag (footprint) and every
        // zone backdrop the drag isn't itself part of (bigNodeObstacles) is a
        // real obstacle for where the leader/followers finally land.
        const memberIdSet = new Set(memberIds);
        const ownGroupRootIds = new Set(nodeGroups.filter((g) => memberIdSet.has(g.rootId)).map((g) => g.rootId));
        const externalObstacles = [
          ...footprintObstacles(obstaclePoints(memberIdSet)),
          ...bigNodeObstacles(ownGroupRootIds),
        ];

        // Every member's own final target, worked out up front (leader
        // first, then followers in order) rather than each one independently
        // inside the async catch-up loop below. `obstaclePoints(memberIdSet)`
        // above only ever excludes the *whole* group from each other's
        // obstacle list — fine for the group's own shape (translating every
        // member by the same dx/dy can't newly overlap them with each
        // other), but a member nudged clear of some *external* obstacle
        // (another zone, another node) had no way to know it was landing on
        // top of a groupmate, since groupmates were never obstacles to begin
        // with. Feeding each already-placed member's own target into the
        // next one's own obstacle list (footprintObstacles(...)) fixes that:
        // a follower now steers clear of the leader and of every earlier
        // follower too, not just of the outside world.
        const memberTargets = new Map<string, Pt>();
        const leaderStart = startPositions.get(node.nodeId)!;
        const leaderTarget = avoidOverlap(
          clamp(leaderStart.x + dx, leaderStart.y + dy),
          externalObstacles,
          viewportBounds(),
        );
        memberTargets.set(node.nodeId, leaderTarget);
        for (const id of followerIds) {
          const start = startPositions.get(id)!;
          const placedSoFar = footprintObstacles(Array.from(memberTargets.values()));
          memberTargets.set(
            id,
            avoidOverlap(clamp(start.x + dx, start.y + dy), [...externalObstacles, ...placedSoFar], viewportBounds()),
          );
        }

        dispatch({ type: "groupSetMember", id: node.nodeId, pos: leaderTarget, fallback: startPositions });
        zoomToEditAt(leaderTarget.x, leaderTarget.y);

        const leaderDone = nodesApi
          .updateNode(node.nodeId, { x: leaderTarget.x, y: leaderTarget.y })
          .then(upsertNode)
          .catch((err) => setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.moveNodes));

        // Followers catch up in their own selection order, each one's own
        // stepped animation starting GROUP_FOLLOW_STAGGER_MS after the
        // previous one's — the cascade the comment above describes — and
        // every write (each hop, and the final persist) checks `token`
        // against groupDragToken.current first, so a follower still mid-
        // animation when a new group drag starts (or this same one's own
        // drop logic re-enters somehow) quietly stops instead of clobbering
        // whatever superseded it.
        const followerDone = followerIds.map(async (id, i) => {
          if (i > 0) await sleep(i * GROUP_FOLLOW_STAGGER_MS);
          if (groupDragToken.current !== token) return;
          const start = startPositions.get(id)!;
          const target = memberTargets.get(id)!;
          for (let step = 1; step <= GROUP_FOLLOW_STEPS; step++) {
            if (groupDragToken.current !== token) return;
            const frac = step / GROUP_FOLLOW_STEPS;
            const hop = { x: start.x + (target.x - start.x) * frac, y: start.y + (target.y - start.y) * frac };
            dispatch({ type: "groupSetMember", id, pos: hop, fallback: startPositions });
            if (step < GROUP_FOLLOW_STEPS) await sleep(GROUP_FOLLOW_STEP_DELAY_MS);
          }
          try {
            const updated = await nodesApi.updateNode(id, { x: target.x, y: target.y });
            if (groupDragToken.current === token) upsertNode(updated);
          } catch (err) {
            setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.moveNodes);
          }
        });

        await Promise.all([leaderDone, ...followerDone]);
        if (groupDragToken.current === token) dispatch({ type: "groupClear" });
      }

      window.addEventListener("pointermove", onGroupMove);
      window.addEventListener("pointerup", onGroupUp);
      return;
    }

    // Mouse only: outside explicit move mode, a bare pointer-down on a
    // single node never arms a reposition/reparent drag — a plain click
    // falls straight through to NodeCard's own onClick, untouched. Touch no
    // longer needs the Move toggle at all (see the branch below skipping
    // this gate for it) — its own long-press-vs-drag disambiguation
    // (LONG_PRESS_MOVE_TOLERANCE, further down) is what protects against a
    // stray swipe-while-tapping instead: holding still still toggles
    // multi-select, only real movement past that tolerance now starts a
    // drag, so an accidental few px of touch imprecision still can't
    // relocate a node the way a bare, ungated pointerdown could have.
    // node.locked still blocks dragging outright, on both input types — a
    // chosen circle's own members hold their position for good (see the
    // group-drag branch's own comment above); touch long-press-to-
    // multiselect still works on one, since picking a locked node into some
    // other selection doesn't move anything.
    if ((!moveMode && e.pointerType !== "touch") || node.locked) {
      if (e.pointerType !== "touch") return;
      const touchStartX = e.clientX;
      const touchStartY = e.clientY;
      const LONG_PRESS_MS = 500;
      const LONG_PRESS_MOVE_TOLERANCE = 10;
      let longPressTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        longPressTimer = undefined;
        window.removeEventListener("pointermove", onIdleMove);
        window.removeEventListener("pointerup", onIdleUp);
        navigator.vibrate?.(15); // subtle haptic confirmation; a silent no-op wherever unsupported
        // Same contract onCanvasPointerDown's marquee onUp already follows —
        // starting a multi-selection always clears any stale single
        // selection, so it can't resurface (a NodePanel popping back open
        // for a node nobody re-picked) once the group empties back out.
        setSelectedId(null);
        setMultiSelectIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.nodeId)) next.delete(node.nodeId);
          else next.add(node.nodeId);
          return next;
        });
      }, LONG_PRESS_MS);
      function onIdleMove(ev: PointerEvent) {
        if (longPressTimer && Math.hypot(ev.clientX - touchStartX, ev.clientY - touchStartY) > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimeout(longPressTimer);
          longPressTimer = undefined;
        }
      }
      function onIdleUp() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = undefined;
        }
        window.removeEventListener("pointermove", onIdleMove);
        window.removeEventListener("pointerup", onIdleUp);
      }
      window.addEventListener("pointermove", onIdleMove);
      window.addEventListener("pointerup", onIdleUp);
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

    // Long-press to multi-select, touch only — there's no keyboard on a
    // phone to reach shift+click's own toggle any other way, and
    // marquee-drag is already claimed by native canvas panning on touch
    // (see onCanvasPointerDown's own comment), so touch had no path into
    // multi-select at all. Holding still for LONG_PRESS_MS toggles this
    // node into/out of the multi-selection, same common "long-press to
    // start picking" gesture photo/file picker apps already use; moving
    // more than a few px (real drag, not a held finger's own jitter) or
    // releasing early cancels it and falls through to the ordinary
    // tap-to-select/drag paths below, untouched.
    const LONG_PRESS_MS = 500;
    const LONG_PRESS_MOVE_TOLERANCE = 10;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    // Reused below by onMove's own cancellation check — stays undefined
    // (a no-op) for a mouse pointerdown, only ever assigned for touch.
    let cancelLongPressIfMoved: ((ev: PointerEvent) => void) | undefined;
    if (e.pointerType === "touch") {
      const touchStartX = e.clientX;
      const touchStartY = e.clientY;
      longPressTimer = setTimeout(() => {
        longPressTimer = undefined;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        dispatch({ type: "reset" });
        navigator.vibrate?.(15); // subtle haptic confirmation; a silent no-op wherever unsupported
        // See the other long-press timer's own comment above (the !moveMode
        // branch) — same "starting a multi-selection clears any stale
        // single selection" contract the marquee already follows.
        setSelectedId(null);
        setMultiSelectIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.nodeId)) next.delete(node.nodeId);
          else next.add(node.nodeId);
          return next;
        });
      }, LONG_PRESS_MS);
      cancelLongPressIfMoved = (ev: PointerEvent) => {
        if (longPressTimer && Math.hypot(ev.clientX - touchStartX, ev.clientY - touchStartY) > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimeout(longPressTimer);
          longPressTimer = undefined;
        }
      };
    }

    function onMove(ev: PointerEvent) {
      cancelLongPressIfMoved?.(ev);
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
      dragMoved.current = true;
      dispatch({ type: "dragSet", nodeId: node.nodeId, x, y });
      const found = findDropTarget(node, x, y);
      dispatch(
        found ? { type: "dropTargetSet", nodeId: found.target.nodeId, valid: found.valid } : { type: "dropTargetClear" },
      );
    }

    async function onUp(ev: PointerEvent) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = undefined;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // See suppressNextClick's own comment — this interaction's outcome
      // (below) is the real one; the click still about to fire on this same
      // node is the captured-pointer artifact, not a second user action.
      suppressNextClick.current = true;
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
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
          // exactly on top of it: nudged only as far as it takes to stop
          // covering it (see footprintObstacles), not a full node-spacing
          // away from where it was let go.
          const target = found.target;
          const placed = avoidOverlap(
            { x, y },
            footprintObstacles(obstaclePoints(new Set([node.nodeId]))),
            viewportBounds(),
          );
          setActionError(null);
          zoomToEditAt(placed.x, placed.y);
          try {
            const updated = await nodesApi.updateNode(node.nodeId, {
              x: placed.x,
              y: placed.y,
              parentId: target.nodeId,
            });
            upsertNode(updated);
          } catch (err) {
            setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.joinCircle);
          }
          return;
        }
        // A drop lands where it was let go. The only thing that moves it is a
        // node it would visibly cover, and then only by the little it takes
        // to clear that node (footprint boxes — see footprintObstacles), so
        // where a node ends up is never a surprise. Deliberately no
        // backdrop obstacles either: pushing a drop out of some other
        // circle's zone (a big area, once a circle has a few nodes) is what
        // sent nodes flying well away from the pointer.
        //
        // Dragged clear of its own circle's backdrop (not just repositioned
        // within it) — read as "pull this node out", clearing parentId so it
        // stops being a member. Only applies to an actual *member* (its own
        // parentId points at the circle's root); dragging the root itself
        // just moves the root. A circle with only one member left after this
        // simply stops being one — nodeGroups requires 2+ children, so its
        // backdrop disappears on its own, no separate cleanup needed here.
        const parentId = nodeRefId(node.parentId);
        const ownCircle = parentId ? nodeGroups.find((g) => g.rootId === parentId) : undefined;
        // Still a member at the raw drop point?
        const staysMember = !!ownCircle && Math.hypot(x - ownCircle.cx, y - ownCircle.cy) <= ownCircle.r;
        // Every other circle's backdrop is a real obstacle here too (not
        // just at creation time) — a plain reposition drop used to be able to
        // land a node's icon right on top of a zone it doesn't belong to.
        // Its own circle is excluded (staysMember only) so this never pushes
        // a node out of the zone it's still a member of. No corner-angle
        // check any more (see MIN_ZONE_ANGLE's own removal) — a zone is free
        // to pack as tight as its own members' footprints allow, as long as
        // it doesn't cross into a *different* zone's territory.
        const dropped = avoidOverlap(
          { x, y },
          [
            ...footprintObstacles(obstaclePoints(new Set([node.nodeId]))),
            ...bigNodeObstacles(staysMember && ownCircle ? new Set([ownCircle.rootId]) : undefined),
          ],
          viewportBounds(),
        );
        const leftCircle = !!ownCircle && !staysMember;
        zoomToEditAt(dropped.x, dropped.y);

        // Remembered so a failed persist below can put the node back exactly
        // where it actually still is on the server, instead of leaving the
        // optimistic drop showing as "moved" when it never saved — that
        // silent mismatch (until the next reload happened to fix it) was the
        // real bug: a courtesy update still has to be honest about whether
        // it landed.
        const before = { x: node.x, y: node.y, parentId: node.parentId };
        setNodes((prev) =>
          prev.map((n) =>
            n.nodeId === node.nodeId ? { ...n, x: dropped.x, y: dropped.y, ...(leftCircle ? { parentId: null } : {}) } : n,
          ),
        );
        try {
          if (leftCircle) {
            const updated = await nodesApi.updateNode(node.nodeId, { x: dropped.x, y: dropped.y, parentId: null });
            upsertNode(updated);
          } else {
            const updated = await nodesApi.updateNode(node.nodeId, { x: dropped.x, y: dropped.y });
            upsertNode(updated);
          }
        } catch (err) {
          setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...before } : n)));
          setActionError(
            err instanceof ApiRequestError ? err.message : leftCircle ? t.ui.errors.leaveCircle : t.ui.errors.moveNodes,
          );
        }
      } else {
        handleNodeClick(node);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return {
    onNodePointerDown,
    dragState: dragUI.drag,
    groupDragState: dragUI.group,
    dropTarget: dragUI.dropTarget,
  };
}

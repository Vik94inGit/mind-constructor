import { CANVAS_W, CANVAS_H, avoidOverlap, getNodeMinDist, hashOffset, isMobileViewport, nodeObstacles, spiralPoint } from "./canvasLayout";
import type { ViewportBounds } from "./canvasLayout";
import { idOf, nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Where every node sits on the canvas, keyed by node id: a stored x/y wins,
// otherwise it is placed by rule (see below). Pure — depends only on `nodes`.
export function computeBasePositions(nodes: NodeDoc[]): Map<string, Pt> {
  const map = new Map<string, { x: number; y: number }>();
  // Protection nodes get the exact same "anchored near its own creator,
  // fanned by hash" treatment weapon nodes already do (see the shared
  // placeCompanionNode helper below) — neither one is "regular" for the
  // spiral/index-based fallback placement further down.
  const regular = nodes.filter((n) => !n.isWeapon && !n.isProtection);
  const weapons = nodes.filter((n) => n.isWeapon);
  const protections = nodes.filter((n) => n.isProtection);

  // Shared by both weapons.forEach and protections.forEach below —
  // anchors a companion node (n) near whichever of its own creator's
  // *other* regular nodes sits closest to refPos (the thing it's aimed
  // at/defending), fanned out by a per-node hash angle so several
  // companions anchored at the same spot don't stack. Falls back to
  // refPos itself if the creator has no other node left to anchor near.
  function placeCompanionNode(n: NodeDoc, refPos: { x: number; y: number }) {
    const creatorId = idOf(n.userId);
    let base = refPos;
    let closestDist = Infinity;
    for (const own of regular) {
      if (own.nodeId === n.nodeId || idOf(own.userId) !== creatorId) continue;
      const p = map.get(own.nodeId);
      if (!p) continue;
      const d = Math.hypot(p.x - refPos.x, p.y - refPos.y);
      if (d < closestDist) {
        closestDist = d;
        base = p;
      }
    }
    const angle = hashOffset(n.nodeId, 180) * (Math.PI / 180);
    const radius = getNodeMinDist();
    const desired = { x: base.x + radius * Math.cos(angle), y: base.y + radius * Math.sin(angle) };
    return avoidOverlap(desired, nodeObstacles(Array.from(map.values())));
  }

  regular.forEach((n, i) => {
    if (typeof n.x === "number" && typeof n.y === "number") {
      map.set(n.nodeId, { x: n.x, y: n.y });
    } else {
      // A sunflower (golden-angle) spiral for nodes with no stored x/y
      // (everything a template map seeds) — see spiralPoint's own doc
      // comment (canvasLayout.ts) for why it's shaped the way it is.
      // Spacing is derived from getNodeMinDist() so the base layout gets
      // the room placement elsewhere already enforces.
      map.set(n.nodeId, spiralPoint(i, { x: CANVAS_W / 2, y: CANVAS_H / 2 }));
    }
  });
  weapons.forEach((n) => {
    if (typeof n.x === "number" && typeof n.y === "number") {
      map.set(n.nodeId, { x: n.x, y: n.y });
      return;
    }
    // targetNodeId comes back populated as { nodeId, text, type } now, not
    // a bare string — this was still checking the pre-populate shape, so
    // it never matched and every weapon node fell back to canvas-center
    // placement regardless of what it was aimed at.
    const targetId = nodeRefId(n.targetNodeId);
    const target = targetId ? nodes.find((t) => t.nodeId === targetId) : undefined;
    const targetPos = (target && map.get(target.nodeId)) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    // Anchored next to the attacker's own closest node to the target, not
    // the target itself — the bow (WeaponMark draws it at this weapon
    // node's own position) then reads as "shot from over there" across
    // the canvas, rather than camping right beside the node it hit. Falls
    // back to the target's own position — the old anchor — if the
    // attacker has no other node left on this map to anchor near (every
    // other one of theirs got deleted since, say); a self-attack in
    // discussion mode lands here too, since the target *is* one of the
    // attacker's own nodes and so is trivially its own closest match.
    // Fanning by angle alone doesn't guarantee two attacks (or an attack
    // and some unrelated node) don't land on each other — placeCompanionNode's
    // own avoidOverlap nudges clear of anything already placed, same
    // spacing rule every other node uses. Big-group backdrops aren't
    // checked here: nodeGroups itself is derived from these positions, so
    // consulting it back inside this same memo would be circular. Weapon
    // nodes fan out from an explicit anchor and land far enough out
    // (getNodeMinDist() radius) that this is a rare miss in practice, not
    // a gap worth breaking the memo for.
    map.set(n.nodeId, placeCompanionNode(n, targetPos));
  });
  protections.forEach((n) => {
    if (typeof n.x === "number" && typeof n.y === "number") {
      map.set(n.nodeId, { x: n.x, y: n.y });
      return;
    }
    const protectedId = nodeRefId(n.protectsNodeId);
    const protectedNode = protectedId ? nodes.find((t) => t.nodeId === protectedId) : undefined;
    const protectedPos = (protectedNode && map.get(protectedNode.nodeId)) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };

    // Whoever most recently attacked the node this shield defends (same
    // "nodes come back in creation order, last match is most recent"
    // convention handleNodeClick's own weapon-replay already relies on) —
    // when one exists, the shield belongs literally between the two:
    // positioned at their midpoint, reading as "standing in the way"
    // rather than floating near its own creator's other nodes (also what
    // the weapon-mark loop's own arrow-redirect lookup uses to find where
    // to stop). No active attacker at all: this is just an ordinary
    // companion node (placeCompanionNode, same as a weapon node with
    // nothing target-specific to react to) — a shield badge on the node
    // itself (NodeCard) is all that marks it as one.
    const attackers = weapons.filter((w) => nodeRefId(w.targetNodeId) === protectedId);
    const latestAttackerId = attackers[attackers.length - 1]?.nodeId;
    const attackerPos = latestAttackerId ? map.get(latestAttackerId) : undefined;

    if (attackerPos) {
      // Deliberately *not* run through avoidOverlap here, unlike every
      // other placement in this memo — a weapon node is anchored only
      // getNodeMinDist() away from its own target (close enough that the
      // bow reads as "right next to the attacker"), which puts their own
      // midpoint well inside *both* nodes' minDist zones every time.
      // avoidOverlap's own job is exactly to push out of a zone like
      // that, which here would walk the shield away from the midpoint by
      // more than the attacker-target distance itself — the opposite of
      // "on the arrows path." A literal on-the-line position, slightly
      // overlapping either endpoint's own footprint, is the actual ask.
      map.set(n.nodeId, { x: (attackerPos.x + protectedPos.x) / 2, y: (attackerPos.y + protectedPos.y) / 2 });
    } else {
      map.set(n.nodeId, placeCompanionNode(n, protectedPos));
    }
  });
  return map;
}

// Radial focus layout (see MapPage's radialPositions): how many neighbors get
// a slot in the ring at most, and how far out it sits. Shrunk on a
// phone-width viewport, same isMobile threshold getNodeMinDist() already
// uses — a fixed 190px radius left several of a 10-neighbor ring's members
// past the horizontal edges of a ~375px-wide screen (center ± 190 overshoots
// a 375px width on either side once the node's own ~37px half-width is
// added in), physically unreachable to tap. 110px keeps a full-diameter ring
// (220px) comfortably inside even a narrow phone width.
export const RADIAL_MAX_NEIGHBORS = 10;
export const radialNeighborRadius = () => (isMobileViewport() ? 110 : 190);

// Arranges `neighborIds` evenly in a circle around `center`, kept inside
// `bounds`. Same fix as QuickAddGhosts' own ring-centering: without bounds
// awareness — just `center + radius`, trusting centerOnNode to have put
// `center` in the middle of the screen — a node close enough to the edge of
// the whole 2400x1600 canvas (nothing left to scroll into) never gets truly
// centered, and on a narrow phone viewport that's routine, so members on
// the far side of the ring would render clear off the visible screen,
// unreachable to tap. Nudging the ring's own center into a
// safe zone inside the current viewport keeps the whole ring on-screen and
// evenly spaced regardless of where the selected node itself landed.
export function computeRadialPositions(
  center: Pt,
  neighborIds: string[],
  bounds: ViewportBounds,
  radius: number = radialNeighborRadius(),
): Map<string, Pt> {
  const halfSpan = radius + 40;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  // panelReserveFrac's 1/2 mobile reserve leaves less vertical room than
  // halfSpan*2 for essentially every mobile selection, so the fallback isn't a
  // rare "tiny window" case — anchoring on `center` (still clamped into
  // `bounds`, just without the halfSpan inset) keeps neighbors visibly
  // attached to the selected node even when the full safe-zone clamp doesn't
  // fit, instead of stranding the ring mid-screen.
  const ringCenter =
    spanX >= halfSpan * 2 && spanY >= halfSpan * 2
      ? {
          x: Math.min(bounds.maxX - halfSpan, Math.max(bounds.minX + halfSpan, center.x)),
          y: Math.min(bounds.maxY - halfSpan, Math.max(bounds.minY + halfSpan, center.y)),
        }
      : {
          x: Math.min(bounds.maxX, Math.max(bounds.minX, center.x)),
          y: Math.min(bounds.maxY, Math.max(bounds.minY, center.y)),
        };
  const map = new Map<string, Pt>();
  neighborIds.forEach((id, i) => {
    const angle = (i / neighborIds.length) * Math.PI * 2 - Math.PI / 2;
    // Final per-point safety clamp: a no-op whenever the full ring already fit
    // inside the halfSpan-inset safe zone; only trims the fallback branch's
    // outermost members back into `bounds`.
    map.set(id, {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, ringCenter.x + radius * Math.cos(angle))),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, ringCenter.y + radius * Math.sin(angle))),
    });
  });
  return map;
}

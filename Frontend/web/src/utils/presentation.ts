// Pure, stateless helpers for presentation mode (see MapPage's own
// presenting/slideIndex state and PresentationOverlay) — a full-map
// slideshow that steps through a map's own nodes as "slides," with the
// canvas auto-tidied into a clean org-chart shape for the duration. Kept
// separate from canvasLayout.ts (already large, and about canvas
// *interaction* geometry — drag/obstacle-avoidance) and templates.ts (a
// different TemplateNode[] shape, for static onboarding templates) since
// these two functions share a childrenByParent walk with each other but
// nothing with either of those files' own concerns.
import { CANVAS_W, CANVAS_H, CAPTION_WIDTH } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

// Builds the parentId forest `nodes` forms: a child-list per parent (every
// parent, not just the 2+-child ones computeNodeGroups cares about) plus
// whichever nodes have no parent *inside this same list* — a node whose
// real parent isn't present (packed away, hidden, filtered out by the
// caller) reads as its own root here rather than vanishing, same as a
// literal top-level node with parentId: null.
function buildForest(nodes: NodeDoc[]) {
  const indexById = new Map(nodes.map((n, i) => [n.nodeId, i] as const));
  const childrenByParent = new Map<string, NodeDoc[]>();
  const roots: NodeDoc[] = [];
  for (const n of nodes) {
    const parentId = nodeRefId(n.parentId);
    if (parentId && indexById.has(parentId)) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(n);
    } else {
      roots.push(n);
    }
  }
  return { indexById, childrenByParent, roots };
}

// Sibling/root order: explicit Node.order first (same convention
// textExport.ts's own stepRank already uses — n.order ?? MAX_SAFE_INTEGER,
// so unnumbered nodes sort after numbered ones but keep a stable relative
// order among themselves), tied by array index in `nodes` — the backend's
// own documented creation-order convention (see nodePositions.ts's "nodes
// come back in creation order" comment elsewhere in this codebase).
function bySibling(indexById: Map<string, number>) {
  const rank = (n: NodeDoc) => n.order ?? Number.MAX_SAFE_INTEGER;
  return (a: NodeDoc, b: NodeDoc) => rank(a) - rank(b) || indexById.get(a.nodeId)! - indexById.get(b.nodeId)!;
}

// The order a presentation slideshow steps through a map's nodes: a depth-
// first walk of the parentId forest, one root's whole subtree finished
// before the next root starts. A root flagged isFirstNode leads the whole
// show when present among the roots; isFirstNode is set once at creation
// and never reassigned (see Backend/CLAUDE.md), so a map whose original
// first node was since deleted can have none at all — that case falls
// through to the ordinary array-index tie-break below it, which already
// picks the earliest-created root, so no separate fallback branch is
// needed. `visited` guards a corrupt cyclic parentId chain: each node is
// visited (and appears in the output) at most once, however its ancestors
// point.
//
// Callers are expected to hand this an already-filtered node list — see
// MapPage's own slideNodes memo, which drops weapon/protection decorator
// nodes and anything the map owner has hidden from members before this
// ever runs, since a presentation is for showing, not for drag/attack
// bookkeeping or a branch deliberately kept out of sight.
export function computeSlideOrder(nodes: NodeDoc[]): NodeDoc[] {
  const { indexById, childrenByParent, roots } = buildForest(nodes);
  const sibling = bySibling(indexById);
  for (const list of childrenByParent.values()) list.sort(sibling);
  roots.sort((a, b) => {
    if (!!a.isFirstNode !== !!b.isFirstNode) return a.isFirstNode ? -1 : 1;
    return sibling(a, b);
  });

  const out: NodeDoc[] = [];
  const visited = new Set<string>();
  function walk(n: NodeDoc) {
    if (visited.has(n.nodeId)) return;
    visited.add(n.nodeId);
    out.push(n);
    for (const c of childrenByParent.get(n.nodeId) ?? []) walk(c);
  }
  for (const r of roots) walk(r);
  // A node whose entire parentId chain loops back on itself (corrupt data —
  // every node in the cycle "has a parent," so none of them ever landed in
  // `roots` above) would otherwise never be visited at all and silently
  // vanish from the slideshow. `walk` is already idempotent, so a second
  // pass over every node, in the caller's own array order, only ever picks
  // up whatever a cycle left stranded — everything the roots pass already
  // reached is skipped via `visited`.
  for (const n of nodes) walk(n);
  return out;
}

// Presentation-mode column/row spacing — same COLUMN formula
// templates.ts's own layoutTemplate uses (CAPTION_WIDTH, the widest thing a
// node actually draws, plus a gap), so a geometrized node's own footprint
// doesn't crowd its neighbors any tighter than a template-seeded one does.
const COLUMN = CAPTION_WIDTH + 20;
const ROW = 170;
// Clear gap between one root's whole tree and the next when a map has more
// than one — wider than COLUMN alone so two unrelated trees read as
// visibly separate "stories," not one continuous row.
const FOREST_GAP = COLUMN * 2;

// A clean, deterministic org-chart layout for `nodes`' own parentId forest
// — each tree hangs top-to-bottom by depth, a subtree's own column width
// set by its leaf count (same leaves() idea templates.ts's layoutTemplate
// already uses), multiple root-level trees placed left-to-right beside each
// other. Deliberately simpler than layoutTemplate itself: no off-canvas/
// overlap scoring or two-direction trial — presentation mode owns the
// whole canvas for its own duration (nothing existing to avoid landing on),
// and top-to-bottom is the only direction that reads naturally as an
// outline/slideshow order, so there's nothing worth scoring between
// alternatives. Pure — returns absolute canvas coordinates and touches
// nothing else; MapPage blends the live canvas toward these the same
// non-destructive way it already blends toward radialPositions (see
// useRadialBlend), never writing any of this back to a node's own stored
// x/y.
export function computeGeometrizedPositions(nodes: NodeDoc[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return out;
  const { indexById, childrenByParent, roots } = buildForest(nodes);
  const sibling = bySibling(indexById);
  for (const list of childrenByParent.values()) list.sort(sibling);
  roots.sort(sibling);

  const leaves = (n: NodeDoc): number => {
    const kids = childrenByParent.get(n.nodeId);
    return kids?.length ? kids.reduce((sum, c) => sum + leaves(c), 0) : 1;
  };

  let cursor = 0; // running left edge across the whole forest
  for (const root of roots) {
    const width = leaves(root);
    const place = (n: NodeDoc, left: number, depth: number) => {
      const w = leaves(n);
      const x = left + ((w - 1) * COLUMN) / 2;
      const y = depth * ROW + ROW; // ROW of clearance above the first row
      out.set(n.nodeId, { x, y });
      let childCursor = left;
      for (const c of childrenByParent.get(n.nodeId) ?? []) {
        place(c, childCursor, depth + 1);
        childCursor += leaves(c) * COLUMN;
      }
    };
    place(root, cursor, 0);
    cursor += width * COLUMN + FOREST_GAP;
  }

  // Recenter the whole forest on the fixed 2400x1600 canvas — it was built
  // growing rightward/downward from (0,0) above, with no regard for where
  // the canvas actually is, so shift every point by the same amount at the
  // end rather than threading a canvas-center offset through the recursion
  // itself.
  const xs = [...out.values()].map((p) => p.x);
  const ys = [...out.values()].map((p) => p.y);
  const shiftX = CANVAS_W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const shiftY = Math.max(80, CANVAS_H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2);
  for (const [id, p] of out) out.set(id, { x: p.x + shiftX, y: p.y + shiftY });
  return out;
}

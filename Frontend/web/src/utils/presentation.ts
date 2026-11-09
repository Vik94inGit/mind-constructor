// Pure, stateless helpers for presentation mode (see MapPage's own
// presenting/slideIndex state and PresentationOverlay) — a full-map
// slideshow that steps through a map's own nodes as "slides". Kept
// separate from canvasLayout.ts (already large, and about canvas
// *interaction* geometry — drag/obstacle-avoidance) and templates.ts (a
// different TemplateNode[] shape, for static onboarding templates) since
// these two functions share a childrenByParent walk with each other but
// nothing with either of those files' own concerns.
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

// When a node was made: its createdAt, tied by its place in `nodes` (the
// backend hands nodes back in creation order). A node with no createdAt
// sorts ahead of dated ones, keeping its place among them.
function byCreation(indexById: Map<string, number>) {
  return (a: NodeDoc, b: NodeDoc) => {
    const at = a.createdAt ?? "";
    const bt = b.createdAt ?? "";
    return at < bt ? -1 : at > bt ? 1 : indexById.get(a.nodeId)! - indexById.get(b.nodeId)!;
  };
}

// Children in their numbered steps first (Node.order: a text that ran past a
// node's limit and was carried on into numbered pieces, a template's steps),
// so a sliced text reads in the order it was written however its pieces
// ended up placed. Unnumbered children then read left to right, the way they
// sit on the canvas (their stored x), so the slideshow agrees with what the
// user laid out. Ties fall back to the sibling order.
function leftToRight(indexById: Map<string, number>) {
  const sibling = bySibling(indexById);
  const rank = (n: NodeDoc) => n.order ?? Number.MAX_SAFE_INTEGER;
  return (a: NodeDoc, b: NodeDoc) => rank(a) - rank(b) || (a.x ?? 0) - (b.x ?? 0) || sibling(a, b);
}

// The order a presentation slideshow steps through a map's nodes: the
// parents (every node with children, and every root) in the order they were
// made, each followed straight away by its own children (numbered steps in
// step order, the rest left to right) — so
// a slide's parent has just been shown, and the overlay names it. A child
// that is itself a parent shows among its siblings, and its own children
// follow when its turn as a parent comes. Each node shows once. A root
// flagged isFirstNode leads the show when present. A trailing pass in the
// caller's array order picks up anything a corrupt cyclic parentId chain
// left out (every node in the cycle "has a parent", so none is a root).
//
// Callers are expected to hand this an already-filtered node list — see
// usePresentation's own slideNodes memo, which drops weapon/protection
// decorator nodes and anything the map owner has hidden from members before
// this ever runs, since a presentation is for showing, not for drag/attack
// bookkeeping or a branch deliberately kept out of sight.
// Every root and every node with children, in the order they head their
// part of the show (an isFirstNode root first, then by when they were
// made), with each one's children sorted left to right.
function slideParents(nodes: NodeDoc[]) {
  const { indexById, childrenByParent, roots } = buildForest(nodes);
  const order = leftToRight(indexById);
  for (const list of childrenByParent.values()) list.sort(order);
  const created = byCreation(indexById);
  const rootIds = new Set(roots.map((r) => r.nodeId));
  const leads = (n: NodeDoc) => (n.isFirstNode && rootIds.has(n.nodeId) ? 0 : 1);
  const parents = nodes
    .filter((n) => rootIds.has(n.nodeId) || childrenByParent.has(n.nodeId))
    .sort((a, b) => leads(a) - leads(b) || created(a, b));
  return { parents, childrenByParent, rootIds };
}

export function computeSlideOrder(nodes: NodeDoc[]): NodeDoc[] {
  const { parents, childrenByParent } = slideParents(nodes);

  const out: NodeDoc[] = [];
  const shown = new Set<string>();
  const show = (n: NodeDoc) => {
    if (shown.has(n.nodeId)) return;
    shown.add(n.nodeId);
    out.push(n);
  };
  for (const p of parents) {
    show(p);
    for (const c of childrenByParent.get(p.nodeId) ?? []) show(c);
  }
  for (const n of nodes) show(n);
  return out;
}

/** One slide: a parent and the children hanging from it (none for a lone root). */
export interface SlideGroup {
  node: NodeDoc;
  children: NodeDoc[];
}

// The slides a presentation steps through: one per node, each carrying the
// children hanging from it (left to right, as cards the viewer can tap to
// jump to). The order goes level by level within each tree: a parent, then
// all of its own children one after another, then the next parent — the
// first of those children that has children of its own — and its children,
// and so on, so a parent's children are never interrupted by a grandchild.
// Trees come in computeSlideOrder's root order (an isFirstNode root first,
// then by when they were made). Nodes a corrupt parent loop kept out of
// every tree are walked last, so each still shows once.
export function computeSlideGroups(nodes: NodeDoc[]): SlideGroup[] {
  const { parents, childrenByParent, rootIds } = slideParents(nodes);
  const groups: SlideGroup[] = [];
  const shown = new Set<string>();
  const walk = (start: NodeDoc) => {
    if (shown.has(start.nodeId)) return;
    shown.add(start.nodeId);
    const queue = [start];
    while (queue.length > 0) {
      const node = queue.shift()!;
      const children = childrenByParent.get(node.nodeId) ?? [];
      groups.push({ node, children });
      for (const c of children) {
        if (shown.has(c.nodeId)) continue;
        shown.add(c.nodeId);
        queue.push(c);
      }
    }
  };
  for (const root of parents.filter((p) => rootIds.has(p.nodeId))) walk(root);
  for (const n of nodes) walk(n);
  return groups;
}

/**
 * How big a slide's headline (its node's title, else its text) is drawn, so a
 * long thought still fits on the screen: the longer the text, the smaller the
 * step, and past a few lines it reads left-aligned like a paragraph instead
 * of a centered heading. `compact` (children share the slide) starts a step
 * smaller so the children fit under it.
 */
export function slideHeadSize(text: string, compact: boolean): { size: string; align: "center" | "left" } {
  const len = text.trim().length;
  if (len > 280) return { size: "text-[1.1rem] sm:text-[1.3rem]", align: "left" };
  if (len > 140) return { size: "text-[1.25rem] sm:text-[1.6rem]", align: "left" };
  if (len > 60 || compact)
    return { size: len > 60 ? "text-[1.4rem] sm:text-[1.9rem]" : "text-[1.6rem] sm:text-[2.2rem]", align: "center" };
  return { size: "text-[2rem] sm:text-[2.8rem]", align: "center" };
}

/** The same for the slide's second line (its text, under a title). */
export function slideSubSize(text: string): { size: string; align: "center" | "left" } {
  const len = text.trim().length;
  if (len > 280) return { size: "text-[0.95rem]", align: "left" };
  if (len > 120) return { size: "text-[1.05rem]", align: "left" };
  return { size: "text-[1.15rem]", align: "center" };
}

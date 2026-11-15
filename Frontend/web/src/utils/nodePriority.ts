import { CAPTION_WIDTH, nodeZoomScale } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
import type { ReadingMode } from "./readingMode";
import type { NodeDoc, SizeTier } from "../types";

type Pt = { x: number; y: number };

// See Node.sizeTier's own doc comment (backend + types/index.ts) for the
// null-vs-1 "never touched" contract — this is just the *visual* scale each
// tier renders at.
const SIZE_MULTIPLIERS: Record<SizeTier, number> = { 1: 1, 2: 1.15, 3: 1.3 };
// The simplified view shrinks every icon to this share of its normal size.
const COMPACT_SCALE = 0.8;

/** The scale NodeCard draws a node's icon at: a circle parent always at the biggest tier. */
export function nodeSizeMultiplier(node: Pick<NodeDoc, "sizeTier">, isCircleParent: boolean, compact: boolean): number {
  return (isCircleParent ? SIZE_MULTIPLIERS[3] : SIZE_MULTIPLIERS[node.sizeTier ?? 1]) * (compact ? COMPACT_SCALE : 1);
}

// Parents come first on the canvas: a node with at least one visible child
// paints above every child, children sit dimmed until they're looked at, and
// a child's caption never lies over a parent's caption.

/** Visible nodes that are some other visible node's parentId parent. */
export function computeParentIds(visibleNodes: NodeDoc[]): Set<string> {
  const visible = new Set(visibleNodes.map((n) => n.nodeId));
  const parents = new Set<string>();
  for (const n of visibleNodes) {
    const parentId = nodeRefId(n.parentId);
    if (parentId && parentId !== n.nodeId && visible.has(parentId)) parents.add(parentId);
  }
  return parents;
}

// One caption line (0.68rem text at 1.3 line-height) on screen, in px.
const CAPTION_LINE_PX = 14.2;
// The icon's half-height and the gaps NodeCard hangs the caption by.
const ICON_HALF_PX = 24;
const CAPTION_GAP_PX = 9.6; // mt-[0.6rem]
const NAMED_ZONE_GAP_PX = 20.8; // mt-[1.3rem], room for the zone name above the caption
const ZONE_NAME_GAP_PX = 2.4; // mt-[0.15rem]

export interface CaptionSpec {
  pos: Pt;
  /** The node's own size scale (size tier x compact) — the icon grows with it, the caption doesn't. */
  sizeMultiplier: number;
  /** Rows the caption may take: 2 normally, 4 in the icons + text mode. */
  lines: number;
  /** A circle parent with a zone name, which sits between its icon and caption. */
  namedZone?: boolean;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a node's caption (and a named zone's name) lands, in canvas units.
 * NodeCard draws it at a constant on-screen size when zoomed in (and with
 * the canvas when zoomed out, see nodeZoomScale), so every screen length
 * here is scaled the same way.
 */
export function captionBox({ pos, sizeMultiplier, lines, namedZone }: CaptionSpec, zoom: number): Box {
  const z = 1 / nodeZoomScale(zoom);
  const topGap = namedZone ? ZONE_NAME_GAP_PX : CAPTION_GAP_PX;
  const captionGap = namedZone ? NAMED_ZONE_GAP_PX : CAPTION_GAP_PX;
  const top = pos.y + ((ICON_HALF_PX + topGap) * sizeMultiplier) / z;
  const bottom = pos.y + ((ICON_HALF_PX + captionGap) * sizeMultiplier + lines * CAPTION_LINE_PX) / z;
  const half = CAPTION_WIDTH / 2 / z;
  return { left: pos.x - half, top, right: pos.x + half, bottom };
}

function overlaps(a: Box, b: Box, pad: number): boolean {
  return a.left < b.right + pad && b.left < a.right + pad && a.top < b.bottom + pad && b.top < a.bottom + pad;
}

/**
 * Children whose caption would lie over any parent's caption — those
 * captions are left out, so a parent's text always reads cleanly.
 */
export function childCaptionsCoveringParents(
  children: Map<string, CaptionSpec>,
  parents: CaptionSpec[],
  zoom: number,
): Set<string> {
  const pad = 4 / (zoom || 1);
  const parentBoxes = parents.map((p) => captionBox(p, zoom));
  const hidden = new Set<string>();
  for (const [id, spec] of children) {
    const box = captionBox(spec, zoom);
    if (parentBoxes.some((p) => overlaps(box, p, pad))) hidden.add(id);
  }
  return hidden;
}

/** Where a node's icon sits, in canvas units (same zoom rule as captionBox). */
export function iconBox({ pos, sizeMultiplier }: Pick<CaptionSpec, "pos" | "sizeMultiplier">, zoom: number): Box {
  const half = (ICON_HALF_PX * sizeMultiplier) / (1 / nodeZoomScale(zoom));
  return { left: pos.x - half, top: pos.y - half, right: pos.x + half, bottom: pos.y + half };
}

/**
 * Captions that would lie over another node's icon or over a caption already
 * kept, taken in order, so the first one kept wins and nothing reads on top
 * of anything else. `blocked` are the boxes already taken (parents' captions).
 */
export function captionsCoveringOthers(
  captions: Map<string, CaptionSpec>,
  icons: Map<string, CaptionSpec>,
  blocked: Box[],
  zoom: number,
): Set<string> {
  const pad = 2 / (zoom || 1);
  const iconBoxes = [...icons].map(([id, spec]) => [id, iconBox(spec, zoom)] as const);
  const kept: Box[] = [...blocked];
  const hidden = new Set<string>();
  for (const [id, spec] of captions) {
    const box = captionBox(spec, zoom);
    if (iconBoxes.some(([other, icon]) => other !== id && overlaps(box, icon, pad)) || kept.some((k) => overlaps(box, k, pad))) {
      hidden.add(id);
    } else {
      kept.push(box);
    }
  }
  return hidden;
}

/** How the canvas draws each node right now — what hiddenChildCaptions reads. */
export interface CaptionView {
  posFor: (node: NodeDoc) => Pt;
  isCircleParent: (nodeId: string) => boolean;
  modeOf: (nodeId: string) => ReadingMode;
  dottedByZone: (nodeId: string) => boolean;
  compact: boolean;
  zoom: number;
  selectedId: string | null;
  inlineEditId: string | null;
  /** Whether a node that isn't a parent shows a caption at all (NodeCard's showCaption); absent: only parents' captions are weighed. */
  hasCaption?: (node: NodeDoc) => boolean;
}

/**
 * The children whose caption would lie over a shown parent's caption, so are
 * left out. A parent's caption is up unless its card *is* the node (the cards
 * and mixed reading modes), it's drawn as a dot, or it's selected/being
 * edited (NodeCard drops it then).
 */
export function hiddenChildCaptions(visibleNodes: NodeDoc[], parentIds: Set<string>, view: CaptionView): Set<string> {
  const captionSpec = (n: NodeDoc): CaptionSpec => {
    const isCircleParent = view.isCircleParent(n.nodeId);
    return {
      pos: view.posFor(n),
      sizeMultiplier: nodeSizeMultiplier(n, isCircleParent, view.compact),
      lines: view.modeOf(n.nodeId) === "iconText" ? 4 : 2,
      namedZone: isCircleParent && !!n.zoneName && !view.compact,
    };
  };
  const shownParents = visibleNodes.filter(
    (n) =>
      parentIds.has(n.nodeId) &&
      !["puzzle", "mixed"].includes(view.modeOf(n.nodeId)) &&
      !view.dottedByZone(n.nodeId) &&
      view.selectedId !== n.nodeId &&
      view.inlineEditId !== n.nodeId,
  );
  const children = new Map<string, CaptionSpec>();
  for (const n of visibleNodes) {
    if (!parentIds.has(n.nodeId)) children.set(n.nodeId, captionSpec(n));
  }
  const parentSpecs = shownParents.map(captionSpec);
  const hidden = shownParents.length > 0 ? childCaptionsCoveringParents(children, parentSpecs, view.zoom) : new Set<string>();
  if (!view.hasCaption) return hidden;
  // Then the other captions, in map order: one that would lie over another
  // node's icon or a caption already kept is left out too (its text still
  // shows on hover), so a crowded spot reads as icons, not stacked text.
  const byId = new Map(visibleNodes.map((n) => [n.nodeId, n]));
  const others = new Map<string, CaptionSpec>();
  for (const [id, spec] of children) {
    const n = byId.get(id)!;
    if (hidden.has(id) || !view.hasCaption(n) || view.selectedId === id || view.inlineEditId === id) continue;
    if (["puzzle", "mixed"].includes(view.modeOf(id)) || view.dottedByZone(id)) continue;
    others.set(id, spec);
  }
  const icons = new Map(visibleNodes.map((n) => [n.nodeId, captionSpec(n)]));
  const blocked = parentSpecs.map((p) => captionBox(p, view.zoom));
  for (const id of captionsCoveringOthers(others, icons, blocked, view.zoom)) hidden.add(id);
  return hidden;
}

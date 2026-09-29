import { CAPTION_WIDTH } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
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
 * NodeCard draws it at a constant on-screen size, so every screen length
 * here is divided by the zoom.
 */
export function captionBox({ pos, sizeMultiplier, lines, namedZone }: CaptionSpec, zoom: number): Box {
  const z = zoom || 1;
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

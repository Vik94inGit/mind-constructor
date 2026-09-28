import type { NodeDoc } from "../types";
import type { ReadingMode } from "./readingMode";

// Per-node display: which of the reading modes (see readingMode.ts) a
// particular node is drawn in, overriding the map-wide one — so a chosen group
// can be read as a classical mind map while the rest of the map stays as it is.
// Kept per browser and per map (a viewer's own way of looking, not something
// shared with the map's other members).
export type NodeDisplay = Record<string, ReadingMode>;

const storageKey = (mapId: string | undefined) => `mc_node_display:${mapId ?? ""}`;

export function loadNodeDisplay(mapId: string | undefined): NodeDisplay {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: NodeDisplay = {};
    for (const [id, mode] of Object.entries(parsed)) {
      if (mode === "classic" || mode === "iconText" || mode === "actual") out[id] = mode;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveNodeDisplay(mapId: string | undefined, display: NodeDisplay): void {
  try {
    if (Object.keys(display).length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(display));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

// How much room a node takes up on screen, in pixels. A node draws at a constant
// on-screen size whatever the canvas zoom is (see NodeCard's counter-scale), so
// zooming in spreads the nodes' positions apart without making the nodes bigger
// — which is what makes zoom the way to stop expanded nodes overlapping.
//
// Rough by design: the default look is a fixed icon-plus-caption box; the two
// text modes are estimated from the text's length (a card is up to ~240px wide
// and wraps at about 36 characters a line). Deliberately a little generous.
// The box is centered on the node's position, so where a caption hangs below
// the icon the height is doubled to cover it.
export function nodeFootprint(node: NodeDoc, mode: ReadingMode, sizeMultiplier: number): { w: number; h: number } {
  const title = node.title?.trim() ?? "";
  // A node whose text hasn't loaded yet still needs a size — assume a modest sentence.
  const textLength = node.text ? node.text.length : 40;
  const chars = Math.max(12, title.length + textLength);
  let w: number;
  let h: number;
  if (mode === "classic") {
    const lines = Math.ceil(chars / 36) + (title ? 1 : 0);
    w = Math.min(240, Math.max(110, Math.min(chars, 36) * 6.4 + 26));
    h = 24 + lines * 16;
  } else if (mode === "iconText") {
    const lines = Math.min(4, Math.ceil(chars / 30));
    w = 180;
    h = 2 * (32 + lines * 14);
  } else {
    w = 150;
    h = 100;
  }
  return { w: w * sizeMultiplier, h: h * sizeMultiplier };
}

export interface FootprintItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP_X = 14;
const GAP_Y = 10;

// The smallest canvas zoom at which no node's own footprint box overlaps
// another's. Two boxes are clear of each other once they are far enough
// apart horizontally OR vertically, so for a pair that is the cheaper of
// the two; the answer is the worst pair. Nodes at exactly the same spot
// can't be separated by zooming and are ignored. Returns a scale factor ≥ 0
// (compare it with the current zoom: anything at or below it is already
// fine).
//
// Every pair is checked now, not just ones in a text reading mode — a node
// draws at a constant on-screen size whatever the canvas zoom is (see
// nodeFootprint's own doc comment), so the same "zoom in to make room"
// fix applies just as well to two icon-mode nodes placed closer together
// than their own 150x100 footprint, which does happen (a freshly-loaded
// node with no stored position, a zone that's grown crowded over time) —
// the old text-mode-only check meant a map that never left the default
// icon view had no way to ever trigger this at all, however crowded it
// got.
export function zoomToSeparate(items: FootprintItem[]): number {
  let needed = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx === 0 && dy === 0) continue;
      const needX = dx > 0 ? ((a.w + b.w) / 2 + GAP_X) / dx : Infinity;
      const needY = dy > 0 ? ((a.h + b.h) / 2 + GAP_Y) / dy : Infinity;
      needed = Math.max(needed, Math.min(needX, needY));
    }
  }
  return needed;
}

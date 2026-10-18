import { computeBasePositions } from "./nodePositions";
import { nodeRefId } from "./nodeType";
import type { CardShape, EdgeDoc, EdgeSentiment, NodeDoc, NodeShape, NodeType, SizeTier, SymbolOverride, ManualZoneColor } from "../types";

// The app's own copy/paste of nodes — what "Copy" in the selection menu, the
// "+" menu's "Copy whole map", the dashboard's "Copy map" and Ctrl/Cmd+C all
// write, and what "Paste", "Paste here" and Ctrl/Cmd+V read. A snapshot, not
// a live link: text, pictures, emoji, look and layout of each node, which of the copied nodes
// is whose branch child (`parentId`), and the connections among them (`edges`).
// Health, attacks, protection and packing don't carry over, and neither does
// anything pointing at a node that wasn't copied.
//
// Kept in localStorage rather than in memory so it survives a reload and is
// shared between browser tabs: copy on one map, open another map (or another
// tab), paste.
export interface ClipboardNode {
  /** The node's id on the map it was copied from — only ever used to wire `parentId`/`edges` up again on paste. */
  id: string;
  text: string;
  title?: string;
  type: NodeType;
  x: number;
  y: number;
  /** `id` of this node's branch parent, when that parent was copied too; null otherwise. */
  parentId: string | null;
  order?: number | null;
  symbolOverride?: SymbolOverride | null;
  sizeTier?: SizeTier | null;
  manualZone?: ManualZoneColor | null;
  emoji?: string;
  emojiStill?: boolean;
  shape?: NodeShape | null;
  cardW?: number | null;
  cardH?: number | null;
  cardFont?: number | null;
  cardShape?: CardShape | null;
  /** Addresses of the node's pictures (NodeDoc.images); the paste fetches them and sends them as new pictures, since a node can't point at another node's stored picture. */
  images?: string[];
  iconImage?: string;
  cardImage?: string;
}

export interface ClipboardEdge {
  from: string;
  to: string;
  sentiment: EdgeSentiment;
}

export interface NodeClipboard {
  sourceMapId: string;
  nodes: ClipboardNode[];
  edges: ClipboardEdge[];
}

const STORAGE_KEY = "mc_node_clipboard";

export function readNodeClipboard(): NodeClipboard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NodeClipboard;
    if (!parsed || typeof parsed.sourceMapId !== "string" || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      return null;
    }
    return { ...parsed, edges: Array.isArray(parsed.edges) ? parsed.edges : [] };
  } catch {
    return null;
  }
}

/** How many nodes are on the clipboard (0 when empty) — for labeling a Paste action. */
export function nodeClipboardSize(): number {
  return readNodeClipboard()?.nodes.length ?? 0;
}

/** Returns false when the browser refused to store it (quota, blocked storage). */
export function writeNodeClipboard(clipboard: NodeClipboard): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clipboard));
    return true;
  } catch {
    return false;
  }
}

// Builds a clipboard snapshot of `pickIds` (or every node, when omitted) out of
// one map's nodes and edges. `allNodes` is the whole map even when only some are
// picked — a node without a stored x/y is laid out by rule (computeBasePositions)
// relative to the rest, so its position needs the whole set. `textById` supplies
// each picked node's real text (the map list doesn't carry it), and
// `imagesById` its pictures (nor does it carry those). Weapon and
// protection nodes are left out: they only mean something next to the node they
// were aimed at.
export function buildNodeClipboard(
  sourceMapId: string,
  allNodes: NodeDoc[],
  pickIds: string[] | null,
  textById: Record<string, string>,
  edges: EdgeDoc[],
  imagesById: Record<string, string[]> = {},
): NodeClipboard | null {
  const positions = computeBasePositions(allNodes);
  const wanted = pickIds ? new Set(pickIds) : null;
  const picked = allNodes.filter(
    (n) => !n.isWeapon && !n.isProtection && !n.packedIntoNodeId && (!wanted || wanted.has(n.nodeId)),
  );
  if (picked.length === 0) return null;
  const inSet = new Set(picked.map((n) => n.nodeId));

  const nodes: ClipboardNode[] = picked.map((n) => {
    const pos = positions.get(n.nodeId) ?? { x: 0, y: 0 };
    const parent = nodeRefId(n.parentId);
    return {
      id: n.nodeId,
      text: textById[n.nodeId] ?? n.text,
      title: n.title || undefined,
      type: n.type,
      x: pos.x,
      y: pos.y,
      parentId: parent && inSet.has(parent) ? parent : null,
      order: n.order ?? null,
      symbolOverride: n.symbolOverride ?? null,
      sizeTier: n.sizeTier ?? null,
      manualZone: n.manualZone ?? null,
      ...(n.emoji ? { emoji: n.emoji, emojiStill: !!n.emojiStill } : {}),
      ...(n.shape ? { shape: n.shape } : {}),
      ...(n.cardW != null ? { cardW: n.cardW } : {}),
      ...(n.cardH != null ? { cardH: n.cardH } : {}),
      ...(n.cardFont != null ? { cardFont: n.cardFont } : {}),
      ...(n.cardShape ? { cardShape: n.cardShape } : {}),
      ...(imagesById[n.nodeId]?.length ? { images: imagesById[n.nodeId] } : {}),
      ...(n.iconImage ? { iconImage: n.iconImage } : {}),
      ...(n.cardImage ? { cardImage: n.cardImage } : {}),
    };
  });

  const clipEdges: ClipboardEdge[] = [];
  for (const e of edges) {
    const from = nodeRefId(e.fromNodeId);
    const to = nodeRefId(e.toNodeId);
    if (from && to && inSet.has(from) && inSet.has(to)) clipEdges.push({ from, to, sentiment: e.sentiment });
  }
  return { sourceMapId, nodes, edges: clipEdges };
}

/**
 * What a pasted node gets after it is made: its emoji, look and pictures, the
 * pictures turned into data URLs by `toDataUrl` (null drops one that can't be
 * read any more). Empty when there is nothing to add.
 */
export async function pastedExtras(n: ClipboardNode, toDataUrl: (ref: string) => Promise<string | null>): Promise<Partial<NodeDoc>> {
  const out: Partial<NodeDoc> = {};
  if (n.emoji) {
    out.emoji = n.emoji;
    if (n.emojiStill) out.emojiStill = true;
  }
  if (n.shape) out.shape = n.shape;
  if (n.cardW != null) out.cardW = n.cardW;
  if (n.cardH != null) out.cardH = n.cardH;
  if (n.cardFont != null) out.cardFont = n.cardFont;
  if (n.cardShape) out.cardShape = n.cardShape;
  const [images, iconImage, cardImage] = await Promise.all([
    Promise.all((n.images ?? []).map(toDataUrl)),
    n.iconImage ? toDataUrl(n.iconImage) : null,
    n.cardImage ? toDataUrl(n.cardImage) : null,
  ]);
  const kept = images.filter((x): x is string => !!x);
  if (kept.length) out.images = kept;
  if (iconImage) out.iconImage = iconImage;
  if (cardImage) out.cardImage = cardImage;
  return out;
}

import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { CANVAS_H, CANVAS_W, NODE_FOOTPRINT, footprintObstacles, hasClearSpot, pickNonOverlappingPosition } from "./canvasLayout";
import { MIN_NODE_GAP } from "./zoneRules";
import { areaCountOf, areaOf, MAX_MAP_AREAS } from "./mapAreas";
import { buildNodeClipboard, pastedExtras } from "./nodeClipboard";
import { computeBasePositions } from "./nodePositions";
import { nodeRefId } from "./nodeType";
import { pictureDataUrl } from "./images";
import type { MapDoc, NodeDoc } from "../types";

// The Inbox: one personal map a quick note lands in when there's no time to
// choose a map — jot now, sort later. It's an ordinary map (personal mode, no
// starter structure); which one it is lives in this browser, with a fallback
// to an owned map of the same name so a second device finds the same one.
const INBOX_KEY = "mc_inbox_map";
const COLUMNS = 5;
const ROWS = 8;
const STEP_X = 190;
const STEP_Y = 150;
const TOP = 260;

function rememberedInbox(userId: string): string | null {
  try {
    return localStorage.getItem(`${INBOX_KEY}:${userId}`);
  } catch {
    return null;
  }
}

function rememberInbox(userId: string, mapId: string) {
  try {
    localStorage.setItem(`${INBOX_KEY}:${userId}`, mapId);
  } catch {
    // best-effort — the name fallback still finds it
  }
}

/** The user's Inbox map from `maps`, if there is one. */
export function findInbox(maps: MapDoc[], userId: string, name: string): MapDoc | null {
  const remembered = rememberedInbox(userId);
  return (
    (remembered ? maps.find((m) => m.mapId === remembered) : undefined) ??
    maps.find((m) => m.ownerId === userId && m.name === name) ??
    null
  );
}

type Pt = { x: number; y: number };

// Every spot a note can take on one area of the Inbox: first the block of
// rows in the middle (where the first notes always went), then the rest of
// the canvas, row by row, kept clear of its edges.
const EDGE = 120;
const NOTE_SPOTS: Pt[] = (() => {
  const x0 = CANVAS_W / 2 - ((COLUMNS - 1) / 2) * STEP_X;
  const firstCol = -Math.floor((x0 - EDGE) / STEP_X);
  const lastCol = Math.floor((CANVAS_W - EDGE - x0) / STEP_X);
  const lastRow = Math.floor((CANVAS_H - EDGE - TOP) / STEP_Y);
  const at = (c: number, r: number) => ({ x: x0 + c * STEP_X, y: TOP + r * STEP_Y });
  const spots: Pt[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLUMNS; c++) spots.push(at(c, r));
  for (let r = 0; r <= lastRow; r++) {
    for (let c = firstCol; c <= lastCol; c++) {
      if (r < ROWS && c >= 0 && c < COLUMNS) continue;
      spots.push(at(c, r));
    }
  }
  return spots;
})();

/** How many notes one area of the Inbox holds. */
export const NOTES_PER_AREA = NOTE_SPOTS.length;

/** Where the n-th note of an area goes: left to right in rows under the top, then out to the sides. */
export function notePosition(n: number): Pt {
  return NOTE_SPOTS[((n % NOTES_PER_AREA) + NOTES_PER_AREA) % NOTES_PER_AREA];
}

/**
 * The first free note spot on an area that already has notes at `taken`,
 * trying the `count`-th spot first (where the next note goes when nothing
 * was moved): null once every spot is covered.
 */
export function freeNoteSpot(taken: Pt[], count: number): Pt | null {
  const covered = (p: Pt) => taken.some((q) => Math.abs(q.x - p.x) < NODE_FOOTPRINT.w && Math.abs(q.y - p.y) < NODE_FOOTPRINT.h);
  for (let i = 0; i < NOTES_PER_AREA; i++) {
    const p = notePosition(count + i);
    if (!covered(p)) return p;
  }
  return null;
}

/** A map (or the Inbox) has no room left on any of its areas, and can't get another. */
export class MapFullError extends Error {
  constructor(readonly which: "inbox" | "target") {
    super(which === "inbox" ? "The Inbox is full" : "That map is full");
  }
}

/** Saves `text` as a new node on the Inbox map, making the map first if needed. */
export async function addQuickNote(
  text: string,
  maps: MapDoc[],
  userId: string,
  name: string,
): Promise<{ map: MapDoc; node: NodeDoc; created: boolean }> {
  let map = findInbox(maps, userId, name);
  const created = !map;
  if (!map) map = await mapsApi.createMap({ name, ownerColor: "#22c55e", color: "#8a9a5b", discussionMode: false });
  rememberInbox(userId, map.mapId);
  const notes = created ? [] : (await nodesApi.listNodes(map.mapId)).filter((n) => !n.isWeapon && !n.isProtection);
  // Area by area: the first one with a free spot takes the note; once every
  // area the Inbox has is full, it grows another (up to MAX_MAP_AREAS). A
  // note never lands on top of another.
  for (let area = 0; area < MAX_MAP_AREAS; area++) {
    const here = notes.filter((n) => areaOf(n) === area);
    const taken = here.filter((n) => typeof n.x === "number" && typeof n.y === "number").map((n) => ({ x: n.x!, y: n.y! }));
    const at = freeNoteSpot(taken, here.length);
    if (!at) continue;
    if (area >= areaCountOf(map)) map = await mapsApi.updateMap(map.mapId, { areaCount: area + 1 });
    const node = await nodesApi.createNode(map.mapId, { text, type: "unknown", x: at.x, y: at.y, parentId: null, area });
    return { map, node, created };
  }
  throw new MapFullError("inbox");
}

/** The Inbox's notes still to sort: its top-level nodes, oldest first. */
export function unsortedNotes(nodes: NodeDoc[]): NodeDoc[] {
  return nodes
    .filter((n) => !n.isWeapon && !n.isProtection && !n.packedIntoNodeId && !nodeRefId(n.parentId))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/** A note and every node hanging from it: what moves when the note moves. */
export function noteBranch(nodes: NodeDoc[], noteId: string): string[] {
  const ids = [noteId];
  for (let i = 0; i < ids.length; i++) {
    for (const n of nodes) if (nodeRefId(n.parentId) === ids[i] && !ids.includes(n.nodeId)) ids.push(n.nodeId);
  }
  return ids;
}

/** Maps a note can be moved to: any but the Inbox itself and finished discussions. */
export function moveTargets(maps: MapDoc[], inboxId: string): MapDoc[] {
  return maps.filter((m) => m.mapId !== inboxId && !m.finishedAt);
}

/**
 * Moves an Inbox note, with its branch and the links inside it, onto `target`:
 * made there as new nodes on a free spot, then taken off the Inbox. Returns
 * the nodes made on `target`.
 */
export async function moveNoteToMap(inboxId: string, noteId: string, target: MapDoc, userId?: string): Promise<NodeDoc[]> {
  const [inboxNodes, inboxEdges, targetNodes] = await Promise.all([
    nodesApi.listNodes(inboxId),
    edgesApi.listEdges(inboxId),
    nodesApi.listNodes(target.mapId),
  ]);
  const ids = noteBranch(inboxNodes, noteId);
  // The node list leaves text and pictures out, so they're fetched for the branch.
  const [textById, full] = await Promise.all([
    mapsApi.getNodesText(inboxId, ids),
    Promise.all(ids.map((id) => nodesApi.getNode(id).catch(() => null))),
  ]);
  const imagesById: Record<string, string[]> = {};
  for (const n of full) if (n?.images?.length) imagesById[n.nodeId] = n.images;
  const clip = buildNodeClipboard(inboxId, inboxNodes, ids, textById, inboxEdges, imagesById);
  if (!clip) return [];

  // The branch keeps its shape, its middle on a free spot of the target map:
  // on the first of its areas with room, or on a new one when it's the
  // mover's own map. With no room anywhere nothing is made and the note stays.
  const placed = targetNodes.filter((n) => !n.isWeapon && !n.isProtection);
  const positions = computeBasePositions(placed);
  // Its areas as they are now: an earlier move may have just added one.
  let fresh = target;
  try {
    fresh = await mapsApi.getMap(target.mapId);
  } catch {
    // offline or not loaded: the list's copy will do
  }
  const count = areaCountOf(fresh);
  let area = -1;
  let taken: Pt[] = [];
  for (let a = 0; a < count && area < 0; a++) {
    const here = placed.filter((n) => areaOf(n) === a).map((n) => positions.get(n.nodeId)).filter((p): p is Pt => !!p);
    if (hasClearSpot(footprintObstacles(here, MIN_NODE_GAP))) {
      area = a;
      taken = here;
    }
  }
  if (area < 0) {
    if (!userId || target.ownerId !== userId || count >= MAX_MAP_AREAS) throw new MapFullError("target");
    await mapsApi.updateMap(target.mapId, { areaCount: count + 1 });
    area = count;
  }
  const anchor = pickNonOverlappingPosition(taken);
  const cx = clip.nodes.reduce((sum, n) => sum + n.x, 0) / clip.nodes.length;
  const cy = clip.nodes.reduce((sum, n) => sum + n.y, 0) / clip.nodes.length;

  // A node can only be made once the node it hangs from exists, so in waves.
  const newIdBySource = new Map<string, string>();
  const created: NodeDoc[] = [];
  let pending = clip.nodes.slice();
  while (pending.length > 0) {
    let ready = pending.filter((n) => !n.parentId || newIdBySource.has(n.parentId));
    if (ready.length === 0) ready = pending;
    const batch = await Promise.all(
      ready.map(async (n) => {
        let node = await nodesApi.createNode(target.mapId, {
          text: n.text,
          title: n.title,
          type: n.type,
          x: n.x - cx + anchor.x,
          y: n.y - cy + anchor.y,
          parentId: n.parentId ? (newIdBySource.get(n.parentId) ?? null) : null,
          order: n.order,
          symbolOverride: n.symbolOverride,
          sizeTier: n.sizeTier,
          manualZone: n.manualZone,
          area,
        });
        const extras = await pastedExtras(n, pictureDataUrl);
        if (Object.keys(extras).length) node = await nodesApi.updateNode(node.nodeId, extras);
        return node;
      }),
    );
    ready.forEach((n, i) => newIdBySource.set(n.id, batch[i].nodeId));
    created.push(...batch);
    const done = new Set(ready.map((n) => n.id));
    pending = pending.filter((n) => !done.has(n.id));
  }
  await Promise.all(
    clip.edges.map((e) => {
      const from = newIdBySource.get(e.from);
      const to = newIdBySource.get(e.to);
      return from && to ? edgesApi.createEdge(target.mapId, { fromNodeId: from, toNodeId: to, sentiment: e.sentiment }) : null;
    }),
  );
  // Only once it's all on the target, so a failure never loses the note.
  await nodesApi.deleteManyNodes(ids);
  return created;
}

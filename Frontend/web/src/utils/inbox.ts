import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { CANVAS_W, pickNonOverlappingPosition } from "./canvasLayout";
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

/** Where the n-th note goes: left to right in rows under the top, a fresh sheet slightly offset once one fills up. */
export function notePosition(n: number): { x: number; y: number } {
  const perSheet = COLUMNS * ROWS;
  const sheet = Math.floor(n / perSheet);
  const i = n % perSheet;
  return {
    x: CANVAS_W / 2 - ((COLUMNS - 1) / 2) * STEP_X + (i % COLUMNS) * STEP_X + sheet * 24,
    y: TOP + Math.floor(i / COLUMNS) * STEP_Y + sheet * 24,
  };
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
  const count = created ? 0 : (await nodesApi.listNodes(map.mapId)).filter((n) => !n.isWeapon && !n.isProtection).length;
  const at = notePosition(count);
  const node = await nodesApi.createNode(map.mapId, { text, type: "unknown", x: at.x, y: at.y, parentId: null });
  return { map, node, created };
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
export async function moveNoteToMap(inboxId: string, noteId: string, target: MapDoc): Promise<NodeDoc[]> {
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

  // The branch keeps its shape, its middle on a free spot of the target map.
  const taken = Array.from(computeBasePositions(targetNodes.filter((n) => !n.isWeapon && !n.isProtection)).values());
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

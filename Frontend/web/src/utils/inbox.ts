import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import { CANVAS_W } from "./canvasLayout";
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

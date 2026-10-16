// A discussion's change history (models/NodeRevision.ts). In a discussion
// (Map.discussionMode !== false) every edit of a node's text, title or type,
// and every deletion, is kept, and every member can read the whole list —
// so a point can't be quietly rewritten or taken back after someone answered
// it. Recording never fails the edit itself: a lost history row is logged,
// not thrown.
import { getMapByIdDao, getMapByInternalIdDao } from "../dao/mapsDao.js";
import { listRevisionsByMapDao, logRevisionsDao } from "../dao/historyDao.js";
import type { RevisionInput } from "../dao/historyDao.js";
import { getHiddenNodesDao } from "../dao/visibilityDao.js";

export class MapNotFoundError extends Error {}

type NodeLike = {
  nodeId: string;
  mapId: unknown;
  text?: string | null;
  title?: string | null;
  type?: string | null;
};

const snap = (n: NodeLike) => ({ text: n.text ?? "", title: n.title ?? "", type: n.type ?? "" });

/** The internal map id, whether `mapId` is the raw ObjectId or populated to `{ _id, mapId }`. */
const internalMapId = (mapId: unknown) =>
  mapId && typeof mapId === "object" && "_id" in (mapId as object) ? (mapId as { _id: unknown })._id : mapId;

const inDiscussion = async (mapId: unknown) => {
  const map = await getMapByInternalIdDao(internalMapId(mapId) as never);
  return !!map && (map as { discussionMode?: boolean }).discussionMode !== false;
};

const safely = async (label: string, run: () => Promise<void>) => {
  try {
    await run();
  } catch (error) {
    console.error(`[history] ${label} not recorded:`, error);
  }
};

/** After an edit: records it when its text, title or type actually changed. */
export const recordEditAbl = async (before: NodeLike | null, after: NodeLike | null, userId: unknown) => {
  if (!before || !after) return;
  const b = snap(before);
  const a = snap(after);
  if (b.text === a.text && b.title === a.title && b.type === a.type) return;
  await safely("edit", async () => {
    if (!(await inDiscussion(before.mapId))) return;
    await logRevisionsDao([
      { mapId: internalMapId(before.mapId), nodeId: before.nodeId, userId, action: "edit", before: b, after: a },
    ]);
  });
};

/** After deleting: records each deleted node that sat on a discussion map. */
export const recordDeletionsAbl = async (nodes: NodeLike[], userId: unknown) => {
  if (nodes.length === 0) return;
  await safely("deletion", async () => {
    const discussion = new Map<string, boolean>();
    const rows: RevisionInput[] = [];
    for (const n of nodes) {
      const mapId = internalMapId(n.mapId);
      const key = String(mapId);
      if (!discussion.has(key)) discussion.set(key, await inDiscussion(mapId));
      if (!discussion.get(key)) continue;
      rows.push({ mapId, nodeId: n.nodeId, userId, action: "delete", before: snap(n), after: null });
    }
    await logRevisionsDao(rows);
  });
};

/** GET /api/:mapId/history — every member reads it; hidden branches stay hidden from non-owners. */
export const listMapHistoryAbl = async (publicMapId: string, userId: string) => {
  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) throw new MapNotFoundError();
  const isOwner = String((map as { ownerId: unknown }).ownerId) === String(userId);
  const hidden = isOwner ? new Set<string>() : (await getHiddenNodesDao(map._id as never)).publicIds;
  const rows = await listRevisionsByMapDao(map._id as never);
  return rows.map((r) => r.toJSON()).filter((r: { nodeId: string }) => !hidden.has(r.nodeId));
};

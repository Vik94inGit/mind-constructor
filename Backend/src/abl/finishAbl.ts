// Ending a discussion. Only the map's owner may finish it, and only fairly:
// either the opponent had the last word (the newest node on the map is
// another member's, or the imitated opponent's move), or every other member
// agreed to stop. That way the owner can never end a discussion right after
// their own point, leaving the other side no answer. A map with nobody else
// on it and no imitated opponent can be finished any time; so can an empty
// one. A finished map takes no new nodes, attacks or shields
// (MapFinishedError) until the owner reopens it.
import { z } from "zod";
import { getMapByIdDao, setFinishAgreementDao, setMapFinishedDao } from "../dao/mapsDao.js";
import { findLatestNodeOnMapDao, hasOpponentMovesDao } from "../dao/nodeDao.js";
import { listAttacksByMapDao } from "../dao/attackDao.js";
import { getHiddenNodesDao } from "../dao/visibilityDao.js";
import { parseOrThrow } from "./errors.js";

export class MapNotFoundError extends Error {}
export class NotMapOwnerError extends Error {}
export class OwnerCannotAgreeError extends Error {}
export class FinishNotAllowedError extends Error {
  constructor() {
    super("The opponent should have the last word first, or every other member has to agree to finish.");
  }
}

export type FinishReason = "empty" | "opponentLastWord" | "everyoneAgreed" | "noOpponent";

type MapLike = {
  _id: unknown;
  ownerId: { toString(): string };
  members: { toString(): string }[];
  finishAgreedBy?: { toString(): string }[];
  finishedAt?: Date | null;
};

/** Whether the owner may finish now, and why — the rule at the top of this file. Pure, for testing. */
export const finishRule = (
  map: MapLike,
  latest: { userId: { toString(): string }; byOpponent?: boolean } | null,
  hasOpponentMoves: boolean,
): { allowed: boolean; reason: FinishReason | null; waitingFor: string[] } => {
  const owner = map.ownerId.toString();
  const others = map.members.map(String).filter((id) => id !== owner);
  const agreed = new Set((map.finishAgreedBy ?? []).map(String));
  const waitingFor = others.filter((id) => !agreed.has(id));
  if (!latest) return { allowed: true, reason: "empty", waitingFor };
  if (latest.byOpponent || latest.userId.toString() !== owner) return { allowed: true, reason: "opponentLastWord", waitingFor };
  if (others.length > 0 && waitingFor.length === 0) return { allowed: true, reason: "everyoneAgreed", waitingFor };
  if (others.length === 0 && !hasOpponentMoves) return { allowed: true, reason: "noOpponent", waitingFor };
  return { allowed: false, reason: null, waitingFor };
};

const loadMap = async (publicMapId: string, userId: string) => {
  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) throw new MapNotFoundError();
  return map as unknown as MapLike & { toJSON(): unknown };
};

/** GET /api/:mapId/finish — where the discussion stands, for any member. */
export const getFinishStatusAbl = async (publicMapId: string, userId: string) => {
  const map = await loadMap(publicMapId, userId);
  const rule = finishRule(map, await findLatestNodeOnMapDao(map._id as never), await hasOpponentMovesDao(map._id as never));
  return {
    finishedAt: map.finishedAt ?? null,
    agreedBy: (map.finishAgreedBy ?? []).map(String),
    ...rule,
  };
};

/** POST /api/:mapId/finish — owner only, and only when finishRule allows it. */
export const finishMapAbl = async (publicMapId: string, userId: string) => {
  const map = await loadMap(publicMapId, userId);
  if (map.ownerId.toString() !== userId.toString()) throw new NotMapOwnerError();
  if (map.finishedAt) return map;
  const rule = finishRule(map, await findLatestNodeOnMapDao(map._id as never), await hasOpponentMovesDao(map._id as never));
  if (!rule.allowed) throw new FinishNotAllowedError();
  return await setMapFinishedDao(map._id, new Date());
};

/** POST /api/:mapId/reopen — owner only; forgets the agreements. */
export const reopenMapAbl = async (publicMapId: string, userId: string) => {
  const map = await loadMap(publicMapId, userId);
  if (map.ownerId.toString() !== userId.toString()) throw new NotMapOwnerError();
  return await setMapFinishedDao(map._id, null);
};

const agreeSchema = z.object({ agree: z.boolean({ error: () => "agree must be true or false" }) });

/** POST /api/:mapId/finish/agree — any member but the owner says they're ready to stop (or takes it back). */
export const agreeToFinishAbl = async (publicMapId: string, userId: string, input: unknown) => {
  const { agree } = parseOrThrow(agreeSchema, input);
  const map = await loadMap(publicMapId, userId);
  if (map.ownerId.toString() === userId.toString()) throw new OwnerCannotAgreeError();
  return await setFinishAgreementDao(map._id, userId, agree);
};

/** GET /api/:mapId/attacks — every attack on the map, oldest first, for the replay. */
export const listMapAttacksAbl = async (publicMapId: string, userId: string) => {
  const map = await loadMap(publicMapId, userId);
  const isOwner = map.ownerId.toString() === userId.toString();
  const hidden = isOwner ? new Set<string>() : (await getHiddenNodesDao(map._id as never)).ids;
  const rows = await listAttacksByMapDao(map._id as never);
  return rows
    .filter((r) => !hidden.has(r.targetNodeId!._id.toString()))
    .map((r) => ({
      targetNodeId: r.targetNodeId!.nodeId,
      weapon: r.weapon,
      damage: r.damage,
      blocked: !!r.blocked,
      byOpponent: !!r.byOpponent,
      createdAt: r.createdAt,
    }));
};

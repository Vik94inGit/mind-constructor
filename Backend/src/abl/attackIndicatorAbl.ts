// Computes "this node is under heavy fire" indicators from incoming
// negative edges. Deliberately named/exported separately from abl/attackAbl.ts
// — that module is the *combat* system (explicit weapon actions, health,
// cooldowns). This one is a read-only signal derived from the edge graph;
// the two happen to share vocabulary ("attack", "weapon") but are unrelated
// systems that shouldn't import from each other.
import { z } from "zod";
import { getMapByIdDao } from "../dao/mapsDao.js";
import { listNodesByMapInternalIdDao } from "../dao/nodeDao.js";
import { countIncomingEdgesByTargetDao } from "../dao/edgeDao.js";
import { type WeaponIcon } from "../models/Node.js";
import { parseOrThrow } from "./errors.js";

export const DEFAULT_ATTACK_INDICATOR_THRESHOLD = 3;

const optionsSchema = z.object({
  threshold: z.coerce.number().int().min(1).default(DEFAULT_ATTACK_INDICATOR_THRESHOLD),
});

// Severity-based, not random — random would make the indicator flicker
// between icons on every recompute for the exact same graph, which is
// worse UX than it sounds. Tiers scale off the configured threshold rather
// than fixed counts, so a custom threshold still produces a sensible range.
export const pickWeaponIcon = (incomingCount: number, threshold: number): WeaponIcon => {
  if (incomingCount >= threshold + 4) return "spear";
  if (incomingCount >= threshold + 2) return "axe";
  return "sword";
};

// Because this is recomputed fresh from current data on every call rather
// than a persisted "spawned" record, "one indicator per node" and "it
// disappears once the count drops" aren't things this code has to
// separately guarantee — they're consequences of not having state to get
// out of sync in the first place. There's nothing to de-duplicate and
// nothing to despawn.
export const computeAttackIndicatorsAbl = async (
  publicMapId: string,
  userId: string,
  rawOptions: unknown,
) => {
  const { threshold } = parseOrThrow(optionsSchema, rawOptions ?? {});

  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null;

  const [nodes, counts] = await Promise.all([
    listNodesByMapInternalIdDao(map._id),
    countIncomingEdgesByTargetDao(map._id, "negative"),
  ]);

  const publicIdOf = new Map(nodes.map((n) => [n._id.toString(), n.nodeId]));

  const indicators = counts
    .filter((row) => row.count >= threshold)
    .map((row) => {
      const nodeId = publicIdOf.get(row._id.toString());
      if (!nodeId) return null;
      return {
        nodeId,
        incomingNegativeEdges: row.count,
        weapon: pickWeaponIcon(row.count, threshold),
      };
    })
    .filter((indicator): indicator is NonNullable<typeof indicator> => indicator !== null);

  return { threshold, indicators };
};

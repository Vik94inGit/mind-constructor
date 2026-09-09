// Node packing: folding one or more nodes into a chosen "container" node so
// they stop rendering on the canvas (a frontend hides anything with
// packedIntoNodeId set), reversible per-member via unpack. A genuinely new
// relationship — deliberately not reusing parentId/the circle mechanism
// (circleAbl.ts): a circle keeps every member fully visible with a
// backdrop, packing hides them; a circle's eligibility is pure branch
// lineage, packing's is broader (branch lineage *or* an explicit Link).
// Split into its own module rather than folded into nodeAbl.ts for the same
// reason circleAbl.ts already is: packing has its own eligibility rule and
// its own error classes, not a plain CRUD field.
import { z } from "zod";
import mongoose from "mongoose";
import {
  findNodeByPublicIdDao,
  listNodesByMapInternalIdDao,
  countPackedMembersDao,
  packNodesMutationDao,
  unpackNodeMutationDao,
  bumpSizeTierIfDefaultDao,
} from "../dao/nodeDao.js";
import { findEdgesByNodeInternalIdDao } from "../dao/edgeDao.js";
import { parseOrThrow } from "./errors.js";

export class PackContainerNotFoundError extends Error {}
export class PackNotOwnedError extends Error {}
export class PackMemberNotFoundError extends Error {}
export class PackMemberNotEligibleError extends Error {}

const packNodesSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1, "Pick at least one node to pack"),
});

// The eligible pool for a given anchor: its direct branch children, its own
// branch parent, and every node on either end of an Edge touching it — the
// union the user confirmed ("edge, branch, and the user manually chooses
// among those"). Recomputed fresh from current parentId/Edge state every
// time, same "don't trust a stale snapshot" reasoning
// computeNodeCirclesAbl/selectCircleAbl already apply to circle membership.
// Returns internal-id strings (not public nodeIds) since both callers below
// only ever need to test membership against ids they already have as
// ObjectIds.
async function computeEligiblePackCandidateIdsAbl(
  anchor: { _id: mongoose.Types.ObjectId; mapId: mongoose.Types.ObjectId; parentId?: mongoose.Types.ObjectId | null },
): Promise<Set<string>> {
  const eligible = new Set<string>();

  if (anchor.parentId) eligible.add(anchor.parentId.toString());

  const mapNodes = await listNodesByMapInternalIdDao(anchor.mapId);
  for (const n of mapNodes) {
    if (n.parentId && n.parentId.toString() === anchor._id.toString()) {
      eligible.add(n._id.toString());
    }
  }

  const edges = await findEdgesByNodeInternalIdDao(anchor._id);
  for (const e of edges) {
    const otherId =
      e.fromNodeId.toString() === anchor._id.toString() ? e.toNodeId : e.fromNodeId;
    eligible.add(otherId.toString());
  }

  eligible.delete(anchor._id.toString()); // an anchor can't pack itself
  return eligible;
}

// Packs memberPublicIds into publicContainerId — container-owner-only (per
// the user's own confirmed decision: packing has a map-wide, no-cost,
// no-cooldown effect on what everyone else sees, so it's gated like editing
// a node's own text/parentId, not left open like combat). Re-derives
// eligibility server-side rather than trusting the client's picks, same
// principle selectCircleAbl already applies to a stale circle nodeIds list.
export const packNodesAbl = async (
  publicContainerId: string,
  userId: string,
  rawInput: unknown,
) => {
  const { nodeIds: memberPublicIds } = parseOrThrow(packNodesSchema, rawInput);

  const container = await findNodeByPublicIdDao(publicContainerId);
  if (!container) throw new PackContainerNotFoundError();
  if (container.userId.toString() !== userId.toString()) throw new PackNotOwnedError();

  const eligibleIds = await computeEligiblePackCandidateIdsAbl(container);

  const members = [];
  for (const publicMemberId of memberPublicIds) {
    const member = await findNodeByPublicIdDao(publicMemberId);
    if (!member) throw new PackMemberNotFoundError();
    if (member.mapId.toString() !== container.mapId.toString()) throw new PackMemberNotFoundError();
    if (!eligibleIds.has(member._id.toString())) throw new PackMemberNotEligibleError();
    members.push(member);
  }

  // Read before mutating — packAbl (not nodeAbl) owns this pack-triggered
  // size side effect, same reasoning attackAbl.ts owns its own
  // retaliation-heal side effect rather than pushing it out to a generic
  // caller. Only the container's *first-ever* pack bumps its size, and only
  // while its sizeTier has never been touched (bumpSizeTierIfDefaultDao's
  // own `sizeTier: null` guard makes this atomic against a concurrent
  // manual PATCH).
  const wasFirstPack = (await countPackedMembersDao(container._id)) === 0;

  // Bumped *before* packNodesMutationDao's own fetch-back-and-populate, so
  // the container it returns already reflects the new sizeTier instead of
  // a stale pre-bump snapshot the caller would have to separately refetch.
  if (wasFirstPack) {
    await bumpSizeTierIfDefaultDao(container._id, 2);
  }

  const memberInternalIds = members.map((m) => m._id);
  return await packNodesMutationDao(container._id, memberInternalIds);
};

// Unpacks one member — owner-of-the-member scoped (not container-owner),
// same convention every other single-node PATCH-shaped edit in this app
// already follows.
export const unpackNodeAbl = async (publicMemberId: string, userId: string) => {
  const node = await unpackNodeMutationDao(publicMemberId, userId);
  return node; // null => not found / not owned by this caller
};

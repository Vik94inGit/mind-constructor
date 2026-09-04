import { z } from "zod";
import { EDGE_SENTIMENTS } from "../models/Edge.js";
import { getMapByIdDao } from "../dao/mapsDao.js";
import { findNodeByPublicIdDao } from "../dao/nodeDao.js";
import { createEdgeMutationDao } from "../dao/edgeDao.js";
import { parseOrThrow } from "./errors.js";

export class MapNotFoundError extends Error {}
export class NodeNotFoundError extends Error {}
export class SelfLoopError extends Error {}
export class CrossMapEdgeError extends Error {}
export class NodeNotOwnedError extends Error {}

const createEdgeSchema = z.object({
  fromNodeId: z.string().min(1, "fromNodeId is required"),
  toNodeId: z.string().min(1, "toNodeId is required"),
  sentiment: z.enum(EDGE_SENTIMENTS).optional(),
});

// A directed edge between two nodes on the same map. Both node ids are
// public (nodeId, not _id) — this resolves them and checks that both
// actually belong to the map the caller says they're connecting on, since
// nothing about the raw ids alone guarantees that.
export const createEdgeAbl = async (
  input: unknown,
  publicMapId: string,
  userId: string,
) => {
  const { fromNodeId, toNodeId, sentiment } = parseOrThrow(createEdgeSchema, input);

  if (fromNodeId === toNodeId) {
    throw new SelfLoopError();
  }

  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) throw new MapNotFoundError();

  const [fromNode, toNode] = await Promise.all([
    findNodeByPublicIdDao(fromNodeId),
    findNodeByPublicIdDao(toNodeId),
  ]);

  if (!fromNode || !toNode) throw new NodeNotFoundError();

  if (
    fromNode.mapId.toString() !== map._id.toString() ||
    toNode.mapId.toString() !== map._id.toString()
  ) {
    throw new CrossMapEdgeError();
  }

  // Both ends of a link must be nodes the caller created — otherwise any
  // map member could wire up two nodes neither of which are theirs.
  if (
    fromNode.userId.toString() !== userId.toString() ||
    toNode.userId.toString() !== userId.toString()
  ) {
    throw new NodeNotOwnedError();
  }

  return await createEdgeMutationDao({
    mapId: map._id,
    fromNodeId: fromNode._id,
    toNodeId: toNode._id,
    sentiment,
    userId,
  });
};

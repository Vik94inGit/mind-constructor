import { z } from "zod";
import { getMapByIdDao, setSelectedCircleDao } from "../dao/mapsDao.js";
import { listNodesByMapInternalIdDao, setLockedNodesDao } from "../dao/nodeDao.js";
import { parseOrThrow } from "./errors.js";

export class CircleNotFoundError extends Error {}

// A "circle": a node with 2+ direct parentId-children — the parentId "star"
// a frontend draws as a halo/horns backdrop around a node and its branch
// children. Deliberately *not* the old same-sentiment k-core cluster this
// replaced: this app's maps are normally trees radiating from a Problem/
// Option node, and a tree's k-core for any minDegree >= 2 is always empty
// (a forest has no cycles), so that approach could never fire on a normal
// map. parentId membership is unambiguous and already exists on every node,
// so no threshold/degree concept is needed here at all.
export const computeNodeCirclesAbl = async (publicMapId: string, userId: string) => {
  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null;

  const nodes = await listNodesByMapInternalIdDao(map._id);
  const publicIdOf = new Map(nodes.map((n) => [n._id.toString(), n.nodeId]));

  const childrenByParent = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const key = n.parentId.toString();
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(n.nodeId);
  }

  const circles = [...childrenByParent.entries()]
    .filter(([, childIds]) => childIds.length >= 2)
    .map(([parentInternalId, childIds]) => {
      const rootId = publicIdOf.get(parentInternalId);
      if (!rootId) return null; // shouldn't happen — parentId always refers to a node in the same map
      return { rootId, nodeIds: [rootId, ...childIds] };
    })
    .filter((c): c is { rootId: string; nodeIds: string[] } => c !== null);

  return { circles };
};

const selectCircleSchema = z.object({
  rootId: z.string().min(1, "rootId is required"),
});

// "Choosing" a circle: locks every member node (a hint to a frontend's
// layout/physics loop to stop repositioning them) and remembers the choice
// on the Map, snapshotting which nodes were in it — circles themselves
// still aren't persisted, this only remembers *which one got picked*.
// Recomputes via computeNodeCirclesAbl rather than trusting the caller's own
// membership list, so a stale/tampered nodeIds array can never get locked.
export const selectCircleAbl = async (
  publicMapId: string,
  userId: string,
  rawInput: unknown,
) => {
  const { rootId } = parseOrThrow(selectCircleSchema, rawInput);

  const computed = await computeNodeCirclesAbl(publicMapId, userId);
  if (!computed) return null; // map not found, or not a member

  const circle = computed.circles.find((c) => c.rootId === rootId);
  if (!circle) throw new CircleNotFoundError();

  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null; // vanishingly unlikely between the two calls, but stay consistent

  await setLockedNodesDao(map._id, circle.nodeIds);

  // Built as a plain object, not read back off the Mongoose doc — a
  // controller broadcasting this over the socket shouldn't have to guess
  // whether a subdocument serializes the way toJSON says it should.
  const selectedCircle = { rootId: circle.rootId, nodeIds: circle.nodeIds };
  const updatedMap = await setSelectedCircleDao(map._id, selectedCircle);

  return { map: updatedMap, circle, selectedCircle };
};

// Clears the selection and unlocks every node on the map.
export const deselectCircleAbl = async (publicMapId: string, userId: string) => {
  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null;

  await setLockedNodesDao(map._id, []);
  const updatedMap = await setSelectedCircleDao(map._id, null);

  return { map: updatedMap };
};

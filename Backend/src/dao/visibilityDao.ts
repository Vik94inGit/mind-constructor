// Which nodes of a map are hidden from its invited members. The map's owner
// can hide a whole branch (Node.hiddenFromMembers on its root): the node
// itself, everything hanging from it by parentId (weapon nodes included,
// since they are parented to their target), and any protection node guarding
// one of those. The owner always sees everything.
import type mongoose from "mongoose";
import { Node } from "../models/Node.js";
import { Map } from "../models/Map.js";

export interface HiddenNodes {
  /** Internal Mongo ids (as strings). */
  ids: Set<string>;
  /** The same nodes' public ids. */
  publicIds: Set<string>;
}

const NONE = (): HiddenNodes => ({ ids: new Set(), publicIds: new Set() });

export const getHiddenNodesDao = async (mapInternalId: mongoose.Types.ObjectId): Promise<HiddenNodes> => {
  // Most maps have no hidden branch at all — one cheap existence check
  // before reading every node of the map.
  if (!(await Node.exists({ mapId: mapInternalId, hiddenFromMembers: true }))) return NONE();

  const rows = await Node.find({ mapId: mapInternalId })
    .select("_id nodeId parentId hiddenFromMembers protectsNodeId")
    .lean<
      {
        _id: { toString(): string };
        nodeId: string;
        parentId?: { toString(): string } | null;
        hiddenFromMembers?: boolean;
        protectsNodeId?: { toString(): string } | null;
      }[]
    >();
  const byId = new globalThis.Map(rows.map((r) => [r._id.toString(), r]));
  const memo = new globalThis.Map<string, boolean>();

  const isHidden = (id: string, visiting: Set<string>): boolean => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const row = byId.get(id);
    if (!row || visiting.has(id)) return false;
    visiting.add(id);
    let hidden = !!row.hiddenFromMembers;
    if (!hidden && row.parentId) hidden = isHidden(row.parentId.toString(), visiting);
    if (!hidden && row.protectsNodeId) hidden = isHidden(row.protectsNodeId.toString(), visiting);
    memo.set(id, hidden);
    return hidden;
  };

  const out = NONE();
  for (const row of rows) {
    const id = row._id.toString();
    if (isHidden(id, new Set())) {
      out.ids.add(id);
      out.publicIds.add(row.nodeId);
    }
  }
  return out;
};

// For a live broadcast: is any of these public node ids hidden on this map?
export const anyPublicNodeHiddenDao = async (publicMapId: string, publicNodeIds: Set<string>): Promise<boolean> => {
  if (publicNodeIds.size === 0) return false;
  const map = await Map.findOne({ mapId: publicMapId }).select("_id");
  if (!map) return false;
  const hidden = await getHiddenNodesDao(map._id);
  for (const id of publicNodeIds) if (hidden.publicIds.has(id)) return true;
  return false;
};

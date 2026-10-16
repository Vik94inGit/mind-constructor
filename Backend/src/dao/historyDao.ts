import type mongoose from "mongoose";
import { NodeRevision } from "../models/NodeRevision.js";

type Snapshot = { text: string; title: string; type: string };

export interface RevisionInput {
  mapId: unknown;
  nodeId: string;
  userId: unknown;
  action: "edit" | "delete";
  before: Snapshot;
  after: Snapshot | null;
}

// Append-only: nothing in this file updates or deletes a revision.
export const logRevisionsDao = async (rows: RevisionInput[]) => {
  if (rows.length === 0) return;
  await NodeRevision.insertMany(rows);
};

/** A map's changes, newest first (at most `limit`), each with who made it. */
export const listRevisionsByMapDao = async (mapInternalId: mongoose.Types.ObjectId, limit = 500) => {
  return await NodeRevision.find({ mapId: mapInternalId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate("userId", "username");
};

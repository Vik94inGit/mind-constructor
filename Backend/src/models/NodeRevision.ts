import mongoose from "mongoose";

// One change to a node in a discussion (Map.discussionMode !== false): an edit
// of its text, title or type, or its deletion. Written by abl/historyAbl.ts
// and never edited or removed on its own — every member sees every change,
// so nobody can quietly rewrite what they said. Only deleting the whole map
// takes its history along (deleteMapDao).
export const REVISION_ACTIONS = ["edit", "delete"] as const;

// What the node said: its text, title and type. `$type` is this schema's type
// key, so the node's own `type` field can keep its name.
const snapshot = new mongoose.Schema(
  {
    text: { $type: String, default: "" },
    title: { $type: String, default: "" },
    type: { $type: String, default: "" },
  },
  { _id: false, typeKey: "$type" },
);

const NodeRevisionSchema = new mongoose.Schema(
  {
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true, index: true },
    // The node's public id — kept as a plain string so the entry outlives the node.
    nodeId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: REVISION_ACTIONS, required: true },
    before: { type: snapshot, required: true },
    // null for a deletion.
    after: { type: snapshot, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.__v;
        delete ret.mapId;
        ret.revisionId = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

export const NodeRevision = mongoose.model("NodeRevision", NodeRevisionSchema);

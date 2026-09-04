import mongoose from "mongoose";

// "neutral" is the default for any edge that doesn't specify a sentiment —
// it's excluded from both the auto-clustering and attack-indicator logic,
// which only care about "positive" and "negative".
export const EDGE_SENTIMENTS = ["positive", "negative", "neutral"] as const;
export type EdgeSentiment = (typeof EDGE_SENTIMENTS)[number];

const EdgeSchema = new mongoose.Schema(
  {
    edgeId: { type: String, required: true, unique: true }, // public id, nanoid — same pattern as Map/Node
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true },
    fromNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", required: true },
    toNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", required: true },
    sentiment: { type: String, enum: EDGE_SENTIMENTS, default: "neutral" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // creator
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Edge = mongoose.model("Edge", EdgeSchema);

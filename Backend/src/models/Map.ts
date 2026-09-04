import mongoose from "mongoose";

export const MapSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mapId: { type: String, required: true, unique: true }, // Unique identifier for the map
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Array of user IDs who are members of the map
    pendingInvites: [
      {
        email: String,
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          createdAt: { type: Date, default: Date.now },
        },
        filter: {
          type: String,
          enum: ["all", "owner", "member"],
          default: "all",
        },
      },
    ], // Array of email addresses for pending invites
    color: String, // the map/board's own color, not any one member's
    memberColors: [
      {
        _id: false,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        color: { type: String, required: true }, // that member's personal color on this map
      },
    ],

    // The one node-circle (a parentId "star": a node + its 2+ direct
    // children) currently "chosen" on this map, if any. Circles themselves
    // are never persisted (computed fresh from Node.parentId every time) —
    // this just remembers *which* one was picked, snapshotting its
    // membership at selection time, so the choice survives a reload and
    // syncs to other collaborators. See abl/circleAbl.ts.
    selectedCircle: {
      type: {
        _id: false,
        rootId: { type: String, required: true }, // the circle's root node's public nodeId
        nodeIds: [String], // public nodeIds (root + children), snapshotted at selection time
      },
      default: null,
    },

    // Flips combat's own-node rule: normally you can only attack someone
    // else's node (see attackAbl's CannotAttackOwnNodeError); in discussion
    // mode that's inverted — you can only challenge your *own* claims, not
    // anyone else's. Toggleable any time (PATCH /api/:mapId), not fixed at
    // creation. See abl/attackAbl.ts.
    discussionMode: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: {
      transform(_doc, ret: any) {
        // mapId is the public identifier — Mongo's own _id and version key
        // are internal implementation details, not part of the API contract.
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Map = mongoose.model("Map", MapSchema);

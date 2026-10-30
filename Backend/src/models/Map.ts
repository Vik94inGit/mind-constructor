import mongoose from "mongoose";
import { ZONE_PALETTE } from "./palette.js";

// What a map is for — picked when it is created, and the frontend seeds a
// matching starter structure. Purely descriptive: nothing here is enforced.
export const MAP_KINDS = ["problem", "decision", "goal", "retro", "idea"] as const;

// The canvas behind a map's nodes, picked by the map's owner and seen by every
// member. null (every map that never picked one) draws the dot grid.
export const MAP_BACKGROUNDS = ["dots", "plain", "lined", "dark"] as const;

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

    // No longer gates any combat rule server-side (see attackAbl.ts's own
    // doc comment — combat is fully open regardless of this field). Now a
    // plain per-map UI setting instead: true (the default — every map
    // starts here) is "Discussion" mode, showing every combat control on
    // the frontend; explicit false is "Personal" mode, hiding them for
    // solo organizing. Toggleable any time by the map's owner
    // (PATCH /api/:mapId). Defaulting true, not false, matters here: it's
    // what keeps every newly-created map's combat controls visible by
    // default, matching the app's behavior from before this toggle existed
    // at all.
    discussionMode: { type: Boolean, default: true },
    // See MAP_KINDS. null for a map created without one (older maps, demo).
    kind: { type: String, enum: MAP_KINDS, default: null },
    // See MAP_BACKGROUNDS.
    background: { type: String, enum: MAP_BACKGROUNDS, default: null },
    // A soft tint laid over the background, from the same calm palette zones
    // use (Node.ZONE_PALETTE); the frontend mixes it with the paper colour so
    // it stays muted. null (the default) keeps the plain paper.
    backgroundColor: { type: String, enum: ZONE_PALETTE, default: null },
    // A picture the owner uploaded as the map's wallpaper — a stored
    // picture's address (models/Image.ts, with no node). The frontend draws
    // it under a veil of the paper colour so the nodes stay readable. ""
    // (the default) means none.
    backgroundImage: { type: String, default: "" },
    // How much darker (below 0) or lighter (above 0) the picture is drawn,
    // -100..100 — the frontend lays black or white over it by that much. 0
    // (the default) leaves it as it is.
    backgroundShade: { type: Number, min: -100, max: 100, default: 0 },
    // When the discussion on this map was finished (see abl/finishAbl.ts) —
    // null while it's still going. A finished map takes no new nodes,
    // attacks or shields until its owner reopens it.
    finishedAt: { type: Date, default: null },
    // Members (not the owner) who agreed to end the discussion. Ending it
    // needs either the opponent's last word or every other member's
    // agreement, so the owner can't cut anyone off; cleared on reopen.
    finishAgreedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
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

// members: queried via $or/members filter in getMapsDao, getMapByIdDao,
// getNodesByMapDao, getNodesTextDao, getMapSummaryDao, removeUserFromMapsDao.
MapSchema.index({ members: 1 });
// ownerId: queried in getMapsDao (filterType "owned"), deleteMapDao,
// listMapsByOwnerDao, inviteUserToMapDao, updateMapDao.
MapSchema.index({ ownerId: 1 });

export const Map = mongoose.model("Map", MapSchema);

import mongoose from "mongoose";

// Where a user left off, kept on the server so it follows them from device
// to device: their own display preferences, the map they last had open,
// how each map looks to them, and unfinished drafts. Never shared with
// anyone else — every document here belongs to one user.

export const THEMES = ["light", "dark"] as const;
export const LANGUAGES = ["en", "cs", "uk", "ru"] as const;
export const READING_MODES = ["puzzle", "mixed", "iconText", "actual"] as const;
export const ZONE_MODES = [...READING_MODES, "dots"] as const;
export const DRAFT_KINDS = ["think", "textSplit"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

// One per user: preferences that apply everywhere, and the last map opened.
const UserStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    preferences: {
      _id: false,
      theme: { type: String, enum: THEMES },
      language: { type: String, enum: LANGUAGES },
      readingMode: { type: String, enum: READING_MODES },
      compactView: { type: Boolean },
    },
    lastMapId: { type: String, default: null }, // public mapId
  },
  { timestamps: true },
);
export const UserState = mongoose.model("UserState", UserStateSchema);

// One per user per map: how that map looks to them, and where they were on it.
const MapViewStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mapId: { type: String, required: true }, // public mapId
    nodeDisplay: { type: mongoose.Schema.Types.Mixed, default: {} }, // nodeId -> reading mode
    zoneDisplay: { type: mongoose.Schema.Types.Mixed, default: {} }, // zone root nodeId -> zone mode
    cardFills: { type: mongoose.Schema.Types.Mixed, default: {} }, // nodeId -> #rrggbb
    blockLocks: { type: [String], default: [] }, // locked puzzle pieces' nodeIds
    center: { type: { _id: false, x: Number, y: Number }, default: null }, // canvas point in the middle of the screen
    selectedNodeId: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        delete ret.userId;
        return ret;
      },
    },
  },
);
// Every lookup is one user's view of one map; deleteMapDao drops a map's views.
MapViewStateSchema.index({ userId: 1, mapId: 1 }, { unique: true });
MapViewStateSchema.index({ mapId: 1 });
export const MapViewState = mongoose.model("MapViewState", MapViewStateSchema);

// One per user per kind: an unfinished "Think it through" or "Text → map".
const DraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: DRAFT_KINDS, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    // When the device that saved it last changed it (ms) — lets a device
    // holding its own copy tell which one is newer.
    clientUpdatedAt: { type: Number, required: true },
  },
  { timestamps: true },
);
DraftSchema.index({ userId: 1, kind: 1 }, { unique: true });
export const Draft = mongoose.model("Draft", DraftSchema);

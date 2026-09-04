import mongoose from "mongoose";

export const NODE_TYPES = [
  "Problem",
  "Problematic option",
  "Solution",
  "Option",
  "Success",
  "Fail",
  "unknown",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

// Shared by both the combat system (attackAbl.ts) and the passive
// attack-indicator computation (attackIndicatorAbl.ts) — lives here, on the
// model, rather than in either of those, specifically so neither has to
// import from the other just to agree on what a weapon icon is called.
export const WEAPON_ICONS = ["sword", "axe", "spear"] as const;
export type WeaponIcon = (typeof WEAPON_ICONS)[number];

// Manually forces an outcome-type node's OutcomeBadge inner symbol (see
// frontend OutcomeBadge.tsx) to a check or a cross, regardless of what its
// `type` would normally draw (e.g. a still-open Problem you already know
// is settled, marked with a check ahead of actually resolving it). Doesn't
// touch `type` itself, doesn't apply to "unknown" nodes (they have no
// OutcomeBadge/inner symbol to override), and null means "use the type's
// own default symbol" — the common case.
export const SYMBOL_OVERRIDES = ["check", "cross"] as const;
export type SymbolOverride = (typeof SYMBOL_OVERRIDES)[number];

export const NodeSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, unique: true }, // public id, safe to expose in URLs/JSON
    text: { type: String, required: true },
    type: { type: String, enum: NODE_TYPES, required: true }, // mandatory: forces the author to categorize every node
    x: Number, // Coordinates for the UI
    y: Number,
    color: String,
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Node",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isFirstNode: { type: Boolean, default: false },
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true }, // Map's internal _id, not the public nanoid mapId
    health: { type: Number, default: 100 }, // combat: depleted by attacks from other members
    defeated: { type: Boolean, default: false }, // true once health hits 0 — stays visible, can't be attacked further

    // Weapon nodes: auto-spawned by an attack, one per attack landed. Real
    // Node documents on purpose — they show up in normal listings and
    // counts like any other node; isWeapon is just how a frontend (or you)
    // tells them apart from user-authored ones.
    isWeapon: { type: Boolean, default: false },
    weaponIcon: { type: String, enum: WEAPON_ICONS }, // only set when isWeapon is true
    targetNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", default: null }, // which node this weapon points at

    // Set only via a map's circle-selection endpoints (abl/circleAbl.ts),
    // never directly through PATCH /api/nodes/:nodeId — it's derived from
    // "is this node in the currently-selected circle," not something a
    // user hand-edits. A frontend's layout/physics loop is expected to
    // treat this as "don't reposition me."
    locked: { type: Boolean, default: false },

    // Manual override of the OutcomeBadge inner symbol — see
    // SYMBOL_OVERRIDES above. Unlike `locked`, this one IS settable through
    // PATCH /api/nodes/:nodeId (by the node's owner, same as text/type).
    symbolOverride: { type: String, enum: SYMBOL_OVERRIDES, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        // nodeId is the public identifier — Mongo's own _id and version key
        // are internal implementation details, not part of the API contract.
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Node = mongoose.model("Node", NodeSchema);

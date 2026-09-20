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

// Three discrete visual scales (100%/115%/130%, applied client-side — this
// model just stores which one). `null` is a distinct state from `1`: it
// means "never touched, by anyone or anything" — packAbl.ts's auto-bump
// (a container gets bumped to 2 the first time something is ever packed
// into it) only ever fires while this is still null, and never fires again
// once it's been set to *any* tier, manually or automatically. Resetting a
// node's size via NodePanel explicitly writes `1`, not `null` — back to
// "untouched" would silently re-arm the auto-bump on the next pack, which
// isn't what "reset to 100%" should mean.
export const SIZE_TIERS = [1, 2, 3] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

// A manually-placed zone ring around exactly this one node — independent of
// (and drawn alongside, if both happen to apply) the automatic circle
// detection in circleAbl.ts, which only ever fires for a node with 2+
// direct parentId-children and picks its own color by majority vote. This
// is the opposite: any single node, color chosen outright rather than
// computed. null means no manual zone.
export const MANUAL_ZONE_COLORS = ["positive", "negative"] as const;
export type ManualZoneColor = (typeof MANUAL_ZONE_COLORS)[number];

export const NodeSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, unique: true }, // public id, safe to expose in URLs/JSON
    text: { type: String, required: true },
    // An optional short label shown on the canvas in place of the text's
    // first words. Empty (the default) means "no title" — the frontend then
    // falls back to the start of `text`. Unlike `text`, this rides along on
    // the initial node list (see getNodesByMapDao's own `-text` projection):
    // it's capped small enough that a whole map's titles are a rounding
    // error next to what stripping `text` saved.
    title: { type: String, default: "", trim: true, maxlength: 80 },
    // An optional step number (1, 2, 3, …) for describing a process by
    // labeling nodes in sequence — a frontend draws it as a small badge on the
    // node. Purely a label: nothing orders, links or validates against other
    // nodes' numbers, so two nodes can share one (parallel steps). null (the
    // default) means "not numbered". Rides along on the initial node list like
    // `title` — a bare integer is nothing next to the text it sits beside.
    order: {
      type: Number,
      default: null,
      min: 1,
      max: 9999,
      validate: { validator: (v: number | null) => v === null || Number.isInteger(v), message: "order must be a whole number" },
    },
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

    // Protection nodes: created via POST /:nodeId/protect (abl/attackAbl.ts),
    // same "real Node, tagged so a frontend can tell it apart" shape as a
    // weapon node. While any protection node with isProtection:true and
    // defeated:false points at a given node (protectsNodeId), every attack
    // on that node does 0 damage — see attackNodeAbl's own `blocked` check.
    isProtection: { type: Boolean, default: false },
    protectsNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", default: null }, // which node this shield defends

    // A shield doesn't erase the damage it blocks, it defers it: every hit
    // attackNodeAbl blocks for this protector adds that weapon's damage
    // here instead of applying it to protectsNodeId. Deleting this node
    // releases the whole running total onto protectsNodeId at once (see
    // deleteNodeDao) — "the protected node has its own damage back," per
    // the feature's own ask. Only ever meaningful while isProtection is
    // true; a plain node has no use for it.
    blockedDamage: { type: Number, default: 0 },

    // Packing: folds this node off the canvas, nested inside another node
    // (abl/packAbl.ts). Set only via POST /:nodeId/pack (on the *container*,
    // for one or more member ids at once) and cleared via POST
    // /:memberId/unpack — not a plain PATCH field like symbolOverride, since
    // packing has its own eligibility rule (the member must already be
    // Edge-linked or branch-linked to the container) that a bare PATCH
    // can't enforce. null means "not packed into anything."
    packedIntoNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", default: null },

    // See SIZE_TIERS above for the null-vs-1 contract.
    sizeTier: { type: Number, enum: SIZE_TIERS, default: null },

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

    // See MANUAL_ZONE_COLORS above — also settable through plain
    // PATCH /api/nodes/:nodeId, same owner-only gating as symbolOverride.
    manualZone: { type: String, enum: MANUAL_ZONE_COLORS, default: null },
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

// mapId: every map-load query (getNodesByMapDao, listNodesByMapInternalIdDao,
// countNodesByMapInternalIdDao, ...) filters on this.
NodeSchema.index({ mapId: 1 });
// parentId: circleAbl.ts's circle detection and the cascadeAfterNodeDeleted
// parentId-clearing update both filter on this unscoped by anything else.
NodeSchema.index({ parentId: 1 });
// targetNodeId: cascadeAfterNodeDeleted's weapon-node cleanup filters on this
// (combined with isWeapon) unscoped by anything else.
NodeSchema.index({ targetNodeId: 1 });
// Compound, matching findActiveProtectorDao's exact filter shape (checked on
// every attack).
NodeSchema.index({ protectsNodeId: 1, isProtection: 1, defeated: 1 });

export const Node = mongoose.model("Node", NodeSchema);

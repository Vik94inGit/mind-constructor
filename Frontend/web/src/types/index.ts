// Mirrors src/models/*.ts on the backend. Keep in sync with docs/api-guide.html.

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

export const WEAPON_ICONS = ["sword", "axe", "spear"] as const;
export type WeaponIcon = (typeof WEAPON_ICONS)[number];

// Manually forces an outcome-type node's OutcomeBadge inner symbol to a
// check or a cross, regardless of what its `type` would normally draw —
// see Node.symbolOverride on the backend. null/absent means "use the
// type's own default symbol." Doesn't apply to "unknown" nodes — they have
// no OutcomeBadge/inner symbol to override.
export const SYMBOL_OVERRIDES = ["check", "cross"] as const;
export type SymbolOverride = (typeof SYMBOL_OVERRIDES)[number];

export const WEAPONS = ["nitpick", "counterpoint", "fatalFlaw"] as const;
export type Weapon = (typeof WEAPONS)[number];

export const WEAPON_INFO: Record<Weapon, { label: string; damage: number; cooldownMs: number }> = {
  nitpick: { label: "Nitpick", damage: 10, cooldownMs: 0 },
  counterpoint: { label: "Counterpoint", damage: 25, cooldownMs: 5 * 60 * 1000 },
  fatalFlaw: { label: "Fatal flaw", damage: 50, cooldownMs: 30 * 60 * 1000 },
};

// An attack always creates a real content node alongside the damage now —
// every outcome type except "unknown" (mirrors attackAbl.ts's
// ATTACK_NODE_TYPES on the backend, which is the one that actually gets
// enforced) — retaliation in particular is naturally a positive claim
// ("my defense holds"), not just the negative-framed objection types.
export const ATTACK_NODE_TYPES = [
  "Problem",
  "Problematic option",
  "Solution",
  "Option",
  "Success",
  "Fail",
] as const;
export type AttackNodeType = (typeof ATTACK_NODE_TYPES)[number];

export interface User {
  _id: string;
  username: string;
  email: string;
  role?: "user" | "admin";
  isBlocked?: boolean;
}

export interface MemberColor {
  userId: string;
  color: string;
}

// A circle's own choice of stability, remembered on the Map (not the circle
// itself — circles aren't persisted, they're recomputed fresh from every
// node's parentId whenever needed). Membership is snapshotted at selection
// time. A "circle" is a node with 2+ direct parentId-children — see
// MapPage's nodeGroups for the same grouping, computed client-side.
export interface SelectedCircle {
  rootId: string;
  nodeIds: string[];
}

// Mirrors the MAP_TEMPLATES keys in backend/src/abl/mapAbl.ts — a starting
// node structure createMap can seed instead of an empty canvas. Not stored
// on the map itself (the backend only ever reads it once, at creation), so
// it isn't a field on MapDoc below.
export type MapTemplate = "blank" | "single-problem" | "decision-tree" | "pro-con";

export interface MapDoc {
  mapId: string;
  name: string;
  ownerId: string;
  members: string[] | { _id: string; username: string }[];
  memberColors: MemberColor[];
  color?: string;
  selectedCircle?: SelectedCircle | null;
  // Inverts combat's own-node rule map-wide: normally you can only attack
  // someone else's node; in discussion mode you can only attack your own
  // (self-critique instead of combat) — see attackAbl.ts server-side.
  // Owner-only to toggle, live, via updateMap — unlike MapTemplate above,
  // this isn't a one-time creation choice.
  discussionMode?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NodeUserRef {
  _id: string;
  username: string;
}

export type EdgeSentiment = "positive" | "negative" | "neutral";

// Shape the backend populates onto any Node/Edge ref field it resolves for
// the caller (parentId, targetNodeId, fromNodeId, toNodeId) — a public
// nodeId plus enough to render a preview, deliberately not the same shape
// as NodeUserRef (no _id: internal ids never cross this boundary). See
// utils/nodeType.ts's nodeRefId() for pulling the id back out of one of
// these — idOf() is for NodeUserRef-shaped refs (userId), not this.
export interface EdgeNodeRef {
  nodeId: string;
  text: string;
  type: NodeType;
}

export interface NodeDoc {
  nodeId: string;
  text: string;
  type: NodeType;
  x?: number;
  y?: number;
  color?: string;
  // null when there's no parent; also comes back null if the node it
  // pointed at was deleted (see deleteNodeDao's cascade).
  parentId: string | EdgeNodeRef | null;
  userId: NodeUserRef | string;
  isFirstNode?: boolean;
  mapId?: string;
  health: number;
  defeated: boolean;
  isWeapon?: boolean;
  weaponIcon?: WeaponIcon;
  targetNodeId?: string | EdgeNodeRef | null;
  // True while this node is a member of the map's currently-*chosen* circle
  // (see SelectedCircle) — set/cleared server-side only, via the circle
  // select/deselect endpoints, never directly editable. A node that's in
  // some circle but not this flag is the "unchosen" case: free to drift
  // (see NodeCard's chaotic-drift rendering).
  locked?: boolean;
  // Manual override of this node's OutcomeBadge inner symbol — see
  // SYMBOL_OVERRIDES above. Owner-editable via PATCH, same as text/type.
  symbolOverride?: SymbolOverride | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EdgeDoc {
  edgeId: string;
  mapId: string;
  // null when the node this pointed at was deleted out from under the edge —
  // the populate comes back empty instead of a string id or a ref object.
  fromNodeId: string | EdgeNodeRef | null;
  toNodeId: string | EdgeNodeRef | null;
  sentiment: EdgeSentiment;
  userId: NodeUserRef | string;
}

export interface Attack {
  weapon: Weapon;
  damage: number;
  attackerId: { _id: string; username: string } | string;
  createdAt: string;
}

export interface AttackIndicator {
  nodeId: string;
  incomingNegativeEdges: number;
  weapon: WeaponIcon;
}

export interface ApiError {
  success: false;
  error: string;
  readyAt?: string;
}

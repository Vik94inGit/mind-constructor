import { ATTACK_NODE_TYPES, NODE_TYPES } from "../types";
import type { EdgeNodeRef, NodeType, WeaponIcon } from "../types";

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  Problem: "var(--n-problem)",
  "Problematic option": "var(--n-poption)",
  Option: "var(--n-option)",
  Solution: "var(--n-solution)",
  Success: "var(--n-success)",
  Fail: "var(--n-fail)",
  unknown: "var(--n-unknown)",
};

// No more per-weapon icon (sword/axe/spear as different glyphs) — every
// attack draws the same bow-and-arrows mark now (see MapPage.tsx's
// weapon-mark rendering), differing only in how many arrows fire: nitpick
// fires one, counterpoint two, fatal flaw three. `weaponIcon` (still the
// field a weapon node actually carries — see WEAPON_TO_ICON in
// attackAbl.ts) is repurposed purely as that count lookup; nothing renders
// it as an icon anymore.
export const WEAPON_ARROW_COUNT: Record<WeaponIcon, number> = {
  sword: 1,
  axe: 2,
  spear: 3,
};

export function idOf(ref: string | { _id: string } | undefined | null): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref._id;
}

// idOf's counterpart for a populated Node/Edge ref (parentId, targetNodeId,
// fromNodeId, toNodeId) — that shape carries a public `nodeId`, not `_id`
// (see EdgeNodeRef), so idOf() on one of these always silently returns
// undefined instead of the id.
export function nodeRefId(ref: string | EdgeNodeRef | undefined | null): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref.nodeId;
}

export function usernameOf(ref: string | { username: string } | undefined | null): string {
  if (!ref) return "unknown";
  return typeof ref === "string" ? ref : ref.username;
}

// Clicking a node's icon while inline-editing (or while it's still a
// not-yet-created draft) steps through every type in a fixed order instead
// of opening a dropdown — the same NODE_TYPES order the legend and the
// quick-add ghost ring already use, so the cycle direction matches what's
// on screen.
export function cycleNodeType(current: NodeType): NodeType {
  const i = NODE_TYPES.indexOf(current);
  return NODE_TYPES[(i + 1) % NODE_TYPES.length];
}

// Same idea, scoped to ATTACK_NODE_TYPES — a weapon node's own icon-click
// cycle (now that attack nodes are editable too, see NodeCard) stays within
// the same three types attackAbl.ts's own creation schema accepts, rather
// than landing it on a type (Solution, say) an objection was never meant to
// carry. `current` falls back to the first entry if it's somehow outside
// this set (shouldn't happen — a weapon node's type is only ever set from
// this same list — but keeps the lookup total either way).
export function cycleAttackNodeType(current: NodeType): NodeType {
  const i = ATTACK_NODE_TYPES.indexOf(current as (typeof ATTACK_NODE_TYPES)[number]);
  return ATTACK_NODE_TYPES[(i + 1) % ATTACK_NODE_TYPES.length];
}

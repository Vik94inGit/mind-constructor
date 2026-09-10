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

// The one positive/negative color pair every "zone" backdrop uses (a
// circle's own halo/horns-colored polygon — MapPage's Zones SVG block and
// MiniMap's own scaled-down copy — plus grouped branch-arrow lines and the
// minimap's own per-node dots). Used to be duplicated as a bare hex literal
// at each site with no shared constant; pulled out here so a future re-tune
// only ever touches one place. Plain green/red now — reads unambiguously as
// "positive side" / "negative side" at the small sizes both the minimap
// dots and its zone polygons render at, more so than the earlier gold/
// deep-orange pair.
export const ZONE_COLORS = { positive: "#22c55e", negative: "#ef4444" } as const;

// A node type's own positive/negative lean — the same halo/horns split
// OutcomeBadge.tsx's ringKindFor already classifies by (halo=positive,
// horns=negative), just named for what a group/dot *color* decision needs
// rather than what symbol a single node draws. "unknown" alone has neither
// — nothing to vote with, nothing to color a dot by. Shared by MapPage's
// own circleSentiment (majority vote across a group) and MiniMap's per-node
// dot coloring, so the two can never disagree about which side a type is on.
const POSITIVE_TYPES = new Set<NodeType>(["Success", "Solution", "Option"]);
const NEGATIVE_TYPES = new Set<NodeType>(["Fail", "Problem", "Problematic option"]);

export function sentimentOf(type: NodeType): "positive" | "negative" | null {
  if (POSITIVE_TYPES.has(type)) return "positive";
  if (NEGATIVE_TYPES.has(type)) return "negative";
  return null;
}

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
// whichever types attackAbl.ts's own creation schema accepts (every
// outcome type except "unknown" — see ATTACK_NODE_TYPES's own doc comment),
// rather than landing it on "unknown", which draws no ring/framing at all
// and so never reads as an attack's own claim one way or the other.
// `current` falls back to the first entry if it's somehow outside this set
// (shouldn't happen — a weapon node's type is only ever set from this same
// list — but keeps the lookup total either way).
export function cycleAttackNodeType(current: NodeType): NodeType {
  const i = ATTACK_NODE_TYPES.indexOf(current as (typeof ATTACK_NODE_TYPES)[number]);
  return ATTACK_NODE_TYPES[(i + 1) % ATTACK_NODE_TYPES.length];
}

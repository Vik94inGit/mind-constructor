import { NODE_TYPES } from "../types";
import type { MapKind, NodeType } from "../types";

// Which types the ring of ghosts round a node offers, by what the map is for
// (Map.kind, picked when it was made). A study map offers six study choices;
// every other map, a map made empty included, offers five (CORE_TYPES or its
// kind's own five) and never shows a study type on the ring, not even behind
// its ⋯ ghost. Each list is in ring order: the first type
// sits straight above the node. The desktop's right-click Change type still
// lists every type.

/** The types made for studying: a topic, a question, what a term means, an example, the gist. */
export const STUDY_TYPES: readonly NodeType[] = ["Title", "Question", "Definition", "Example", "Summary"];

/** Every type a map that isn't for studying can have on its ring (what its ⋯ ghost opens). */
export const NON_STUDY_TYPES: readonly NodeType[] = NODE_TYPES.filter((t) => !STUDY_TYPES.includes(t));

/**
 * The five types a newcomer meets first, shown with their names: the problem,
 * the ways out, how each could go, and an idea. The rest (Problematic option,
 * Solution, unknown) wait behind the ring's ⋯ ghost.
 */
export const CORE_TYPES: readonly NodeType[] = ["Problem", "Option", "Success", "Fail", "Idea"];

export const RING_TYPES_BY_KIND: Record<MapKind, readonly NodeType[]> = {
  problem: CORE_TYPES,
  decision: CORE_TYPES,
  // A goal map's root is a Solution (the goal), its steps Options, its obstacles Problems.
  goal: ["Solution", "Option", "Problem", "Success", "Fail"],
  retro: ["Success", "Fail", "Idea", "Problem", "unknown"],
  idea: ["Idea", "Problem", "Option", "Success", "Fail"],
  // Six: a topic, a question about it, its answer (✅, what Quiz me turns to),
  // what a term means, a worked example, and the gist.
  study: ["Title", "Question", "Success", "Definition", "Example", "Summary"],
};

function withCurrent(base: readonly NodeType[], currentType?: NodeType): readonly NodeType[] {
  return currentType && !base.includes(currentType) ? [...base, currentType] : base;
}

/**
 * The ring's types for a map of this kind. The chosen node's own type is
 * always on it (added last when the map's set doesn't have it), so the ring
 * still shows what the node is.
 */
export function ringTypesFor(kind: MapKind | null | undefined, currentType?: NodeType): readonly NodeType[] {
  return withCurrent((kind && RING_TYPES_BY_KIND[kind]) || CORE_TYPES, currentType);
}

/** What the ring's ⋯ ghost opens: every type on a study map, every type but the study ones elsewhere. */
export function ringAllTypesFor(kind: MapKind | null | undefined, currentType?: NodeType): readonly NodeType[] {
  return withCurrent(kind === "study" ? NODE_TYPES : NON_STUDY_TYPES, currentType);
}

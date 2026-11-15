import { NODE_TYPES } from "../types";
import type { MapKind, NodeType } from "../types";

// Which types the ring of ghosts round a node offers, by what the map is for
// (Map.kind, picked when it was made). A study map offers six study choices;
// every other map, a map made empty included, never shows a study type on the
// ring, not even behind its ⋯ ghost. Each list is in ring order: the first type
// sits straight above the node. The desktop's right-click Change type still
// lists every type.

/** The types made for studying: a topic, a question, what a term means, an example, the gist. */
export const STUDY_TYPES: readonly NodeType[] = ["Title", "Question", "Definition", "Example", "Summary"];

/** Every type a map that isn't for studying can have on its ring (what its ⋯ ghost opens). */
export const NON_STUDY_TYPES: readonly NodeType[] = NODE_TYPES.filter((t) => !STUDY_TYPES.includes(t));

export const RING_TYPES_BY_KIND: Record<MapKind, readonly NodeType[]> = {
  problem: ["Problem", "Problematic option", "Solution", "Option", "Success", "Fail", "Idea", "unknown"],
  decision: ["Problem", "Option", "Success", "Fail", "Problematic option", "Solution", "unknown"],
  // A goal map's root is a Solution (the goal), its steps Options, its obstacles Problems.
  goal: ["Solution", "Option", "Problem", "Success", "Fail", "Idea", "unknown"],
  retro: ["Success", "Fail", "Option", "Idea", "Problem", "unknown"],
  idea: ["Idea", "Problem", "Solution", "Option", "Problematic option", "Success", "Fail", "unknown"],
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
  return withCurrent((kind && RING_TYPES_BY_KIND[kind]) || NON_STUDY_TYPES, currentType);
}

/** What the ring's ⋯ ghost opens: every type on a study map, every type but the study ones elsewhere. */
export function ringAllTypesFor(kind: MapKind | null | undefined, currentType?: NodeType): readonly NodeType[] {
  return withCurrent(kind === "study" ? NODE_TYPES : NON_STUDY_TYPES, currentType);
}

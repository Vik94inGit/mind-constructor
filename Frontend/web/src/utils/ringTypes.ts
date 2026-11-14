import { NODE_TYPES } from "../types";
import type { MapKind, NodeType } from "../types";

// Which types the ring of ghosts round a node offers, by what the map is for
// (Map.kind, picked when it was made). A problem-solving map keeps to the
// problem-solving types, a study map to the study ones; a map made empty has
// no kind and offers every type. Each list is in ring order: the first type
// sits straight above the node. The ring's ⋯ ghost opens every type, so none
// is ever out of reach (and the desktop's right-click Change type lists all).
export const RING_TYPES_BY_KIND: Record<MapKind, readonly NodeType[]> = {
  problem: ["Problem", "Problematic option", "Solution", "Option", "Success", "Fail", "Idea", "unknown"],
  decision: ["Problem", "Option", "Success", "Fail", "Problematic option", "Solution", "unknown"],
  // A goal map's root is a Solution (the goal), its steps Options, its obstacles Problems.
  goal: ["Solution", "Option", "Problem", "Success", "Fail", "Idea", "unknown"],
  retro: ["Success", "Fail", "Option", "Idea", "Problem", "unknown"],
  idea: ["Idea", "Problem", "Solution", "Option", "Problematic option", "Success", "Fail", "unknown"],
  // A topic, a question about it, its answer (✅, what Quiz me turns to), a thought, an unknown.
  study: ["Title", "Question", "Success", "Idea", "unknown"],
};

/**
 * The ring's types for a map of this kind. The chosen node's own type is
 * always on it (added last when the map's set doesn't have it), so the ring
 * still shows what the node is.
 */
export function ringTypesFor(kind: MapKind | null | undefined, currentType?: NodeType): readonly NodeType[] {
  const base = kind ? RING_TYPES_BY_KIND[kind] : NODE_TYPES;
  if (!base) return NODE_TYPES;
  return currentType && !base.includes(currentType) ? [...base, currentType] : base;
}

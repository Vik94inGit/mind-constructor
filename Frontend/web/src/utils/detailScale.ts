import { VIEW_SCALE } from "./readingMode";
import type { ReadingMode } from "./readingMode";
import type { AbstractionLevel } from "./abstractionLevel";

// The one "simpler ↔ more detail" equalizer in the view menu (ViewCorner):
// the level of abstraction and the reading mode folded into a single scale.
// The simplest end shows only the top ideas in the most minimal view; each
// step adds the next level of the tree, and once every level is on screen
// the remaining steps add text, from the most minimal view to whole-text
// puzzle cards.
export interface DetailStep {
  level: AbstractionLevel;
  mode: ReadingMode;
}

// VIEW_SCALE runs from the most text to the most minimal; this runs the other way.
const MODES_SIMPLE_FIRST: ReadingMode[] = [...VIEW_SCALE].reverse();

/** Every step of the scale for a map with this many levels, simplest first. */
export function detailSteps(levels: number): DetailStep[] {
  const steps: DetailStep[] = [];
  for (let l = 1; l < levels; l++) steps.push({ level: l, mode: MODES_SIMPLE_FIRST[0] });
  for (const mode of MODES_SIMPLE_FIRST) steps.push({ level: null, mode });
  return steps;
}

/** Where the current level and reading mode sit on the scale (0-based). */
export function detailIndex(levels: number, level: AbstractionLevel, mode: ReadingMode): number {
  const levelSteps = Math.max(0, levels - 1);
  // A level that hides part of the map is a level step, whatever the view.
  if (level !== null && level < levels) return Math.max(0, level - 1);
  return levelSteps + Math.max(0, MODES_SIMPLE_FIRST.indexOf(mode));
}

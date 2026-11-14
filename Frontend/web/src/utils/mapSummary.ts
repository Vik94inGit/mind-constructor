// The presentation's Summary tab (map/PresentationOverlay.tsx): the map's
// nodes gathered up instead of stepped through one slide at a time.
//  - Any map: its nodes grouped by type, in NODE_TYPES order, so picking a
//    few types (the overlay's type chips) reads as "every Problem, then
//    every Solution…".
//  - A template map (some node still carries a ghost's question, `prompt`):
//    each question with its answer, grouped by the template's level
//    (Node.level 1, 2, 3; a template's root and unleveled questions come
//    first), with how many of each level are answered, and whether a level
//    is still locked behind the one before it. Nodes the user added on their
//    own come after, as their other notes.
import { computeSlideOrder } from "./presentation";
import { NODE_TYPES } from "../types";
import type { NodeDoc, NodeType } from "../types";

/** True when the node has something written in it. A ghost never counts, even with leftover text. */
export function isAnswered(n: Pick<NodeDoc, "ghost" | "title" | "text">): boolean {
  if (n.ghost) return false;
  return Boolean(n.title?.trim() || n.text?.trim());
}

/** True when the map came from a template: some node carries a ghost's question. */
export function isTemplateMap(nodes: Pick<NodeDoc, "prompt">[]): boolean {
  return nodes.some((n) => Boolean(n.prompt?.trim()));
}

/** Keeps the nodes of the picked types; no types picked keeps them all. */
export function filterByTypes<N extends Pick<NodeDoc, "type">>(nodes: N[], types: readonly NodeType[]): N[] {
  if (types.length === 0) return nodes;
  const picked = new Set(types);
  return nodes.filter((n) => picked.has(n.type));
}

/** How many nodes of each type there are (every type present, zero when none). */
export function countByType(nodes: Pick<NodeDoc, "type">[]): Record<NodeType, number> {
  const counts = Object.fromEntries(NODE_TYPES.map((t) => [t, 0])) as Record<NodeType, number>;
  for (const n of nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
  return counts;
}

export interface TypeGroup {
  type: NodeType;
  nodes: NodeDoc[];
}

/**
 * The nodes grouped by type, in NODE_TYPES order, leaving out empty types.
 * Within a type, nodes keep the slideshow's reading order (computeSlideOrder),
 * so a parent still comes before its children.
 */
export function groupByType(nodes: NodeDoc[]): TypeGroup[] {
  const ordered = computeSlideOrder(nodes);
  return NODE_TYPES.map((type) => ({ type, nodes: ordered.filter((n) => n.type === type) })).filter(
    (g) => g.nodes.length > 0,
  );
}

export interface AnswerGroup {
  /** The template level, or null for a template's root and unleveled questions. */
  level: number | null;
  /** The questions of this level, in reading order. */
  items: NodeDoc[];
  answered: number;
  total: number;
  /** A leveled group whose level before it still has an unanswered question: its ghosts can't be filled yet. */
  locked: boolean;
}

const levelOf = (n: NodeDoc) => (typeof n.level === "number" && n.level > 0 ? n.level : null);

/**
 * A template map's questions grouped by level, each with its progress, plus
 * the nodes the user added that aren't one of the template's questions.
 * A node counts as a question when it has a prompt (answered or not).
 */
export function templateAnswerGroups(nodes: NodeDoc[]): { groups: AnswerGroup[]; other: NodeDoc[] } {
  const ordered = computeSlideOrder(nodes);
  const questions = ordered.filter((n) => Boolean(n.prompt?.trim()));
  const other = ordered.filter((n) => !n.prompt?.trim());
  const byLevel = new Map<number | null, NodeDoc[]>();
  for (const q of questions) {
    const level = levelOf(q);
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(q);
  }
  const levels = [...byLevel.keys()].sort((a, b) => (a ?? 0) - (b ?? 0));
  const groups: AnswerGroup[] = [];
  for (const level of levels) {
    const items = byLevel.get(level)!;
    const answered = items.filter(isAnswered).length;
    // Mirrors the template's own rule: level L opens once every level L-1
    // ghost is filled. With no level L-1 questions on the map, it is open.
    const before = level !== null ? byLevel.get(level - 1) : undefined;
    const locked = Boolean(before && before.some((n) => !isAnswered(n)));
    groups.push({ level, items, answered, total: items.length, locked });
  }
  return { groups, other };
}

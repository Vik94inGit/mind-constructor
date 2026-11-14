// Quiz me (docs/gestures/quiz-me.md): the map tests its reader. Nobody writes
// questions apart from the map itself: only a ❓ (unknown), a Problem or a
// goal (Solution) asks, and its ✅ (Success) children are the answer. Any
// other node, or an asking node with no ✅ under it, makes no card.
// The marks a reader gives are their own, like feelings (utils/feeling.ts):
// kept per browser and in their view of the map on the server.
import { computeSlideOrder } from "./presentation";
import { nodeRefId } from "./nodeType";
import type { NodeDoc, NodeType } from "../types";

export const QUIZ_MARKS = ["notYet", "shaky", "know"] as const;
export type QuizMark = (typeof QUIZ_MARKS)[number];
/** nodeId -> the reader's last mark for that card. */
export type QuizMarks = Record<string, QuizMark>;

export interface QuizCard {
  nodeId: string;
  question: string;
  /** A text answer (a node's own text). */
  answer?: string;
  /** A list answer (a parent's children, each by its title or text). */
  answerList?: string[];
}

const label = (n: NodeDoc) => (n.title?.trim() || n.text?.trim() || "").trim();

/** The node types that ask a question in Quiz me: ❓, Problem and goal. */
export const QUIZ_QUESTION_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(["unknown", "Problem", "Solution"]);
/** The node type whose nodes answer it: ✅. */
export const QUIZ_ANSWER_TYPE: NodeType = "Success";

/** The cards a map makes, in the order presentation mode shows its nodes. */
export function quizCards(nodes: NodeDoc[]): QuizCard[] {
  const answers = new Map<string, NodeDoc[]>();
  const ids = new Set(nodes.map((n) => n.nodeId));
  for (const n of nodes) {
    if (n.type !== QUIZ_ANSWER_TYPE) continue;
    const parent = nodeRefId(n.parentId);
    if (!parent || !ids.has(parent)) continue;
    if (!answers.has(parent)) answers.set(parent, []);
    answers.get(parent)!.push(n);
  }
  const cards: QuizCard[] = [];
  const ordered = computeSlideOrder(nodes);
  const rank = new Map(ordered.map((n, i) => [n.nodeId, i] as const));
  for (const n of ordered) {
    if (!QUIZ_QUESTION_TYPES.has(n.type)) continue;
    const question = n.title?.trim() || n.text?.trim() || n.prompt?.trim() || "";
    if (!question) continue;
    const list = (answers.get(n.nodeId) ?? [])
      .slice()
      .sort((a, b) => rank.get(a.nodeId)! - rank.get(b.nodeId)!)
      .map(label)
      .filter(Boolean);
    if (list.length > 0) cards.push({ nodeId: n.nodeId, question, answerList: list });
  }
  return cards;
}

const weight: Record<QuizMark | "none", number> = { notYet: 0, shaky: 1, none: 2, know: 3 };

/**
 * The cards for a round: those not known yet first (not yet, then shaky, then
 * never marked, then known), map order kept within each. `weakOnly` keeps only
 * the ones marked not yet or shaky — "Go over the shaky ones".
 */
export function roundOrder(cards: QuizCard[], marks: QuizMarks, weakOnly = false): QuizCard[] {
  const w = (c: QuizCard) => weight[marks[c.nodeId] ?? "none"];
  return cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !weakOnly || w(c) <= 1)
    .sort((a, b) => w(a.c) - w(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

/** How many cards of the round got each mark this round. */
export function roundTally(given: QuizMarks): Record<QuizMark, number> {
  const out: Record<QuizMark, number> = { notYet: 0, shaky: 0, know: 0 };
  for (const m of Object.values(given)) out[m]++;
  return out;
}

export function isQuizMark(v: unknown): v is QuizMark {
  return typeof v === "string" && (QUIZ_MARKS as readonly string[]).includes(v);
}

/** Only real marks — anything else read back is dropped. */
export function parseQuizMarks(raw: unknown): QuizMarks {
  const out: QuizMarks = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, m] of Object.entries(raw as Record<string, unknown>)) if (isQuizMark(m)) out[id] = m;
  return out;
}

const storageKey = (mapId: string | undefined) => `mc_quiz_marks:${mapId ?? ""}`;

export function loadQuizMarks(mapId: string | undefined): QuizMarks {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    return raw ? parseQuizMarks(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveQuizMarks(mapId: string | undefined, marks: QuizMarks): void {
  try {
    if (Object.keys(marks).length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(marks));
  } catch {
    // best-effort — the marks just won't survive a reload on this device
  }
}

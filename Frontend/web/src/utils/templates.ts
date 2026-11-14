import { CANVAS_H, CANVAS_W, avoidOverlap, getCirclePackSpacing } from "./canvasLayout";
import { shapeStep, shapeTree } from "./shapeLayout";
import type { Obstacle } from "./canvasLayout";
import type { MapKind, NodeType } from "../types";

// Ready-made branches a node's owner can grow from it in one click. Each one
// follows a well-known way of working a problem, so the empty prompts lead
// the user through it instead of leaving a blank canvas:
//  - "problem": an issue tree (split the problem into parts, name the risk of
//    doing nothing) plus a plan-do-check loop (ways to solve -> a plan -> a
//    result, good or bad).
//  - "goal": SMART-style — a measurable success criterion, concrete steps in
//    order, the obstacle that could stop them and a fallback, and a review.
//  - "retry": what a failed result leads to — ask why (root cause) and choose
//    what to change before trying again.
//  - "decision": a criteria question and three options, each with its
//    advantage and its risk.
//  - "retro": what went well, what went badly, and what to change — the
//    starting structure of a retrospective map (see MAP_KIND_ROOTS).
//  - "idea": the user's own three rounds — first the idea itself (what it is,
//    how it feels, what problem it solves, why it would work, what it would
//    bring), then making it happen (possibilities, obstacles, the plan, how it
//    feels now), then looking back (what worked, what failed, what it brings
//    to the table, how it feels, whether it is finished as it is).
//  - "study": learning a topic, in titles and questions only. A Title node
//    (the topic) grows the questions that make you understand it (what it is,
//    why it matters) and two Titles for its main parts, then each part's key
//    idea and an example and how it connects to what you know, then what an
//    exam would ask and what is still unclear. The answer is written into each
//    question, so a filled-in Question is a ready card for Quiz me
//    (utils/quiz.ts).
//  - "question": a Question node grows its follow-ups: why it is so and an
//    example, then a common mistake and how to explain it to a friend.
//
// Levels: a template asks its questions in rounds. Every node carries the
// round it belongs to (Node.level); a later round's ghosts are saved from the
// start but stay locked, and off the canvas, until the earlier rounds are
// filled in (utils/templateLevels.ts, hooks/useLevelReveal.ts). A template whose nodes all hang straight from
// the root is drawn as one ring per round (layoutTemplate).

export type TemplateKind = "problem" | "goal" | "retry" | "decision" | "retro" | "idea" | "study" | "question";

/** The templates a single node offers to grow from itself (NodePanel's Info tab). */
export type NodeTemplateKind = Extract<TemplateKind, "problem" | "goal" | "retry" | "idea" | "study" | "question">;

// Which template a node of each type offers, if any.
export const NODE_TYPE_TEMPLATE: Partial<Record<NodeType, NodeTemplateKind>> = {
  Problem: "problem",
  Solution: "goal",
  Fail: "retry",
  Idea: "idea",
  Title: "study",
  Question: "question",
};

export type TemplateNodeKey =
  | "subProblem1"
  | "subProblem2"
  | "negativeScenario"
  | "experiencePositive"
  | "experienceNegative"
  | "way1"
  | "way2"
  | "plan"
  | "resultPositive"
  | "resultNegative"
  | "criteria"
  | "step1"
  | "step2"
  | "step3"
  | "obstacle"
  | "fallback"
  | "review"
  | "whyFailed"
  | "tryAgain"
  | "rootProblem"
  | "rootGoal"
  | "rootDecision"
  | "rootRetro"
  | "criteriaQuestion"
  | "optionA"
  | "advantageA"
  | "riskA"
  | "optionB"
  | "advantageB"
  | "riskB"
  | "optionC"
  | "advantageC"
  | "riskC"
  | "wentWell1"
  | "wentWell2"
  | "wentBad1"
  | "wentBad2"
  | "tryNext1"
  | "tryNext2"
  | "rootIdea"
  | "ideaWhat"
  | "ideaFeel"
  | "ideaSolves"
  | "ideaWhyWork"
  | "ideaProfit"
  | "ideaPossibilities"
  | "ideaObstacles"
  | "ideaPlan"
  | "ideaFeelPlan"
  | "ideaSucceeded"
  | "ideaFailed"
  | "ideaBrings"
  | "ideaFeelDone"
  | "ideaFinished"
  | "rootStudy"
  | "studyWhat"
  | "studyWhy"
  | "studyPart1"
  | "studyPart1Key"
  | "studyPart1Example"
  | "studyPart2"
  | "studyPart2Key"
  | "studyPart2Example"
  | "studyConnect"
  | "studyExam"
  | "studyUnclear"
  | "questionWhy"
  | "questionExample"
  | "questionMistake"
  | "questionExplain";

interface TemplateNode {
  key: TemplateNodeKey;
  type: NodeType;
  /** Step number, for a node that belongs to an ordered sequence. */
  order?: number;
  /** The round of questions this node belongs to (Node.level), from 1. */
  level: number;
  children?: TemplateNode[];
}

const TEMPLATES: Record<TemplateKind, TemplateNode[]> = {
  // 1: take the problem apart; 2: ways to solve it and a plan; 3: how it went.
  problem: [
    { key: "subProblem1", type: "Problem", level: 1 },
    { key: "subProblem2", type: "Problem", level: 1 },
    { key: "negativeScenario", type: "Fail", level: 1 },
    { key: "experiencePositive", type: "Success", level: 1 },
    { key: "experienceNegative", type: "Fail", level: 1 },
    {
      key: "way1",
      type: "Option",
      level: 2,
      children: [
        {
          key: "plan",
          type: "Solution",
          level: 2,
          children: [
            { key: "resultPositive", type: "Success", level: 3 },
            { key: "resultNegative", type: "Fail", level: 3 },
          ],
        },
      ],
    },
    { key: "way2", type: "Option", level: 2 },
  ],
  // 1: what success looks like; 2: the steps and what could stop them; 3: the review.
  goal: [
    { key: "criteria", type: "Success", level: 1 },
    { key: "step1", type: "Option", order: 1, level: 2 },
    { key: "step2", type: "Option", order: 2, level: 2 },
    { key: "step3", type: "Option", order: 3, level: 2 },
    { key: "obstacle", type: "Problem", level: 2, children: [{ key: "fallback", type: "Option", level: 2 }] },
    { key: "review", type: "unknown", level: 3 },
  ],
  // 1: why it failed; 2: what to change.
  retry: [
    { key: "whyFailed", type: "Problematic option", level: 1 },
    { key: "tryAgain", type: "Option", level: 2 },
  ],
  // 1: what matters and the options; 2: each option's advantage and risk.
  decision: [
    { key: "criteriaQuestion", type: "unknown", level: 1 },
    { key: "optionA", type: "Option", level: 1, children: [{ key: "advantageA", type: "Success", level: 2 }, { key: "riskA", type: "Fail", level: 2 }] },
    { key: "optionB", type: "Option", level: 1, children: [{ key: "advantageB", type: "Success", level: 2 }, { key: "riskB", type: "Fail", level: 2 }] },
    { key: "optionC", type: "Option", level: 1, children: [{ key: "advantageC", type: "Success", level: 2 }, { key: "riskC", type: "Fail", level: 2 }] },
  ],
  // 1: what went well and badly; 2: what to change.
  retro: [
    { key: "wentWell1", type: "Success", level: 1 },
    { key: "wentWell2", type: "Success", level: 1 },
    { key: "wentBad1", type: "Fail", level: 1 },
    { key: "wentBad2", type: "Fail", level: 1 },
    { key: "tryNext1", type: "Option", level: 2 },
    { key: "tryNext2", type: "Option", level: 2 },
  ],
  idea: [
    { key: "ideaWhat", type: "Idea", level: 1 },
    { key: "ideaFeel", type: "unknown", level: 1 },
    { key: "ideaSolves", type: "Problem", level: 1 },
    { key: "ideaWhyWork", type: "Solution", level: 1 },
    { key: "ideaProfit", type: "Success", level: 1 },
    { key: "ideaPossibilities", type: "Option", level: 2 },
    { key: "ideaObstacles", type: "Problematic option", level: 2 },
    { key: "ideaPlan", type: "Solution", level: 2 },
    { key: "ideaFeelPlan", type: "unknown", level: 2 },
    { key: "ideaSucceeded", type: "Success", level: 3 },
    { key: "ideaFailed", type: "Fail", level: 3 },
    { key: "ideaBrings", type: "Success", level: 3 },
    { key: "ideaFeelDone", type: "unknown", level: 3 },
    { key: "ideaFinished", type: "unknown", level: 3 },
  ],
  // 1: what it is and its main parts; 2: each part's key idea and an example,
  // and how it connects; 3: what an exam would ask and what is still unclear.
  study: [
    { key: "studyWhat", type: "Question", level: 1 },
    { key: "studyWhy", type: "Question", level: 1 },
    {
      key: "studyPart1",
      type: "Title",
      level: 1,
      children: [
        { key: "studyPart1Key", type: "Question", level: 2 },
        { key: "studyPart1Example", type: "Question", level: 2 },
      ],
    },
    {
      key: "studyPart2",
      type: "Title",
      level: 1,
      children: [
        { key: "studyPart2Key", type: "Question", level: 2 },
        { key: "studyPart2Example", type: "Question", level: 2 },
      ],
    },
    { key: "studyConnect", type: "Question", level: 2 },
    { key: "studyExam", type: "Question", level: 3 },
    { key: "studyUnclear", type: "Question", level: 3 },
  ],
  // 1: why and an example; 2: a common mistake and explaining it simply.
  question: [
    { key: "questionWhy", type: "Question", level: 1 },
    { key: "questionExample", type: "Question", level: 1 },
    { key: "questionMistake", type: "Question", level: 2 },
    { key: "questionExplain", type: "Question", level: 2 },
  ],
};

// The node a new map of each kind starts from, and the template grown from it.
export const MAP_KIND_ROOTS: Record<MapKind, { key: TemplateNodeKey; type: NodeType; template: TemplateKind }> = {
  problem: { key: "rootProblem", type: "Problem", template: "problem" },
  decision: { key: "rootDecision", type: "Problem", template: "decision" },
  goal: { key: "rootGoal", type: "Solution", template: "goal" },
  retro: { key: "rootRetro", type: "unknown", template: "retro" },
  idea: { key: "rootIdea", type: "Idea", template: "idea" },
  study: { key: "rootStudy", type: "Title", template: "study" },
};

export interface PlacedTemplateNode {
  key: TemplateNodeKey;
  type: NodeType;
  order?: number;
  /** The round of questions this node belongs to (Node.level). */
  level: number;
  /** The key of the node this hangs from; null means the node the template was started on. */
  parentKey: TemplateNodeKey | null;
  x: number;
  y: number;
}

const EDGE = 120;
// The id the node a template is started on goes by in its shape (shapeTree).
const ROOT = "__root";

// Parent-before-child walk of the whole tree into one flat list — the order a
// template is created and placed in (parents have to exist before a child can
// point its parentId at them).
function flatten(tree: TemplateNode[]): { node: TemplateNode; parentKey: TemplateNodeKey | null }[] {
  const out: { node: TemplateNode; parentKey: TemplateNodeKey | null }[] = [];
  const walk = (nodes: TemplateNode[], parentKey: TemplateNodeKey | null) => {
    for (const n of nodes) {
      out.push({ node: n, parentKey });
      if (n.children) walk(n.children, n.key);
    }
  };
  walk(tree, null);
  return out;
}

// Lays a template out round `root` — the node the template was started on —
// as plain geometry (utils/shapeLayout.ts): its first level evenly round a
// circle, a square or an equilateral triangle, depending on how many there
// are, and each deeper level one step further out from its own parent. A step
// is the tight "fanned round a shared root" spacing (getCirclePackSpacing).
// Each node is then only nudged as far as it takes to clear what is already
// on the canvas and the template's own earlier nodes.
export function layoutTemplate(
  kind: TemplateKind,
  root: { x: number; y: number },
  existingObstacles: Obstacle[] = [],
): PlacedTemplateNode[] {
  const spacing = getCirclePackSpacing();
  const step = shapeStep(spacing);
  const flat = flatten(TEMPLATES[kind]);
  const shape = flat.every(({ parentKey }) => parentKey === null)
    ? levelRings(flat.map(({ node }) => node))
    : shapeTree(
        flat.map(({ node, parentKey }) => ({ id: node.key, parentId: parentKey ?? ROOT })),
        ROOT,
      );
  const obstacles: Obstacle[] = [...existingObstacles];
  return flat.map(({ node, parentKey }) => {
    const unit = shape.get(node.key)!;
    const desired = { x: root.x + unit.x * step, y: root.y + unit.y * step };
    const placed = avoidOverlap(desired, obstacles);
    obstacles.push({ x: placed.x, y: placed.y, minDist: spacing * 0.9 });
    return {
      key: node.key,
      type: node.type,
      order: node.order,
      level: node.level,
      parentKey,
      x: Math.min(CANVAS_W - EDGE, Math.max(EDGE, placed.x)),
      y: Math.min(CANVAS_H - EDGE, Math.max(EDGE, placed.y)),
    };
  });
}

// How far apart two rings of a leveled template sit, in steps. Less than a
// whole step is enough: each ring is turned half a gap against the one inside
// it, so a node never sits straight behind one of the ring before.
const RING_GAP = 0.85;

/**
 * A flat leveled template (every node straight off the root) in step units:
 * one circle per level, the first a step out, each later one a little further
 * and turned half a gap, so the rounds read as rings growing outward.
 */
export function levelRings(nodes: { key: string; level: number }[]): Map<string, { x: number; y: number }> {
  const levels = [...new Set(nodes.map((n) => n.level))].sort((a, b) => a - b);
  const out = new Map<string, { x: number; y: number }>();
  let radius = 0;
  levels.forEach((level, ring) => {
    const members = nodes.filter((n) => n.level === level);
    // Neighbours on the ring at least a step apart.
    radius = Math.max(ring === 0 ? 1 : radius + RING_GAP, members.length / (2 * Math.PI));
    const turn = ring % 2 === 1 ? Math.PI / members.length : 0;
    members.forEach((n, i) => {
      const a = -Math.PI / 2 + turn + (i * 2 * Math.PI) / members.length;
      out.set(n.key, { x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    });
  });
  return out;
}

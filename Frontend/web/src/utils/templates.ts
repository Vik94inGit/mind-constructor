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

export type TemplateKind = "problem" | "goal" | "retry" | "decision" | "retro";

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
  | "tryNext2";

interface TemplateNode {
  key: TemplateNodeKey;
  type: NodeType;
  /** Step number, for a node that belongs to an ordered sequence. */
  order?: number;
  children?: TemplateNode[];
}

const TEMPLATES: Record<TemplateKind, TemplateNode[]> = {
  problem: [
    { key: "subProblem1", type: "Problem" },
    { key: "subProblem2", type: "Problem" },
    { key: "negativeScenario", type: "Fail" },
    { key: "experiencePositive", type: "Success" },
    { key: "experienceNegative", type: "Fail" },
    {
      key: "way1",
      type: "Option",
      children: [
        {
          key: "plan",
          type: "Solution",
          children: [
            { key: "resultPositive", type: "Success" },
            { key: "resultNegative", type: "Fail" },
          ],
        },
      ],
    },
    { key: "way2", type: "Option" },
  ],
  goal: [
    { key: "criteria", type: "Success" },
    { key: "step1", type: "Option", order: 1 },
    { key: "step2", type: "Option", order: 2 },
    { key: "step3", type: "Option", order: 3 },
    { key: "obstacle", type: "Problem", children: [{ key: "fallback", type: "Option" }] },
    { key: "review", type: "unknown" },
  ],
  retry: [
    { key: "whyFailed", type: "Problematic option" },
    { key: "tryAgain", type: "Option" },
  ],
  decision: [
    { key: "criteriaQuestion", type: "unknown" },
    { key: "optionA", type: "Option", children: [{ key: "advantageA", type: "Success" }, { key: "riskA", type: "Fail" }] },
    { key: "optionB", type: "Option", children: [{ key: "advantageB", type: "Success" }, { key: "riskB", type: "Fail" }] },
    { key: "optionC", type: "Option", children: [{ key: "advantageC", type: "Success" }, { key: "riskC", type: "Fail" }] },
  ],
  retro: [
    { key: "wentWell1", type: "Success" },
    { key: "wentWell2", type: "Success" },
    { key: "wentBad1", type: "Fail" },
    { key: "wentBad2", type: "Fail" },
    { key: "tryNext1", type: "Option" },
    { key: "tryNext2", type: "Option" },
  ],
};

// The node a new map of each kind starts from, and the template grown from it.
export const MAP_KIND_ROOTS: Record<MapKind, { key: TemplateNodeKey; type: NodeType; template: TemplateKind }> = {
  problem: { key: "rootProblem", type: "Problem", template: "problem" },
  decision: { key: "rootDecision", type: "Problem", template: "decision" },
  goal: { key: "rootGoal", type: "Solution", template: "goal" },
  retro: { key: "rootRetro", type: "unknown", template: "retro" },
};

export interface PlacedTemplateNode {
  key: TemplateNodeKey;
  type: NodeType;
  order?: number;
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
  const shape = shapeTree(
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
      parentKey,
      x: Math.min(CANVAS_W - EDGE, Math.max(EDGE, placed.x)),
      y: Math.min(CANVAS_H - EDGE, Math.max(EDGE, placed.y)),
    };
  });
}

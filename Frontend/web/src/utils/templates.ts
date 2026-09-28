import { CANVAS_H, CANVAS_W, getNodeMinDist, spiralPoint } from "./canvasLayout";
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

// Parent-before-child walk of the whole tree into one flat list — same order
// a template used to be *created* in (parents have to exist before a child
// can point its parentId at them), now also the order it's *placed* in: an
// early branch and its own children land in neighboring, inner turns of the
// spiral below before a later branch's, the closest a single flat ordering
// can read as "still grouped by branch" alongside a plain index sequence.
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

// Lays a template out fanned around `root` in a ring — root is the node the
// template was started on (a circle's own root wears NodeCrown's halo/
// horns, so this reads as the rest of the branch gathering "around the
// king"), not another tree hanging in a straight column beneath it. Same
// sunflower-spiral placement spiralPoint already uses everywhere else a
// cluster of nodes needs packing in around a center point without stacking
// on each other (computeBasePositions' own fallback layout,
// computeMajoritySwap) — reused as-is rather than a bespoke ring just for
// this, so the two read as the same visual language.
export function layoutTemplate(kind: TemplateKind, root: { x: number; y: number }): PlacedTemplateNode[] {
  const spacing = getNodeMinDist();
  return flatten(TEMPLATES[kind]).map(({ node, parentKey }, i) => {
    // i+1, not i: spiralPoint(0, root) is root's own position, and this
    // template's root is a real, already-existing node — every placed node
    // starts at least one full turn out from it.
    const p = spiralPoint(i + 1, root, spacing);
    return {
      key: node.key,
      type: node.type,
      order: node.order,
      parentKey,
      x: Math.min(CANVAS_W - EDGE, Math.max(EDGE, p.x)),
      y: Math.min(CANVAS_H - EDGE, Math.max(EDGE, p.y)),
    };
  });
}

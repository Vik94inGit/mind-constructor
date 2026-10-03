import { CANVAS_H, CANVAS_W, getNodeMinDist } from "./canvasLayout";
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

// How far apart each template branch's first node sits from the root and from
// its neighbors, and how wide a node's own children fan out.
const CHILD_FAN_DEG = 50;
const ROTATIONS = 24;

// Lays a template out as a tree around `root`: every top-level branch gets its
// own slice of a ring around the root, and a branch's children grow outward
// from their own parent, fanned inside that slice. Each branch (and the zone
// its children make) stays on its own side of the root instead of being
// scattered across one shared spiral, which put a parent on one side, its
// children on the other, and every sub-zone stacked on top of the others.
//
// The ring is turned to whichever of a few orientations collides least with
// `existingObstacles` and the canvas edge; anything still in the way is the
// caller's to push aside (see structureLayout's planStructureMoves).
export function layoutTemplate(
  kind: TemplateKind,
  root: { x: number; y: number },
  existingObstacles: Obstacle[] = [],
): PlacedTemplateNode[] {
  const top = TEMPLATES[kind];
  const gap = getNodeMinDist();
  const ring = top.length > 1 ? Math.max(gap, gap / (2 * Math.sin(Math.PI / top.length))) : gap;
  const fan = (CHILD_FAN_DEG * Math.PI) / 180;

  const build = (turn: number) => {
    const out: PlacedTemplateNode[] = [];
    const grow = (nodes: TemplateNode[], parentKey: TemplateNodeKey | null, from: { x: number; y: number }, angle: number) => {
      nodes.forEach((n, j) => {
        const a = parentKey === null
          ? angle + (j / nodes.length) * Math.PI * 2
          : angle + (j - (nodes.length - 1) / 2) * fan;
        const dist = parentKey === null ? ring : gap;
        const p = { x: from.x + dist * Math.cos(a), y: from.y + dist * Math.sin(a) };
        out.push({ key: n.key, type: n.type, order: n.order, parentKey, x: p.x, y: p.y });
        if (n.children) grow(n.children, n.key, p, a);
      });
    };
    grow(top, null, root, -Math.PI / 2 + turn);
    return out;
  };

  const cost = (placed: PlacedTemplateNode[]) => {
    let c = 0;
    for (const p of placed) {
      const cx = Math.min(CANVAS_W - EDGE, Math.max(EDGE, p.x));
      const cy = Math.min(CANVAS_H - EDGE, Math.max(EDGE, p.y));
      c += 2 * Math.hypot(p.x - cx, p.y - cy);
      for (const o of existingObstacles) c += Math.max(0, o.minDist - Math.hypot(o.x - p.x, o.y - p.y));
    }
    return c;
  };

  let best = build(0);
  let bestCost = cost(best);
  for (let i = 1; i < ROTATIONS && bestCost > 0; i++) {
    const candidate = build((i / ROTATIONS) * Math.PI * 2);
    const c = cost(candidate);
    if (c < bestCost) {
      best = candidate;
      bestCost = c;
    }
  }
  return best.map((p) => ({
    ...p,
    x: Math.min(CANVAS_W - EDGE, Math.max(EDGE, p.x)),
    y: Math.min(CANVAS_H - EDGE, Math.max(EDGE, p.y)),
  }));
}

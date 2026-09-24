import { CANVAS_H, CANVAS_W, CAPTION_WIDTH } from "./canvasLayout";
import type { NodeType } from "../types";

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

export type TemplateKind = "problem" | "goal" | "retry";

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
  | "tryAgain";

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

const COLUMN = CAPTION_WIDTH + 20;
const ROW = 170;
const EDGE = 120;

const leaves = (n: TemplateNode): number =>
  n.children?.length ? n.children.reduce((sum, c) => sum + leaves(c), 0) : 1;

const depthOf = (nodes: TemplateNode[]): number =>
  nodes.reduce((max, n) => Math.max(max, 1 + (n.children ? depthOf(n.children) : 0)), 0);

// Lays a template out as a tree hanging below (or above) `root`, parents
// before children so they can be created in order. It tries both directions
// and keeps the one that fits the canvas and lands on fewer existing nodes.
export function layoutTemplate(
  kind: TemplateKind,
  root: { x: number; y: number },
  existing: { x: number; y: number }[],
): PlacedTemplateNode[] {
  const tree = TEMPLATES[kind];
  const total = tree.reduce((sum, n) => sum + leaves(n), 0);
  const depth = depthOf(tree);
  const half = ((total - 1) * COLUMN) / 2;
  const centerX = Math.min(CANVAS_W - EDGE - half, Math.max(EDGE + half, root.x));

  const build = (direction: 1 | -1): PlacedTemplateNode[] => {
    const out: PlacedTemplateNode[] = [];
    const place = (nodes: TemplateNode[], parentKey: TemplateNodeKey | null, left: number, level: number) => {
      let cursor = left;
      for (const n of nodes) {
        const width = leaves(n);
        const x = cursor + ((width - 1) * COLUMN) / 2;
        const y = Math.min(CANVAS_H - EDGE, Math.max(EDGE, root.y + direction * level * ROW));
        out.push({ key: n.key, type: n.type, order: n.order, parentKey, x, y });
        if (n.children) place(n.children, n.key, cursor, level + 1);
        cursor += width * COLUMN;
      }
    };
    place(tree, null, centerX - half, 1);
    return out;
  };

  const score = (placed: PlacedTemplateNode[], direction: 1 | -1) => {
    const lastY = root.y + direction * depth * ROW;
    const offCanvas = lastY < EDGE || lastY > CANVAS_H - EDGE ? 1000 : 0;
    const overlaps = placed.filter((p) => existing.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 110)).length;
    return offCanvas + overlaps;
  };

  const down = build(1);
  const up = build(-1);
  return score(down, 1) <= score(up, -1) ? down : up;
}

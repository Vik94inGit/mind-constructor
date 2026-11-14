import { describe, expect, it } from "vitest";
import { NODE_TYPE_TEMPLATE, layoutTemplate, levelRings } from "./templates";
import { CANVAS_H, CANVAS_W, getCirclePackSpacing } from "./canvasLayout";
import { outlinePoints, shapeStep, shapeTree } from "./shapeLayout";
import type { Obstacle } from "./canvasLayout";

const EDGE = 120;

describe("layoutTemplate", () => {
  it("lays the first level out on its shape round the root, a step out", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const step = shapeStep(getCirclePackSpacing());
    // "decision": a question and three options — four, so a square.
    const placed = layoutTemplate("decision", root).filter((p) => p.parentKey === null);
    const want = outlinePoints(4, "square");
    const radius = Math.max(1, 4 / (4 * Math.SQRT2));
    placed.forEach((p, i) => {
      expect(p.x).toBeCloseTo(root.x + want[i].x * radius * step, 5);
      expect(p.y).toBeCloseTo(root.y + want[i].y * radius * step, 5);
    });
  });

  it("puts three children of one node at the corners of an equilateral triangle", () => {
    const shape = shapeTree([{ id: "a", parentId: "r" }, { id: "b", parentId: "r" }, { id: "c", parentId: "r" }], "r");
    const [a, b, c] = ["a", "b", "c"].map((id) => shape.get(id)!);
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(d(a, b)).toBeCloseTo(d(b, c), 6);
    expect(d(b, c)).toBeCloseTo(d(c, a), 6);
  });

  it("keeps every placed node within the canvas edge margin", () => {
    const placed = layoutTemplate("problem", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(EDGE);
      expect(p.x).toBeLessThanOrEqual(CANVAS_W - EDGE);
      expect(p.y).toBeGreaterThanOrEqual(EDGE);
      expect(p.y).toBeLessThanOrEqual(CANVAS_H - EDGE);
    }
  });

  it("wires each node's parentKey back to its own branch parent, and root-level nodes to null", () => {
    const placed = layoutTemplate("problem", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    const plan = placed.find((p) => p.key === "plan");
    expect(plan?.parentKey).toBe("way1");
    const resultPositive = placed.find((p) => p.key === "resultPositive");
    expect(resultPositive?.parentKey).toBe("plan");
    const subProblem1 = placed.find((p) => p.key === "subProblem1");
    expect(subProblem1?.parentKey).toBeNull();
  });

  it("steers a placed node clear of an obstacle already sitting where its shape would put it", () => {
    // existingObstacles is what MapPage's applyTemplate feeds in (every
    // visible node plus every zone backdrop), so a template grown near other
    // nodes never lands on top of them.
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const step = shapeStep(getCirclePackSpacing());
    // "retry" has two nodes: the first straight above the root.
    const raw = { x: root.x, y: root.y - step };
    const obstacle: Obstacle = { x: raw.x, y: raw.y, minDist: 200 };
    const placed = layoutTemplate("retry", root, [obstacle]);
    const dist = Math.hypot(placed[0].x - obstacle.x, placed[0].y - obstacle.y);
    expect(dist).toBeGreaterThanOrEqual(obstacle.minDist - 1);
  });

  it("places one entry per node across every template kind, in parent-before-child order", () => {
    for (const kind of ["problem", "goal", "retry", "decision", "retro", "idea", "study", "question"] as const) {
      const placed = layoutTemplate(kind, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
      const seen = new Set<string>();
      for (const p of placed) {
        if (p.parentKey) expect(seen.has(p.parentKey)).toBe(true);
        seen.add(p.key);
      }
    }
  });

  it("grows an idea in three rounds: the idea, making it happen, looking back", () => {
    const placed = layoutTemplate("idea", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    expect(placed.map((p) => [p.key, p.level, p.parentKey])).toEqual([
      ["ideaWhat", 1, null],
      ["ideaFeel", 1, null],
      ["ideaSolves", 1, null],
      ["ideaWhyWork", 1, null],
      ["ideaProfit", 1, null],
      ["ideaPossibilities", 2, null],
      ["ideaObstacles", 2, null],
      ["ideaPlan", 2, null],
      ["ideaFeelPlan", 2, null],
      ["ideaSucceeded", 3, null],
      ["ideaFailed", 3, null],
      ["ideaBrings", 3, null],
      ["ideaFeelDone", 3, null],
      ["ideaFinished", 3, null],
    ]);
  });

  it("studies a topic in titles and questions only, three rounds deep", () => {
    const placed = layoutTemplate("study", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    expect(new Set(placed.map((p) => p.type))).toEqual(new Set(["Title", "Question"]));
    expect(placed.map((p) => [p.key, p.type, p.level, p.parentKey])).toEqual([
      ["studyWhat", "Question", 1, null],
      ["studyWhy", "Question", 1, null],
      ["studyPart1", "Title", 1, null],
      ["studyPart1Key", "Question", 2, "studyPart1"],
      ["studyPart1Example", "Question", 2, "studyPart1"],
      ["studyPart2", "Title", 1, null],
      ["studyPart2Key", "Question", 2, "studyPart2"],
      ["studyPart2Example", "Question", 2, "studyPart2"],
      ["studyConnect", "Question", 2, null],
      ["studyExam", "Question", 3, null],
      ["studyUnclear", "Question", 3, null],
    ]);
  });

  it("follows a question up with more questions", () => {
    const placed = layoutTemplate("question", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    expect(placed.every((p) => p.type === "Question" && p.parentKey === null)).toBe(true);
    expect(placed.map((p) => p.level)).toEqual([1, 1, 2, 2]);
  });

  it("offers the study templates on a Title and a Question", () => {
    expect(NODE_TYPE_TEMPLATE.Title).toBe("study");
    expect(NODE_TYPE_TEMPLATE.Question).toBe("question");
  });

  it("gives every node of every template a level, starting at 1", () => {
    for (const kind of ["problem", "goal", "retry", "decision", "retro", "idea", "study", "question"] as const) {
      const levels = layoutTemplate(kind, { x: CANVAS_W / 2, y: CANVAS_H / 2 }).map((p) => p.level);
      expect(Math.min(...levels)).toBe(1);
      for (const l of levels) expect(Number.isInteger(l)).toBe(true);
    }
  });

  it("never asks a child before its parent", () => {
    for (const kind of ["problem", "goal", "retry", "decision", "retro", "idea", "study", "question"] as const) {
      const placed = layoutTemplate(kind, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
      const byKey = new Map(placed.map((p) => [p.key, p]));
      for (const p of placed) if (p.parentKey) expect(p.level).toBeGreaterThanOrEqual(byKey.get(p.parentKey)!.level);
    }
  });
});

describe("levelRings", () => {
  it("draws each level as its own ring, further out than the one before", () => {
    const rings = levelRings([
      { key: "a", level: 1 },
      { key: "b", level: 1 },
      { key: "c", level: 1 },
      { key: "d", level: 2 },
      { key: "e", level: 2 },
      { key: "f", level: 3 },
    ]);
    const r = (k: string) => Math.hypot(rings.get(k)!.x, rings.get(k)!.y);
    expect(r("a")).toBeCloseTo(1, 6);
    expect(r("b")).toBeCloseTo(r("a"), 6);
    expect(r("d")).toBeGreaterThan(r("a"));
    expect(r("f")).toBeGreaterThan(r("d"));
  });
});

describe("NODE_TYPE_TEMPLATE", () => {
  it("offers the idea template on an Idea node, and none on an Option", () => {
    expect(NODE_TYPE_TEMPLATE.Idea).toBe("idea");
    expect(NODE_TYPE_TEMPLATE.Problem).toBe("problem");
    expect(NODE_TYPE_TEMPLATE.Option).toBeUndefined();
  });
});

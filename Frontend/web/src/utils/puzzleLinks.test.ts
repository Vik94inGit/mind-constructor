import { describe, expect, it } from "vitest";
import { computePuzzleJoins, sideFacing } from "./puzzleLinks";
import type { NodeDoc } from "../types";

const node = (nodeId: string, parentId: string | null = null) => ({ nodeId, parentId }) as unknown as NodeDoc;

describe("sideFacing", () => {
  it("picks the side along the larger gap", () => {
    expect(sideFacing({ x: 0, y: 0 }, { x: 100, y: 10 })).toBe(1);
    expect(sideFacing({ x: 0, y: 0 }, { x: -100, y: 10 })).toBe(3);
    expect(sideFacing({ x: 0, y: 0 }, { x: 10, y: 100 })).toBe(2);
    expect(sideFacing({ x: 0, y: 0 }, { x: 10, y: -100 })).toBe(0);
  });
});

describe("computePuzzleJoins", () => {
  it("gives a parent a tab toward its child and the child a matching blank", () => {
    const positions = new Map([
      ["p", { x: 0, y: 0 }],
      ["c", { x: 200, y: 0 }],
    ]);
    const joins = computePuzzleJoins([node("p"), node("c", "p")], [], positions);
    expect(joins.get("p")!.cuts).toEqual([undefined, 1, undefined, undefined]);
    expect(joins.get("c")!.cuts).toEqual([undefined, undefined, undefined, -1]);
    expect(joins.get("p")!.complete).toBe(false);
  });

  it("marks a piece joined on all four sides complete", () => {
    const positions = new Map([
      ["p", { x: 0, y: 0 }],
      ["t", { x: 0, y: -200 }],
      ["r", { x: 200, y: 0 }],
      ["b", { x: 0, y: 200 }],
      ["l", { x: -200, y: 0 }],
    ]);
    const nodes = [node("p"), node("t", "p"), node("r", "p"), node("b", "p"), node("l", "p")];
    expect(computePuzzleJoins(nodes, [], positions).get("p")!.complete).toBe(true);
  });
});

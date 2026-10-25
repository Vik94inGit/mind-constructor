import { describe, expect, it } from "vitest";
import { makeNode } from "../test/fixtures";
import { REDIRECT_BRING_FACTOR, REDIRECT_KEEP_FACTOR, knobSpot, redirectRefusal, redirectSpot } from "./edgeRedirect";
import type { NodeDoc } from "../types";

const own = (_n: NodeDoc) => true;

describe("redirectRefusal", () => {
  const root = makeNode({ nodeId: "root", parentId: null });
  const a = makeNode({ nodeId: "a", parentId: "root" });
  const b = makeNode({ nodeId: "b", parentId: "root" });
  const aChild = makeNode({ nodeId: "a1", parentId: "a" });
  const nodes = [root, a, b, aChild];

  it("lets a child move to a sibling", () => {
    expect(redirectRefusal(a, b, nodes, own)).toBeNull();
  });

  it("does nothing over the child itself or its own parent", () => {
    expect(redirectRefusal(a, a, nodes, own)).toBe("same");
    expect(redirectRefusal(a, root, nodes, own)).toBe("same");
    expect(redirectRefusal(a, undefined, nodes, own)).toBe("same");
  });

  it("refuses the child's own descendant, which would close a loop", () => {
    expect(redirectRefusal(a, aChild, nodes, own)).toBe("ownBranch");
  });

  it("refuses a parent or a child that isn't yours", () => {
    expect(redirectRefusal(a, b, nodes, (n) => n.nodeId !== "b")).toBe("notOwn");
    expect(redirectRefusal(a, b, nodes, (n) => n.nodeId !== "a")).toBe("notOwn");
  });

  it("keeps an attack hanging from attacks only", () => {
    const attack = makeNode({ nodeId: "w", parentId: "b", isWeapon: true });
    const other = makeNode({ nodeId: "w2", parentId: "a", isWeapon: true });
    expect(redirectRefusal(attack, a, [...nodes, attack, other], own)).toBe("attack");
    expect(redirectRefusal(attack, other, [...nodes, attack, other], own)).toBeNull();
  });
});

describe("redirectSpot", () => {
  const REACH = 300;

  it("leaves a child its new zone can reach where it is", () => {
    const child = { x: 400 + REACH * REDIRECT_KEEP_FACTOR - 1, y: 500 };
    expect(redirectSpot(child, { x: 400, y: 500 }, REACH)).toEqual(child);
  });

  it("brings a far child in next to its new parent, on the side it sat", () => {
    const at = redirectSpot({ x: 400, y: 2500 }, { x: 400, y: 500 }, REACH);
    expect(at.x).toBeCloseTo(400);
    expect(at.y).toBeCloseTo(500 + REACH * REDIRECT_BRING_FACTOR);
  });
});

describe("knobSpot", () => {
  it("sits just past the ring round the opened node", () => {
    expect(knobSpot({ x: 0, y: 0 }, { x: 1000, y: 0 }, 160)).toEqual({ x: 160, y: 0 });
  });

  it("goes halfway on a branch too short for that", () => {
    expect(knobSpot({ x: 0, y: 0 }, { x: 200, y: 0 }, 160)).toEqual({ x: 100, y: 0 });
  });
});

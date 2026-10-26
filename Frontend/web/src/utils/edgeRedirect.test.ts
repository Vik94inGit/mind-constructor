import { describe, expect, it } from "vitest";
import { makeNode } from "../test/fixtures";
import { REDIRECT_BRING_FACTOR, REDIRECT_KEEP_FACTOR, linksToMove, redirectRefusal, redirectSpot, takeParentPlace } from "./edgeRedirect";
import type { EdgeDoc, NodeDoc } from "../types";

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

describe("linksToMove", () => {
  const edge = (edgeId: string, fromNodeId: string, toNodeId: string, sentiment: "positive" | "negative" | "neutral" = "positive") =>
    ({ edgeId, mapId: "m", fromNodeId, toNodeId, sentiment, userId: "u" }) as EdgeDoc;

  it("moves the child's link to its old parent over to the new one, same direction and feeling", () => {
    const out = linksToMove("c", "old", "new", [edge("e1", "old", "c", "negative"), edge("e2", "c", "x")]);
    expect(out.remove.map((e) => e.edgeId)).toEqual(["e1"]);
    expect(out.create).toEqual([{ fromNodeId: "new", toNodeId: "c", sentiment: "negative" }]);
  });

  it("only takes the old link off when the child is already linked to the new parent", () => {
    const out = linksToMove("c", "old", "new", [edge("e1", "c", "old"), edge("e2", "new", "c")]);
    expect(out.remove.map((e) => e.edgeId)).toEqual(["e1"]);
    expect(out.create).toEqual([]);
  });

  it("has nothing to move without an old parent or a link to it", () => {
    expect(linksToMove("c", null, "new", [edge("e1", "c", "x")])).toEqual({ remove: [], create: [] });
    expect(linksToMove("c", "old", "new", [edge("e1", "c", "x")])).toEqual({ remove: [], create: [] });
  });
});

describe("takeParentPlace", () => {
  // g's zone holds p; p's zone holds c, s1 and s2; x sits in another zone.
  const g = makeNode({ nodeId: "g", parentId: null, x: 0, y: 0 });
  const p = makeNode({ nodeId: "p", parentId: "g", x: 100, y: 0 });
  const c = makeNode({ nodeId: "c", parentId: "p", x: 200, y: 0 });
  const s1 = makeNode({ nodeId: "s1", parentId: "p", x: 150, y: 50 });
  const s2 = makeNode({ nodeId: "s2", parentId: "p", x: 150, y: -50 });
  const x = makeNode({ nodeId: "x", parentId: null, x: 900, y: 0 });
  const nodes = [g, p, c, s1, s2, x];
  const at = (n: NodeDoc) => ({ x: n.x!, y: n.y! });
  const edge = (edgeId: string, from: string, to: string, sentiment: EdgeDoc["sentiment"] = "neutral") =>
    ({ edgeId, fromNodeId: from, toNodeId: to, sentiment }) as EdgeDoc;

  it("puts the child in its parent's place and hangs the whole zone, old parent too, from it", () => {
    const plan = takeParentPlace(c, nodes, [], own, at);
    if (!plan || typeof plan === "string") throw new Error("no plan");
    expect(plan.patches).toEqual([
      { nodeId: "c", parentId: "g", x: 100, y: 0 },
      { nodeId: "s1", parentId: "c", x: 150, y: 50 },
      { nodeId: "s2", parentId: "c", x: 150, y: -50 },
      { nodeId: "p", parentId: "c", x: 200, y: 0 },
    ]);
  });

  it("moves the old parent's links, to its zone and to other zones, over to the child", () => {
    const edges = [edge("pc", "p", "c"), edge("gp", "g", "p", "positive"), edge("px", "p", "x", "negative"), edge("ps1", "s1", "p")];
    const plan = takeParentPlace(c, nodes, edges, own, at);
    if (!plan || typeof plan === "string") throw new Error("no plan");
    expect(plan.remove.map((e) => e.edgeId)).toEqual(["gp", "px", "ps1"]);
    expect(plan.create).toEqual([
      { fromNodeId: "g", toNodeId: "c", sentiment: "positive" },
      { fromNodeId: "c", toNodeId: "x", sentiment: "negative" },
      { fromNodeId: "s1", toNodeId: "c", sentiment: "neutral" },
    ]);
  });

  it("doesn't link the child twice to a node it is already linked to", () => {
    const edges = [edge("px", "p", "x"), edge("cx", "x", "c")];
    const plan = takeParentPlace(c, nodes, edges, own, at);
    if (!plan || typeof plan === "string") throw new Error("no plan");
    expect(plan.remove.map((e) => e.edgeId)).toEqual(["px"]);
    expect(plan.create).toEqual([]);
  });

  it("makes the child a root when its parent was one", () => {
    const plan = takeParentPlace(p, nodes, [], own, at);
    if (!plan || typeof plan === "string") throw new Error("no plan");
    expect(plan.patches[0]).toEqual({ nodeId: "p", parentId: null, x: 0, y: 0 });
    expect(plan.patches[plan.patches.length - 1]).toEqual({ nodeId: "g", parentId: "p", x: 100, y: 0 });
  });

  it("refuses when a node that would change, or the new parent above, isn't yours", () => {
    expect(takeParentPlace(c, nodes, [], (n) => n.nodeId !== "s2", at)).toBe("notOwn");
    expect(takeParentPlace(c, nodes, [], (n) => n.nodeId !== "g", at)).toBe("notOwn");
  });

  it("refuses an attack, and leaves attacks on the old parent where they are", () => {
    const w = makeNode({ nodeId: "w", parentId: "p", targetNodeId: "p", isWeapon: true });
    const w2 = makeNode({ nodeId: "w2", parentId: "w", targetNodeId: "p", isWeapon: true });
    expect(takeParentPlace(w2, [...nodes, w, w2], [], own, at)).toBe("attack");
    const plan = takeParentPlace(c, [...nodes, w], [], own, at);
    if (!plan || typeof plan === "string") throw new Error("no plan");
    expect(plan.patches.map((q) => q.nodeId)).not.toContain("w");
  });

  it("has nothing to do for a node with no parent", () => {
    expect(takeParentPlace(g, nodes, [], own, at)).toBeNull();
  });
});

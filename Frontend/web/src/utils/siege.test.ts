import { describe, expect, it } from "vitest";
import { makeNode } from "../test/fixtures";
import { holdMembers, holdsOf, planMove } from "./siege";

// A kingdom "k" with two castles: "app" (an option with a success and a
// failure below it) and "tt" (an option with two leaves).
function realm() {
  return [
    makeNode({ nodeId: "k", type: "Problem" }),
    makeNode({ nodeId: "app", type: "Option", parentId: "k" }),
    makeNode({ nodeId: "ok", type: "Success", parentId: "app" }),
    makeNode({ nodeId: "bad", type: "Fail", parentId: "app", health: 60 }),
    makeNode({ nodeId: "tt", type: "Option", parentId: "k" }),
    makeNode({ nodeId: "t1", type: "Success", parentId: "tt" }),
    makeNode({ nodeId: "t2", type: "Fail", parentId: "tt" }),
  ];
}

describe("holdsOf", () => {
  it("calls a zone with a parentless keep the kingdom and every other a castle", () => {
    expect(holdsOf(["k", "app", "tt"], realm())).toEqual([
      { rootId: "k", kind: "kingdom" },
      { rootId: "app", kind: "castle" },
      { rootId: "tt", kind: "castle" },
    ]);
  });
});

describe("holdMembers", () => {
  it("is the keep and everything below it, without weapon or protection nodes", () => {
    const nodes = [
      ...realm(),
      makeNode({ nodeId: "w", isWeapon: true, parentId: "ok", targetNodeId: "ok" }),
      makeNode({ nodeId: "s", isProtection: true, parentId: "app", protectsNodeId: "app" }),
    ];
    expect(holdMembers("app", nodes).map((n) => n.nodeId)).toEqual(["app", "ok", "bad"]);
    expect(holdMembers("k", nodes)).toHaveLength(7);
  });
});

describe("planMove", () => {
  it("siege: questions the outer node asked the least", () => {
    const nodes = [...realm(), makeNode({ nodeId: "w", isWeapon: true, parentId: "ok", targetNodeId: "ok" })];
    expect(planMove("siege", "app", null, nodes)).toEqual({
      strategy: "siege",
      action: "attack",
      targetId: "bad",
      weapon: "nitpick",
      type: "unknown",
    });
  });

  it("undermine: goes for the keep", () => {
    expect(planMove("undermine", "tt", null, realm())).toMatchObject({ targetId: "tt", type: "Problematic option" });
  });

  it("assault: hits the weakest unshielded node with a fatal flaw", () => {
    expect(planMove("assault", "app", null, realm())).toMatchObject({ targetId: "bad", weapon: "fatalFlaw" });
    const shielded = [...realm(), makeNode({ nodeId: "s", isProtection: true, protectsNodeId: "bad" })];
    expect(planMove("assault", "app", null, shielded)?.targetId).not.toBe("bad");
  });

  it("assault: leaves defeated nodes alone", () => {
    const nodes = realm().map((n) => (n.nodeId === "bad" ? { ...n, defeated: true } : n));
    expect(planMove("assault", "app", null, nodes)?.targetId).not.toBe("bad");
  });

  it("sally: strikes the latest attack on the opponent's own castle", () => {
    const nodes = [
      ...realm(),
      makeNode({ nodeId: "w1", isWeapon: true, parentId: "t1", targetNodeId: "t1" }),
      makeNode({ nodeId: "w2", isWeapon: true, parentId: "t2", targetNodeId: "t2" }),
      makeNode({ nodeId: "w3", isWeapon: true, parentId: "ok", targetNodeId: "ok" }),
    ];
    expect(planMove("sally", "app", "tt", nodes)).toMatchObject({ targetId: "w2", type: "Success" });
    expect(planMove("sally", "app", null, nodes)).toBeNull();
  });

  it("fortify: shields the opponent's own keep once", () => {
    expect(planMove("fortify", "app", "tt", realm())).toEqual({
      strategy: "fortify",
      action: "protect",
      targetId: "tt",
      type: "Solution",
    });
    const shielded = [...realm(), makeNode({ nodeId: "s", isProtection: true, protectsNodeId: "tt" })];
    expect(planMove("fortify", "app", "tt", shielded)).toBeNull();
  });

  it("returns null when nothing in the hold is left standing", () => {
    const nodes = realm().map((n) => ({ ...n, defeated: true }));
    expect(planMove("siege", "app", null, nodes)).toBeNull();
    expect(planMove("assault", "app", null, nodes)).toBeNull();
  });
});

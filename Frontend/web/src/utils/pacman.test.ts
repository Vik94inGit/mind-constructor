import { describe, expect, it } from "vitest";
import { chompAim, chompersFor, chompMouth, chompMove, chompRun, chompsOnHover, chompTargets } from "./pacman";

describe("chompsOnHover", () => {
  it("chomps for a counterpoint or a fatal flaw only", () => {
    expect(chompsOnHover({ isWeapon: true, weaponIcon: "axe" })).toBe(true);
    expect(chompsOnHover({ isWeapon: true, weaponIcon: "spear" })).toBe(true);
    expect(chompsOnHover({ isWeapon: true, weaponIcon: "sword" })).toBe(false);
  });

  it("never chomps for a node that is not an attack", () => {
    expect(chompsOnHover({ isWeapon: false, weaponIcon: "spear" })).toBe(false);
    expect(chompsOnHover({ isWeapon: true })).toBe(false);
  });
});

describe("chompRun", () => {
  it("faces the target and stops with its mouth over the target's edge", () => {
    const run = chompRun({ x: 0, y: 0 }, { x: 0, y: 200 }, 25, 24);
    expect(run.angle).toBe(90);
    expect(run.reach).toBe(200 - 24 - 10);
  });

  it("stays home when the target is right on top of it", () => {
    expect(chompRun({ x: 10, y: 10 }, { x: 10, y: 10 }, 25, 24)).toEqual({ angle: 0, reach: 0 });
    expect(chompRun({ x: 0, y: 0 }, { x: -20, y: 0 }, 25, 24).reach).toBe(0);
  });
});

describe("chompersFor / chompTargets", () => {
  const nodes = [
    { nodeId: "t" },
    { nodeId: "fatal", isWeapon: true, weaponIcon: "spear" as const, targetNodeId: "t" },
    { nodeId: "counter", isWeapon: true, weaponIcon: "axe" as const, targetNodeId: { nodeId: "t", text: "", type: "Problem" as const } },
    { nodeId: "nit", isWeapon: true, weaponIcon: "sword" as const, targetNodeId: "t" },
  ];

  it("runs the hovered strong attack alone", () => {
    expect([...chompersFor("fatal", nodes)]).toEqual(["fatal"]);
    expect(chompersFor("nit", nodes).size).toBe(0);
  });

  it("runs every strong attack on a hovered target", () => {
    expect([...chompersFor("t", nodes)].sort()).toEqual(["counter", "fatal"]);
    expect(chompersFor(null, nodes).size).toBe(0);
  });

  it("lists the strong attacks and their targets as hover spots", () => {
    expect([...chompTargets(nodes)].sort()).toEqual(["counter", "fatal", "t"]);
  });
});

describe("chompMove", () => {
  it("runs toward the target, stopping at its edge, and nudges a little further", () => {
    const m = chompMove({ x: 0, y: 0 }, { x: 0, y: 100 }, 20, 20);
    expect(m.angle).toBe(90);
    expect(m.dx).toBeCloseTo(0);
    expect(m.dy).toBeCloseTo(72);
    expect(m.ly).toBeCloseTo(77);
  });
});

describe("chompAim", () => {
  type N = { nodeId: string; targetNodeId?: string; isProtection?: boolean; protectsNodeId?: string; defeated: boolean };
  const target: N = { nodeId: "t", defeated: false };
  const attack: N = { nodeId: "a", targetNodeId: "t", defeated: false };
  it("bites the target, or the shield in front of it", () => {
    expect(chompAim(attack, [target, attack])?.nodeId).toBe("t");
    const shield: N = { nodeId: "s", isProtection: true, protectsNodeId: "t", defeated: false };
    expect(chompAim(attack, [target, attack, shield])?.nodeId).toBe("s");
    expect(chompAim(attack, [target, attack, { ...shield, defeated: true }])?.nodeId).toBe("t");
  });
});

describe("chompMouth", () => {
  it("opens as wide as the missing health, within a readable range", () => {
    expect(chompMouth(50)).toBe(180);
    expect(chompMouth(100)).toBe(40);
    expect(chompMouth(0)).toBe(260);
  });
});

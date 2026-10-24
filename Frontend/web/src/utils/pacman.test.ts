import { describe, expect, it } from "vitest";
import { chompersFor, chompRun, chompsOnHover, chompTargets } from "./pacman";

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

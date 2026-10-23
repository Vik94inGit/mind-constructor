import { describe, expect, it } from "vitest";
import { chompRun, chompsOnHover } from "./pacman";

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

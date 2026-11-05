import { describe, expect, it } from "vitest";
import { cardsFitScreen, howManyFit, openOnly, outlineNumbers, planCardFit, zoneMembers, zoneSteps } from "./cardFit";
import type { NodeDoc } from "../types";

const node = (nodeId: string, parentId?: string) => ({ nodeId, text: "", type: "Option", parentId }) as NodeDoc;
const size = () => ({ w: 100, h: 50 });
const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, w: 100, h: 50 }));

// A desk of 800×600: at zoom 0.5 it holds a block of 1600×1200 canvas units.
const screen = { w: 800, h: 600 };

describe("cardsFitScreen", () => {
  it("fits a few cards and not hundreds", () => {
    expect(cardsFitScreen(cards(10), screen, 0.5)).toBe(true);
    expect(cardsFitScreen(cards(400), screen, 0.5)).toBe(false);
  });

  it("fits fewer cards at a larger readable zoom", () => {
    const n = howManyFit(cards(400), screen, 0.5);
    expect(howManyFit(cards(400), screen, 1)).toBeLessThan(n);
    expect(cardsFitScreen(cards(n), screen, 0.5)).toBe(true);
    expect(cardsFitScreen(cards(n + 1), screen, 0.5)).toBe(false);
  });
});

describe("planCardFit", () => {
  // A few top ideas, each with a long branch of children.
  const branchy = (roots: number, kids: number) =>
    Array.from({ length: roots }, (_, r) => [
      node(`r${r}`),
      ...Array.from({ length: kids }, (_, k) => node(`r${r}k${k}`, `r${r}`)),
    ]).flat();

  it("leaves a board that fits alone", () => {
    expect(planCardFit(branchy(3, 2), new Set(), size, screen, 0.5)).toEqual({ kind: "fits" });
  });

  it("packs every branch when the children don't fit", () => {
    const plan = planCardFit(branchy(5, 60), new Set(), size, screen, 0.5);
    expect(plan.kind).toBe("packed");
    if (plan.kind === "packed") expect([...plan.folded].sort()).toEqual(["r0", "r1", "r2", "r3", "r4"]);
  });

  it("names the top cards past what fits when there are too many", () => {
    const nodes = Array.from({ length: 400 }, (_, i) => node(`n${i}`));
    const plan = planCardFit(nodes, new Set(), size, screen, 0.5);
    expect(plan.kind).toBe("tooMany");
    if (plan.kind !== "tooMany") return;
    const kept = 400 - plan.extraRootIds.length;
    expect(kept).toBe(howManyFit(cards(400), screen, 0.5));
    expect(plan.extraRootIds[0]).toBe(`n${kept}`);
  });
});

describe("openOnly", () => {
  it("opens the chosen branch and the ones above it, packing the rest", () => {
    const nodes = [node("root"), node("a", "root"), node("a1", "a"), node("a11", "a1"), node("b", "root"), node("b1", "b")];
    expect([...openOnly(nodes, "a1")].sort()).toEqual(["b"]);
    expect([...openOnly(nodes, "b")].sort()).toEqual(["a", "a1"]);
  });
});

describe("zones one at a time", () => {
  // root ─ a ─ a1
  //      │   └ a2
  //      └ b
  // c
  const nodes = [node("root"), node("a", "root"), node("a1", "a"), node("a2", "a"), node("b", "root"), node("c")];

  it("steps through every parent as the outline reads them", () => {
    expect(zoneSteps(nodes)).toEqual(["root", "a"]);
  });

  it("shows a zone as its parent and the nodes hanging straight from it", () => {
    expect([...zoneMembers(nodes, "root")].sort()).toEqual(["a", "b", "root"]);
    expect([...zoneMembers(nodes, "a")].sort()).toEqual(["a", "a1", "a2"]);
  });

  it("numbers the cards like an outline", () => {
    const at = outlineNumbers(nodes);
    expect(Object.fromEntries(at)).toEqual({ root: "1", a: "1.1", a1: "1.1.1", a2: "1.1.2", b: "1.2", c: "2" });
  });
});

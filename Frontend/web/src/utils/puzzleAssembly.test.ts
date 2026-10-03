import { describe, expect, it } from "vitest";
import { assemblePuzzles } from "./puzzleAssembly";

const size = { w: 100, h: 40 };
const sizes = (...ids: string[]) => new Map(ids.map((id) => [id, size]));

describe("assemblePuzzles", () => {
  it("seats a linked piece flush on the side it lies toward", () => {
    // c overlaps p, a little to its lower right — more down than across.
    const positions = new Map([
      ["p", { x: 100, y: 100 }],
      ["c", { x: 115, y: 130 }],
    ]);
    const { positions: out, seated } = assemblePuzzles(["p", "c"], [{ from: "p", to: "c" }], positions, sizes("p", "c"));
    expect(out.get("p")).toBeUndefined(); // the root stays put
    expect(out.get("c")).toEqual({ x: 100, y: 140 });
    expect(seated).toEqual([{ from: "p", to: "c" }]);
  });

  it("gives each side to one piece, moving the next to a free one", () => {
    const positions = new Map([
      ["p", { x: 100, y: 100 }],
      ["a", { x: 220, y: 100 }],
      ["b", { x: 230, y: 120 }],
    ]);
    const links = [
      { from: "p", to: "a" },
      { from: "p", to: "b" },
    ];
    const { positions: out } = assemblePuzzles(["p", "a", "b"], links, positions, sizes("p", "a", "b"));
    expect(out.get("a") ?? positions.get("a")).toEqual({ x: 200, y: 100 });
    expect(out.get("b")).toEqual({ x: 100, y: 140 }); // below, the side nearest it
  });

  it("never moves a held piece, but seats others against it", () => {
    const positions = new Map([
      ["p", { x: 100, y: 100 }],
      ["c", { x: 300, y: 300 }],
    ]);
    const { positions: out } = assemblePuzzles(
      ["p", "c"],
      [{ from: "c", to: "p" }],
      positions,
      sizes("p", "c"),
      new Set(["p"]),
    );
    expect(out.get("p")).toBeUndefined();
    expect(out.get("c")).toEqual({ x: 200, y: 100 });
  });

  it("leaves unlinked pieces and pieces without a measured card alone", () => {
    const positions = new Map([
      ["p", { x: 100, y: 100 }],
      ["q", { x: 120, y: 110 }],
      ["r", { x: 130, y: 100 }],
    ]);
    const { positions: out } = assemblePuzzles(["p", "q", "r"], [{ from: "p", to: "r" }], positions, sizes("p", "q"));
    expect(out.size).toBe(0);
  });
});

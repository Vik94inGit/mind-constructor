import { describe, expect, it } from "vitest";
import { cardSpaceIds, spotFields, storedSpots, withCardSpots } from "./cardSpace";
import type { NodeDoc } from "../types";

const node = (nodeId: string, extra: Partial<NodeDoc> = {}) =>
  ({ nodeId, text: "", type: "Option", x: 10, y: 20, ...extra }) as NodeDoc;

describe("cardSpace", () => {
  it("puts only nodes in the full puzzle look in card space", () => {
    const modes: Record<string, "puzzle" | "mixed" | "actual"> = { a: "puzzle", b: "mixed", c: "actual" };
    const ids = cardSpaceIds([node("a"), node("b"), node("c")], (id) => modes[id]);
    expect([...ids]).toEqual(["a"]);
  });

  it("draws a card at its own spot, and at the icon's until it has one", () => {
    const placed = node("a", { cardX: 500, cardY: 600 });
    const fresh = node("b");
    const icon = node("c", { cardX: 900, cardY: 900 });
    const out = withCardSpots([placed, fresh, icon], new Set(["a", "b"]));
    expect(out.map((n) => [n.x, n.y])).toEqual([[500, 600], [10, 20], [10, 20]]);
  });

  it("draws someone else's card where the cards view packed it for this viewer", () => {
    const placed = node("a", { cardX: 500, cardY: 600 });
    const out = withCardSpots([placed, node("b")], new Set(["a", "b"]), new Map([["a", { x: 1, y: 2 }], ["b", { x: 3, y: 4 }]]));
    expect(out.map((n) => [n.x, n.y])).toEqual([[1, 2], [3, 4]]);
  });

  it("saves a move into the space the node is drawn in", () => {
    expect(spotFields(true, { x: 1, y: 2 })).toEqual({ cardX: 1, cardY: 2 });
    expect(spotFields(false, { x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });

  it("keeps both spots to put back", () => {
    expect(storedSpots(node("a", { cardX: 5, cardY: 6 }))).toEqual({ x: 10, y: 20, cardX: 5, cardY: 6 });
  });
});

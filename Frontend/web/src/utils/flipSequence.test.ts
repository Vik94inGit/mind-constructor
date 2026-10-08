import { describe, expect, it } from "vitest";
import { flipOrder } from "./flipSequence";
import type { NodeDoc } from "../types";

const n = (nodeId: string, emoji: string, order: number | null = null) =>
  ({ nodeId, emoji, order, text: "", type: "Option", parentId: null, userId: "u", health: 100, defeated: false }) as NodeDoc;

describe("flipOrder", () => {
  it("puts the parent first, then children by their order number, then as they come", () => {
    const members = [n("c", "🙂"), n("root", "😟"), n("a", "🤔", 2), n("b", "🔥", 1)];
    expect(flipOrder(members, "root")).toEqual(["root", "b", "a", "c"]);
  });

  it("skips nodes with no emoji", () => {
    expect(flipOrder([n("root", ""), n("a", "🙂"), n("b", "")], "root")).toEqual(["a"]);
  });
});

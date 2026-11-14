import { describe, expect, it } from "vitest";
import { hiddenLevelIds, levelLocks, revealedRound } from "./templateLevels";
import type { NodeDoc } from "../types";

type N = Pick<NodeDoc, "nodeId" | "parentId" | "level" | "ghost" | "text">;
const node = (nodeId: string, parentId: string | null, level: number | null, filled = false): N => ({
  nodeId,
  parentId,
  level,
  ghost: !filled,
  text: filled ? "answer" : "",
});

describe("levelLocks", () => {
  it("locks level 2 and 3 while level 1 is still empty, and says how many are left", () => {
    const locks = levelLocks([
      node("root", null, null),
      node("a", "root", 1),
      node("b", "root", 1, true),
      node("c", "root", 2),
      node("d", "root", 3),
    ]);
    expect(locks.has("a")).toBe(false);
    expect(locks.get("c")).toEqual({ waitFor: 1, left: 1 });
    expect(locks.get("d")).toEqual({ waitFor: 1, left: 1 });
  });

  it("unlocks the next level once the one before is filled, keeping the one after locked", () => {
    const locks = levelLocks([
      node("root", null, null),
      node("a", "root", 1, true),
      node("c", "root", 2),
      node("d", "root", 3),
    ]);
    expect(locks.has("c")).toBe(false);
    expect(locks.get("d")).toEqual({ waitFor: 2, left: 1 });
  });

  it("counts a deleted question as done", () => {
    const locks = levelLocks([node("root", null, null), node("c", "root", 2)]);
    expect(locks.size).toBe(0);
  });

  it("keeps two templates apart, each by its own root", () => {
    const locks = levelLocks([
      node("r1", null, null),
      node("r2", null, null),
      node("a", "r1", 1),
      node("b", "r1", 2),
      node("c", "r2", 1, true),
      node("d", "r2", 2),
    ]);
    expect(locks.has("b")).toBe(true);
    expect(locks.has("d")).toBe(false);
  });

  it("follows nested template nodes up to the root the template was grown from", () => {
    const locks = levelLocks([
      node("root", null, null),
      node("way", "root", 2, true),
      node("plan", "way", 2, true),
      node("result", "plan", 3),
      node("sub", "root", 1),
    ]);
    expect(locks.get("result")).toEqual({ waitFor: 1, left: 1 });
  });

  it("never locks a node that has no level", () => {
    expect(levelLocks([node("root", null, null), node("x", "root", null)]).size).toBe(0);
  });
});

describe("hiddenLevelIds", () => {
  it("leaves every locked ghost off the canvas", () => {
    const nodes = [node("root", null, null), node("a", "root", 1), node("b", "root", 2), node("c", "b", 3)];
    expect([...hiddenLevelIds(nodes, levelLocks(nodes))].sort()).toEqual(["b", "c"]);
  });

  it("keeps a locked ghost on the canvas when something shown hangs from it", () => {
    const nodes = [node("root", null, null), node("a", "root", 1), node("b", "root", 2), node("mine", "b", null, true)];
    expect(hiddenLevelIds(nodes, levelLocks(nodes)).has("b")).toBe(false);
  });

  it("hides nothing once every earlier round is done", () => {
    const nodes = [node("root", null, null), node("a", "root", 1, true), node("b", "root", 2)];
    expect(hiddenLevelIds(nodes, levelLocks(nodes)).size).toBe(0);
  });
});

describe("revealedRound", () => {
  it("names the round that just opened and how many questions it brings", () => {
    const before = [node("root", null, null), node("a", "root", 1), node("b", "root", 2), node("c", "root", 2), node("d", "root", 3)];
    const after = before.map((n) => (n.nodeId === "a" ? { ...n, ghost: false, text: "done" } : n));
    const was = hiddenLevelIds(before, levelLocks(before));
    const now = hiddenLevelIds(after, levelLocks(after));
    expect(revealedRound(was, now, after)).toEqual({ level: 2, count: 2 });
  });

  it("is null when nothing new came up", () => {
    const nodes = [node("root", null, null), node("a", "root", 1), node("b", "root", 2)];
    const hidden = hiddenLevelIds(nodes, levelLocks(nodes));
    expect(revealedRound(hidden, hidden, nodes)).toBeNull();
    // A hidden ghost deleted isn't a new question.
    expect(revealedRound(hidden, new Set(), [node("root", null, null), node("a", "root", 1)])).toBeNull();
  });
});

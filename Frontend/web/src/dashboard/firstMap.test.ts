import { describe, expect, it } from "vitest";
import { firstTemplateMap, miniature, recentThoughts } from "./firstMap";
import type { MapDoc, NodeDoc } from "../types";

const map = (mapId: string, extra: Partial<MapDoc> = {}) => ({ mapId, name: mapId, ownerId: "me", ...extra }) as MapDoc;
const node = (nodeId: string, extra: Partial<NodeDoc> = {}) =>
  ({ nodeId, text: "", type: "Idea", parentId: null, userId: "me", health: 100, defeated: false, ...extra }) as NodeDoc;

describe("firstTemplateMap", () => {
  it("finds the one own map made from a template, leaving out the Inbox and shared maps", () => {
    const maps = [map("inbox", { kind: "idea" }), map("plain"), map("theirs", { kind: "goal", ownerId: "you" }), map("first", { kind: "problem" })];
    expect(firstTemplateMap(maps, "me", "inbox")?.mapId).toBe("first");
  });

  it("is null with none, or once there is a second one", () => {
    expect(firstTemplateMap([map("plain")], "me", null)).toBeNull();
    expect(firstTemplateMap([map("a", { kind: "goal" }), map("b", { kind: "retro" })], "me", null)).toBeNull();
  });
});

describe("recentThoughts", () => {
  it("lists written thoughts newest first, skipping ghosts, attacks, shields, packed nodes and picture dots", () => {
    const nodes = [
      node("old", { createdAt: "2026-11-01T10:00:00Z" }),
      node("ghost", { ghost: true, createdAt: "2026-11-09T10:00:00Z" }),
      node("new", { createdAt: "2026-11-10T10:00:00Z" }),
      node("attack", { isWeapon: true, createdAt: "2026-11-10T11:00:00Z" }),
      node("shield", { isProtection: true, createdAt: "2026-11-10T11:00:00Z" }),
      node("packed", { packedIntoNodeId: "old", createdAt: "2026-11-10T11:00:00Z" }),
      node("dot", { picture: { id: "p", kind: "heart", dot: 0 }, createdAt: "2026-11-10T11:00:00Z" }),
      node("mid", { createdAt: "2026-11-05T10:00:00Z" }),
    ];
    expect(recentThoughts(nodes).map((n) => n.nodeId)).toEqual(["new", "mid", "old"]);
    expect(recentThoughts(nodes, 1).map((n) => n.nodeId)).toEqual(["new"]);
  });

  it("falls back to the list's order when dates are missing", () => {
    expect(recentThoughts([node("a"), node("b")]).map((n) => n.nodeId)).toEqual(["b", "a"]);
  });
});

describe("miniature", () => {
  it("fits the nodes in the box and links each to its parent", () => {
    const mini = miniature(
      [node("root", { x: 1000, y: 1000 }), node("child", { x: 1400, y: 1200, parentId: "root" }), node("loose")],
      200,
      120,
      10,
    );
    expect(mini.nodes.map((n) => n.id)).toEqual(["root", "child"]);
    for (const n of mini.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(10);
      expect(n.x).toBeLessThanOrEqual(190);
      expect(n.y).toBeGreaterThanOrEqual(10);
      expect(n.y).toBeLessThanOrEqual(110);
    }
    expect(mini.links.map((l) => `${l.from.id}>${l.to.id}`)).toEqual(["root>child"]);
  });

  it("is empty with nothing placed", () => {
    expect(miniature([], 100, 100)).toEqual({ nodes: [], links: [] });
  });
});

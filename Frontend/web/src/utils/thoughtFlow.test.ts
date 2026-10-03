import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLOW_PROMPTS,
  ROOT_ID,
  buildMapFromDraft,
  isWithin,
  layoutThoughts,
  orderParentsFirst,
  removeThought,
  suggestMapName,
} from "./thoughtFlow";
import type { Thought } from "./thoughtFlow";
import { CANVAS_H, CANVAS_W } from "./canvasLayout";
import { MAP_KINDS } from "../types";

vi.mock("../api/maps", () => ({ createMap: vi.fn() }));
vi.mock("../api/nodes", () => ({ createNode: vi.fn() }));
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";

const th = (id: string, parentId = ROOT_ID, text = id): Thought => ({ id, text, type: "Option", parentId, prompt: "anythingElse" });

describe("FLOW_PROMPTS", () => {
  it("asks something for every map kind and always ends with the open question", () => {
    for (const kind of MAP_KINDS) {
      expect(FLOW_PROMPTS[kind].length).toBeGreaterThan(2);
      expect(FLOW_PROMPTS[kind][FLOW_PROMPTS[kind].length - 1].key).toBe("anythingElse");
    }
  });
});

describe("orderParentsFirst", () => {
  it("puts every parent before its children", () => {
    const ordered = orderParentsFirst([th("c", "b"), th("b", "a"), th("a")]);
    expect(ordered.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("hangs a thought whose parent is gone from the center", () => {
    const ordered = orderParentsFirst([th("a", "missing")]);
    expect(ordered).toHaveLength(1);
    expect(ordered[0].id).toBe("a");
  });

  it("still returns thoughts caught in a loop, hung from the center", () => {
    const ordered = orderParentsFirst([th("a", "b"), th("b", "a")]);
    expect(ordered.map((t) => t.parentId)).toEqual([ROOT_ID, ROOT_ID]);
  });
});

describe("removeThought", () => {
  it("moves a removed thought's children up to its parent", () => {
    const next = removeThought([th("a"), th("b", "a"), th("c", "b")], "b");
    expect(next.map((t) => t.id)).toEqual(["a", "c"]);
    expect(next.find((t) => t.id === "c")!.parentId).toBe("a");
  });
});

describe("isWithin", () => {
  it("is true for the thought itself and its descendants only", () => {
    const ts = [th("a"), th("b", "a"), th("c", "b"), th("d")];
    expect(isWithin("a", "a", ts)).toBe(true);
    expect(isWithin("c", "a", ts)).toBe(true);
    expect(isWithin("d", "a", ts)).toBe(false);
  });
});

describe("layoutThoughts", () => {
  it("places the root in the middle and every thought inside the canvas, apart from each other", () => {
    const ts = Array.from({ length: 12 }, (_, i) => th(`t${i}`, i > 3 ? `t${i % 4}` : ROOT_ID));
    const { root, positions } = layoutThoughts(ts);
    expect(root).toEqual({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
    expect(positions.size).toBe(12);
    const pts = [...positions.values()];
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(120);
      expect(p.x).toBeLessThanOrEqual(CANVAS_W - 120);
      expect(p.y).toBeGreaterThanOrEqual(120);
      expect(p.y).toBeLessThanOrEqual(CANVAS_H - 120);
    }
    const unique = new Set(pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    expect(unique.size).toBe(pts.length);
  });
});

describe("suggestMapName", () => {
  it("keeps a short first line as is", () => {
    expect(suggestMapName("  Change jobs?\nmore detail")).toBe("Change jobs?");
  });

  it("cuts a long line at a word", () => {
    const name = suggestMapName("I keep running out of time for the things that actually matter to me and my family");
    expect(name.length).toBeLessThanOrEqual(61);
    expect(name.endsWith("…")).toBe(true);
    expect(name).not.toMatch(/\s…$/);
  });
});

describe("buildMapFromDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the map, the root, then each thought pointing at its parent's real node id", async () => {
    vi.mocked(mapsApi.createMap).mockResolvedValue({ mapId: "m1", name: "x", ownerId: "u" });
    let n = 0;
    vi.mocked(nodesApi.createNode).mockImplementation(async () => ({ nodeId: `n${n++}` }) as never);
    const progress: number[] = [];

    await buildMapFromDraft(
      { kind: "goal", center: "Run a half marathon", step: 3, promptIndex: 0, thoughts: [th("b", "a"), th("a"), th("blank", ROOT_ID, "  ")] },
      { name: "", personal: true, ownerColor: "#000", color: "#111" },
      (done) => progress.push(done),
    );

    expect(mapsApi.createMap).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Run a half marathon", kind: "goal", discussionMode: false }),
    );
    const calls = vi.mocked(nodesApi.createNode).mock.calls.map((c) => c[1]);
    // Blank thoughts are skipped.
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ text: "Run a half marathon", type: "Solution" });
    expect(calls[1]).toMatchObject({ text: "a", parentId: "n0" });
    expect(calls[2]).toMatchObject({ text: "b", parentId: "n1" });
    expect(progress).toEqual([1, 2, 3]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { deletedLabel, useDeletedNodes } from "./useDeletedNodes";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({
  getNode: vi.fn(async (id: string) => ({ nodeId: id, text: `full ${id}` })),
  deleteManyNodes: vi.fn(async (ids: string[]) => ({ success: true, deleted: ids.map((deletedId) => ({ deletedId, damagedProtectedNode: null })) })),
  createNode: vi.fn(async (_m: string, input: object) => ({ nodeId: `back-${Math.random()}`, ...input })),
  updateNode: vi.fn(async (id: string, patch: object) => ({ nodeId: id, ...patch })),
}));
vi.mock("../api/edges", () => ({ createEdge: vi.fn() }));
import * as nodesApi from "../api/nodes";

function setup(nodes: NodeDoc[]) {
  const steps: { run: () => Promise<void> }[] = [];
  const params = {
    mapId: "m1",
    nodes,
    edges: [],
    isOwnNode: (n: NodeDoc) => n.userId === "u1",
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    upsertNode: vi.fn(),
    setCelebrateIds: vi.fn(),
    setActionError: vi.fn(),
    refreshInsights: vi.fn(),
    recordUndo: vi.fn((run: () => Promise<void>) => {
      const step = { run };
      steps.push(step);
      return step;
    }),
    forgetUndo: vi.fn((step: object) => {
      steps.splice(steps.indexOf(step as never), 1);
    }),
    failMessage: "failed",
  };
  const hook = renderHook(() => useDeletedNodes(params));
  return { ...hook, params, steps };
}

describe("useDeletedNodes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps each deletion in the list with its full text, and on the undo stack", async () => {
    const { result, steps } = setup([makeNode({ nodeId: "a", text: "" }), makeNode({ nodeId: "g", text: "", ghost: true, prompt: "Why?" })]);
    await act(async () => {
      await result.current.deleteNodes(["a", "g"]);
    });
    expect(nodesApi.getNode).toHaveBeenCalledTimes(1); // the ghost has nothing to fetch
    expect(result.current.deletedEntries).toHaveLength(1);
    expect(result.current.deletedEntries[0]).toMatchObject({ label: "full a", count: 2 });
    expect(steps).toHaveLength(1);
  });

  it("leaves out attacks, shields and other people's nodes", async () => {
    const { result } = setup([makeNode({ nodeId: "w", isWeapon: true }), makeNode({ nodeId: "t", userId: "u2" })]);
    await act(async () => {
      await result.current.deleteNodes(["w", "t"]);
    });
    expect(result.current.deletedEntries).toHaveLength(0);
  });

  it("puts one back from the list in any order, and takes its step off the undo stack", async () => {
    const { result, steps, params } = setup([makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })]);
    await act(async () => {
      await result.current.deleteNodes(["a"]);
    });
    await act(async () => {
      await result.current.deleteNodes(["b"]);
    });
    const older = result.current.deletedEntries[1];
    await act(async () => {
      await result.current.restoreEntry(older.id);
    });
    expect(nodesApi.createNode).toHaveBeenCalledWith("m1", expect.objectContaining({ text: "full a" }));
    expect(result.current.deletedEntries.map((e) => e.label)).toEqual(["full b"]);
    expect(steps).toHaveLength(1);
    expect(params.forgetUndo).toHaveBeenCalledTimes(1);
  });

  it("undo brings back the latest and empties it from the list", async () => {
    const { result, steps } = setup([makeNode({ nodeId: "a" })]);
    await act(async () => {
      await result.current.deleteNodes(["a"]);
    });
    await act(async () => {
      await steps[steps.length - 1].run();
    });
    expect(result.current.deletedEntries).toHaveLength(0);
    expect(nodesApi.createNode).toHaveBeenCalledTimes(1);
  });

  it("labels a deletion by its title, text or question, cut short", () => {
    expect(deletedLabel(makeNode({ nodeId: "x", title: "Title", text: "Text" }))).toBe("Title");
    expect(deletedLabel(makeNode({ nodeId: "x", text: "", prompt: "Why so?" }))).toBe("Why so?");
    expect(deletedLabel(makeNode({ nodeId: "x", text: "a".repeat(60) }))).toHaveLength(40);
  });
});

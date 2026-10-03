import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStructureGuard } from "./useStructureGuard";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({ updateNode: vi.fn() }));
import * as nodesApi from "../api/nodes";

function setup(nodes: NodeDoc[], canMoveNode = (n: NodeDoc) => n.userId === "u1") {
  const setNodes = vi.fn();
  const upsertNode = vi.fn();
  const setActionError = vi.fn();
  const { result } = renderHook(() =>
    useStructureGuard({ nodes, setNodes, upsertNode, canMoveNode, setActionError, moveError: "move failed" }),
  );
  return { keepStructure: result.current.keepStructure, setNodes, upsertNode, setActionError };
}

describe("useStructureGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves an own node the new one landed on and saves where it went", async () => {
    vi.mocked(nodesApi.updateNode).mockImplementation(async (id, u) => makeNode({ nodeId: id, ...(u as object) }));
    const old = makeNode({ nodeId: "old", x: 1010, y: 800 });
    const fresh = makeNode({ nodeId: "new", x: 1000, y: 800 });
    const { keepStructure, setNodes, upsertNode } = setup([old]);
    await keepStructure(new Map([["new", { x: 1000, y: 800 }]]), [fresh]);
    expect(nodesApi.updateNode).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nodesApi.updateNode).mock.calls[0][0]).toBe("old");
    expect(setNodes).toHaveBeenCalled();
    expect(upsertNode).toHaveBeenCalled();
  });

  it("leaves someone else's node alone", async () => {
    const theirs = makeNode({ nodeId: "theirs", userId: "u2", x: 1010, y: 800 });
    const fresh = makeNode({ nodeId: "new", x: 1000, y: 800 });
    const { keepStructure, setNodes } = setup([theirs]);
    await keepStructure(new Map([["new", { x: 1000, y: 800 }]]), [fresh]);
    expect(nodesApi.updateNode).not.toHaveBeenCalled();
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("puts a node back and says so when saving its new spot fails", async () => {
    vi.mocked(nodesApi.updateNode).mockRejectedValue(new Error("nope"));
    const old = makeNode({ nodeId: "old", x: 1010, y: 800 });
    const fresh = makeNode({ nodeId: "new", x: 1000, y: 800 });
    const { keepStructure, setNodes, setActionError } = setup([old]);
    await keepStructure(new Map([["new", { x: 1000, y: 800 }]]), [fresh]);
    expect(setNodes).toHaveBeenCalledTimes(2);
    expect(setActionError).toHaveBeenCalledWith("move failed");
  });
});

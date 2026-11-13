import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { SetStateAction } from "react";
import { useNodeStyling } from "./useNodeStyling";
import { makeNode } from "../test/fixtures";
import { TRANSLATIONS } from "../i18n/translations";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({ updateNode: vi.fn() }));
import * as nodesApi from "../api/nodes";

function setup(start: NodeDoc[]) {
  let nodes = start;
  const setNodes = vi.fn((next: SetStateAction<NodeDoc[]>) => {
    nodes = typeof next === "function" ? next(nodes) : next;
  });
  const upsertNode = vi.fn((node: NodeDoc) => {
    nodes = nodes.map((n) => (n.nodeId === node.nodeId ? node : n));
  });
  const setActionError = vi.fn();
  const hook = renderHook(() =>
    useNodeStyling({
      nodes,
      nodeGroups: [],
      isOwnNode: () => true,
      setNodes,
      upsertNode,
      setActionError,
      copyText: vi.fn(),
      deleteNodes: vi.fn(),
      t: TRANSLATIONS.en,
    }),
  );
  return { ...hook, nodes: () => nodes, upsertNode, setActionError };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("handleChangeNodeType", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the new type before the server answers", async () => {
    const save = deferred<NodeDoc>();
    vi.mocked(nodesApi.updateNode).mockReturnValueOnce(save.promise);
    const node = makeNode({ nodeId: "a", type: "Idea" });
    const { result, nodes } = setup([node]);
    let done!: Promise<void>;
    act(() => {
      done = result.current.handleChangeNodeType(node, "Problem");
    });
    expect(nodes()[0].type).toBe("Problem");
    await act(async () => {
      save.resolve({ ...node, type: "Problem" });
      await done;
    });
    expect(nodes()[0].type).toBe("Problem");
  });

  it("puts the type back if the save fails", async () => {
    vi.mocked(nodesApi.updateNode).mockRejectedValueOnce(new Error("down"));
    const node = makeNode({ nodeId: "a", type: "Idea" });
    const { result, nodes, setActionError } = setup([node]);
    await act(async () => {
      await result.current.handleChangeNodeType(node, "Problem");
    });
    expect(nodes()[0].type).toBe("Idea");
    expect(setActionError).toHaveBeenLastCalledWith(TRANSLATIONS.en.ui.errors.type);
  });

  it("keeps a quick second pick when the first one's answer comes late", async () => {
    const first = deferred<NodeDoc>();
    const second = deferred<NodeDoc>();
    vi.mocked(nodesApi.updateNode).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const node = makeNode({ nodeId: "a", type: "Idea" });
    const { result, nodes } = setup([node]);
    let a!: Promise<void>;
    let b!: Promise<void>;
    act(() => {
      a = result.current.handleChangeNodeType(node, "Problem");
    });
    act(() => {
      b = result.current.handleChangeNodeType(node, "Solution");
    });
    await act(async () => {
      second.resolve({ ...node, type: "Solution" });
      await b;
      first.resolve({ ...node, type: "Problem" });
      await a;
    });
    expect(nodes()[0].type).toBe("Solution");
  });
});

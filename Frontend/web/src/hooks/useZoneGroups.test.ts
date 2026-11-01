import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useZoneGroups } from "./useZoneGroups";
import type { NodeDoc } from "../types";

const node = (nodeId: string, type: NodeDoc["type"], parentId: string | null = null): NodeDoc => ({
  nodeId,
  text: nodeId,
  type,
  parentId,
  userId: "u1",
  health: 100,
  defeated: false,
});

const nodes = [node("root", "unknown"), node("c1", "Success", "root"), node("c2", "Option", "root")];
const positions = new Map([
  ["root", { x: 0, y: 0 }],
  ["c1", { x: 100, y: 0 }],
  ["c2", { x: -100, y: 0 }],
]);

describe("useZoneGroups", () => {
  it("finds the zone and the sentiment of its members and its parent", () => {
    const { result } = renderHook(() =>
      useZoneGroups({ visibleNodes: nodes, nodes, positions, zoneLayouts: {}, selectedCircleRootId: undefined, centerOnPoint: vi.fn() }),
    );
    expect(result.current.nodeGroups.map((g) => g.rootId)).toEqual(["root"]);
    expect(result.current.groupSentimentByNode.get("c1")).toBe("positive");
    expect([...result.current.circleRootSentimentByNode.keys()]).toEqual(["root"]);
    expect(result.current.holds.map((h) => h.name)).toEqual(["root"]);
  });

  it("centers on a circle once it is chosen, and only when the choice changes", () => {
    const centerOnPoint = vi.fn();
    const { rerender } = renderHook(({ rootId }) =>
      useZoneGroups({ visibleNodes: nodes, nodes, positions, zoneLayouts: {}, selectedCircleRootId: rootId, centerOnPoint }),
      { initialProps: { rootId: undefined as string | undefined } },
    );
    expect(centerOnPoint).not.toHaveBeenCalled();
    rerender({ rootId: "root" });
    expect(centerOnPoint).toHaveBeenCalledTimes(1);
    rerender({ rootId: "root" });
    expect(centerOnPoint).toHaveBeenCalledTimes(1);
  });
});

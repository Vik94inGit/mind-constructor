import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useZoneFocus } from "./useZoneFocus";
import { makeNode } from "../test/fixtures";
import type { NodeGroup } from "../utils/canvasLayout";

function group(rootId: string, cx: number, memberIds: string[]): NodeGroup {
  return {
    rootId,
    members: memberIds.map((nodeId) => makeNode({ nodeId })),
    sentiment: "neutral",
    cx,
    cy: 100,
    r: 50,
    outline: [],
  };
}

// A 400x400 viewport scrolled to the top-left: its middle is canvas (200, 200)
// at zoom 1 with no margins, so a zone at x=200 is in focus and one far off
// at x=5000 isn't.
function wrapAt() {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: 400 });
  Object.defineProperty(el, "clientHeight", { value: 400 });
  return { current: el };
}

const groups = [group("near", 200, ["a", "shared"]), group("far", 5000, ["b", "shared"])];

describe("useZoneFocus", () => {
  it("mutes members of out-of-focus zones only, keeping shared members lit", () => {
    const { result } = renderHook(() =>
      useZoneFocus({
        wrapRef: wrapAt(),
        loading: false,
        nodeGroups: groups,
        zoom: 1,
        hScrollMargin: 0,
        vScrollMargin: 0,
        hasSelectedCircle: false,
      }),
    );
    expect(result.current.activeFocusedZones).toEqual(new Set(["near"]));
    expect(result.current.zoneMutedIds).toEqual(new Set(["b"]));
  });

  it("is off while a circle is stabilized", () => {
    const { result } = renderHook(() =>
      useZoneFocus({
        wrapRef: wrapAt(),
        loading: false,
        nodeGroups: groups,
        zoom: 1,
        hScrollMargin: 0,
        vScrollMargin: 0,
        hasSelectedCircle: true,
      }),
    );
    expect(result.current.activeFocusedZones).toBeNull();
    expect(result.current.zoneMutedIds.size).toBe(0);
  });
});

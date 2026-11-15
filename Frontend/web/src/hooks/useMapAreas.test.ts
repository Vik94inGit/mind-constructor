import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as mapsApi from "../api/maps";
import { useMapAreas } from "./useMapAreas";
import { shownAreaOf } from "../utils/mapAreas";
import type { MapDoc, NodeDoc } from "../types";

vi.mock("../api/maps");

function setup(map: Partial<MapDoc>, nodes: Partial<NodeDoc>[] = []) {
  let current = { mapId: "m1", ...map } as MapDoc;
  const setMap = vi.fn((v: MapDoc | null | ((p: MapDoc | null) => MapDoc | null)) => {
    current = (typeof v === "function" ? v(current) : v) as MapDoc;
  });
  const onSwitched = vi.fn();
  const onExtended = vi.fn();
  const hook = renderHook(
    ({ m }) =>
      useMapAreas({
        mapId: "m1",
        map: m,
        setMap,
        nodes: nodes as NodeDoc[],
        setActionError: vi.fn(),
        errorMessage: "err",
        onSwitched,
        onExtended,
      }),
    { initialProps: { m: current } },
  );
  return { ...hook, setMap, onSwitched, onExtended, rerenderWithMap: () => hook.rerender({ m: current }) };
}

describe("useMapAreas", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts on the main area of a map with one", () => {
    const { result } = setup({});
    expect(result.current.area).toBe(0);
    expect(result.current.count).toBe(1);
    expect(result.current.canExtend).toBe(true);
  });

  it("switches area, remembers it for new nodes and in this browser", () => {
    const { result, onSwitched } = setup({ areaCount: 3 }, [{ area: 2 }]);
    act(() => result.current.switchArea(2));
    expect(result.current.area).toBe(2);
    expect(shownAreaOf("m1")).toBe(2);
    expect(localStorage.getItem("mc.mapArea.m1")).toBe("2");
    expect(onSwitched).toHaveBeenCalledWith(2);
    expect(result.current.perArea).toEqual([0, 0, 1]);
  });

  it("extends the map by one area and shows it", async () => {
    vi.mocked(mapsApi.updateMap).mockResolvedValue({ mapId: "m1", areaCount: 2 } as MapDoc);
    const { result, rerenderWithMap, onExtended } = setup({ areaCount: 1 });
    await act(async () => {
      await result.current.extend();
    });
    rerenderWithMap();
    expect(mapsApi.updateMap).toHaveBeenCalledWith("m1", { areaCount: 2 });
    expect(result.current.count).toBe(2);
    expect(result.current.area).toBe(1);
    expect(onExtended).toHaveBeenCalled();
  });

  it("doesn't extend past five areas", async () => {
    const { result } = setup({ areaCount: 5 });
    await act(async () => {
      await result.current.extend();
    });
    expect(mapsApi.updateMap).not.toHaveBeenCalled();
    expect(result.current.canExtend).toBe(false);
  });
});

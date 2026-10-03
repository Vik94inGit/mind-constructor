import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChosenCircle } from "./useChosenCircle";
import { TRANSLATIONS } from "../i18n/translations";
import type { MapDoc } from "../types";

vi.mock("../api/maps", () => ({ selectCircle: vi.fn(), deselectCircle: vi.fn() }));
import * as mapsApi from "../api/maps";

function setup(selectedCircle?: { rootId: string; nodeIds: string[] }) {
  const params = {
    mapId: "m1",
    map: { selectedCircle } as unknown as MapDoc,
    applyCircleSelection: vi.fn(),
    setActionError: vi.fn(),
    t: TRANSLATIONS.en,
  };
  const { result } = renderHook(() => useChosenCircle(params));
  return { result, params };
}

describe("useChosenCircle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chooses a zone and keeps its spinner until the members' text loads", async () => {
    const chosen = { rootId: "r", nodeIds: ["r", "a"] };
    vi.mocked(mapsApi.selectCircle).mockResolvedValue(chosen as never);
    const { result, params } = setup();
    await act(() => result.current.handleCircleBackdropClick("r"));
    expect(params.applyCircleSelection).toHaveBeenCalledWith(chosen);
    expect(result.current.circleLoadingRootId).toBe("r");
  });

  it("clicking the chosen zone again releases it", async () => {
    vi.mocked(mapsApi.deselectCircle).mockResolvedValue(undefined as never);
    const { result, params } = setup({ rootId: "r", nodeIds: ["r", "a"] });
    await act(() => result.current.handleCircleBackdropClick("r"));
    expect(mapsApi.selectCircle).not.toHaveBeenCalled();
    expect(params.applyCircleSelection).toHaveBeenCalledWith(null);
  });

  it("releases on a click outside the circle only", async () => {
    vi.mocked(mapsApi.deselectCircle).mockResolvedValue(undefined as never);
    const { result } = setup({ rootId: "r", nodeIds: ["r", "a"] });
    act(() => result.current.releaseChosenCircleIfOutside("a"));
    expect(mapsApi.deselectCircle).not.toHaveBeenCalled();
    await act(async () => result.current.releaseChosenCircleIfOutside("elsewhere"));
    expect(mapsApi.deselectCircle).toHaveBeenCalledWith("m1");
  });
});

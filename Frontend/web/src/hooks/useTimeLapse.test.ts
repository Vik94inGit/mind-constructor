import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { SetStateAction } from "react";
import { useTimeLapse } from "./useTimeLapse";
import type { TimeLapse } from "./useTimeLapse";
import { makeNode } from "../test/fixtures";

vi.mock("../api/maps", () => ({ listMapAttacks: vi.fn(async () => []) }));
import * as mapsApi from "../api/maps";

function setup(timeLapse: TimeLapse | null, discussionOn = false) {
  let state = timeLapse;
  const setTimeLapse = vi.fn((next: SetStateAction<TimeLapse | null>) => {
    state = typeof next === "function" ? next(state) : next;
  });
  const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
  const params = {
    mapId: "m1",
    timeLapse,
    setTimeLapse,
    timeLapseNodes: nodes,
    timeLapseStep: timeLapse ? Math.min(timeLapse.step, nodes.length) : null,
    discussionOn,
    setReplayAttacks: vi.fn(),
    positions: new Map([
      ["a", { x: 1, y: 2 }],
      ["b", { x: 3, y: 4 }],
    ]),
    zoom: 0.5,
    zoomFromCenter: vi.fn(),
    centerOnPoint: vi.fn(),
    showPoints: vi.fn(),
    onStart: vi.fn(),
  };
  const { result } = renderHook(() => useTimeLapse(params));
  return { result, params, state: () => state };
}

describe("useTimeLapse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts from nothing, at 100%, fetching the fight in a discussion", () => {
    const { result, params, state } = setup(null, true);
    act(() => result.current.startTimeLapse());
    expect(params.onStart).toHaveBeenCalled();
    expect(state()).toEqual({ step: 0, playing: true });
    expect(mapsApi.listMapAttacks).toHaveBeenCalledWith("m1");
    expect(params.zoomFromCenter).toHaveBeenCalledWith(0, 1);
  });

  it("play at the end starts over; the arrows step it within its bounds and pause it", () => {
    const end = setup({ step: 2, playing: false });
    act(() => end.result.current.togglePlay());
    expect(end.state()).toEqual({ step: 0, playing: true });
    act(() => end.result.current.stepTimeLapse(1));
    expect(end.state()).toEqual({ step: 2, playing: false });
    const start = setup({ step: 0, playing: true });
    act(() => start.result.current.stepTimeLapse(-1));
    expect(start.state()).toEqual({ step: 0, playing: false });
  });

  it("follows the newest node, and shows the whole map at the end", () => {
    expect(setup({ step: 1, playing: true }).params.centerOnPoint).toHaveBeenCalledWith(1, 2, { aboveSheet: false });
    expect(setup({ step: 2, playing: true }).params.showPoints).toHaveBeenCalled();
  });
});

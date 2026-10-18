import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const socket = { on: vi.fn(), off: vi.fn(), io: { on: vi.fn(), off: vi.fn() } };
const joinMap = vi.fn();
vi.mock("../api/socket", () => ({ getSocket: () => socket, joinMap: (...a: unknown[]) => joinMap(...a), leaveMap: vi.fn() }));

import { CATCH_UP_MS, useMapSocket } from "./useMapSocket";

function setup() {
  const onCatchUp = vi.fn();
  const noop = vi.fn();
  renderHook(() =>
    useMapSocket({
      mapId: "m1",
      loading: false,
      setNodes: noop,
      setEdges: noop,
      setLines: noop,
      setMap: noop,
      setSelectedId: noop,
      setCelebrateIds: noop,
      upsertNode: noop,
      upsertEdge: noop,
      upsertLine: noop,
      applyCircleSelection: noop,
      refreshInsights: noop,
      onVisibilityChanged: noop,
      onCatchUp,
    }),
  );
  return { onCatchUp };
}

describe("useMapSocket catch-up", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    joinMap.mockReset();
    socket.on.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("fetches the map and retries the join while the live room is not joined", () => {
    joinMap.mockImplementation((_id: string, onJoined: (ok: boolean) => void) => onJoined(false));
    const { onCatchUp } = setup();
    vi.advanceTimersByTime(CATCH_UP_MS);
    expect(onCatchUp).toHaveBeenCalledTimes(1);
    expect(joinMap).toHaveBeenCalledTimes(2);
  });

  it("stays quiet once joined, until the connection drops", () => {
    joinMap.mockImplementation((_id: string, onJoined: (ok: boolean) => void) => onJoined(true));
    const { onCatchUp } = setup();
    vi.advanceTimersByTime(CATCH_UP_MS * 3);
    expect(onCatchUp).not.toHaveBeenCalled();

    joinMap.mockImplementation((_id: string, onJoined: (ok: boolean) => void) => onJoined(false));
    const onDisconnect = socket.on.mock.calls.find(([event]) => event === "disconnect")![1];
    onDisconnect();
    vi.advanceTimersByTime(CATCH_UP_MS);
    expect(onCatchUp).toHaveBeenCalledTimes(1);
  });

  it("catches up when the tab is shown again", () => {
    joinMap.mockImplementation((_id: string, onJoined: (ok: boolean) => void) => onJoined(true));
    const { onCatchUp } = setup();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onCatchUp).toHaveBeenCalledTimes(1);
  });
});

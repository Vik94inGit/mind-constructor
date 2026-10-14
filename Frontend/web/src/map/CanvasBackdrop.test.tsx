import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { CanvasBackdrop, ZONE_HOLD_MS } from "./CanvasBackdrop";
import { I18nProvider } from "../i18n/I18nContext";
import type { NodeGroup } from "../utils/canvasLayout";

const group: NodeGroup = {
  rootId: "root",
  members: [],
  sentiment: "positive",
  cx: 50,
  cy: 50,
  r: 40,
  outline: [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 50, y: 90 },
  ],
};

function renderBackdrop(overrides: Partial<React.ComponentProps<typeof CanvasBackdrop>> = {}) {
  const props = {
    nodeGroups: [group],
    selectedCircle: null,
    visibleNodes: [],
    edges: [],
    posFor: () => ({ x: 0, y: 0 }),
    circleRootSentimentByNode: new Map(),
    linkCycles: [],
    chosenNodeIds: null,
    pendingLink: null,
    onCircleClick: vi.fn(),
    lines: [],
    canDeleteLine: () => false,
    onLineClick: vi.fn(),
    interactive: true,
    drawing: null,
    onZoneMenu: vi.fn(),
    canStyleZone: () => true,
    ...overrides,
  };
  const { container } = render(
    <I18nProvider>
      <CanvasBackdrop {...props} />
    </I18nProvider>,
  );
  return { props, zone: container.querySelector("polygon")! };
}

// jsdom has no PointerEvent, so fireEvent.pointerDown would drop clientX and
// pointerType — a MouseEvent carrying pointerType stands in for it.
if (!("PointerEvent" in window)) {
  class PointerEventShim extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim;
}

describe("CanvasBackdrop zone menu", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens a zone's menu on right-click, any zone you may style, named or not", () => {
    const { props, zone } = renderBackdrop();
    fireEvent.contextMenu(zone, { clientX: 30, clientY: 40 });
    expect(props.onZoneMenu).toHaveBeenCalledWith("root", 30, 40);
  });

  it("leaves right-click to the canvas on a zone you may not style", () => {
    const { props, zone } = renderBackdrop({ canStyleZone: () => false });
    fireEvent.contextMenu(zone, { clientX: 30, clientY: 40 });
    expect(props.onZoneMenu).not.toHaveBeenCalled();
  });

  it("opens it on a long press, and the lift doesn't also stabilize the zone", () => {
    const { props, zone } = renderBackdrop();
    fireEvent.pointerDown(zone, { pointerType: "touch", clientX: 20, clientY: 25 });
    act(() => vi.advanceTimersByTime(ZONE_HOLD_MS));
    expect(props.onZoneMenu).toHaveBeenCalledWith("root", 20, 25);
    fireEvent.pointerUp(zone, { pointerType: "touch" });
    fireEvent.click(zone);
    expect(props.onCircleClick).not.toHaveBeenCalled();
  });

  it("a short tap still stabilizes the zone", () => {
    const { props, zone } = renderBackdrop();
    fireEvent.pointerDown(zone, { pointerType: "touch", clientX: 20, clientY: 25 });
    act(() => vi.advanceTimersByTime(ZONE_HOLD_MS / 2));
    fireEvent.pointerUp(zone, { pointerType: "touch" });
    fireEvent.click(zone);
    act(() => vi.advanceTimersByTime(ZONE_HOLD_MS));
    expect(props.onZoneMenu).not.toHaveBeenCalled();
    expect(props.onCircleClick).toHaveBeenCalledWith("root");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PictureCropDialog } from "./PictureCropDialog";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const bg = TRANSLATIONS.en.ui.mapBackground;

// jsdom has no PointerEvent, so fireEvent's pointer events would lose their coordinates.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  URL.createObjectURL = vi.fn(() => "blob:picture");
  URL.revokeObjectURL = vi.fn();
  // The picture is drawn 200 × 100 px, its top-left at the window's corner.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}),
  } as DOMRect);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderDialog() {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <I18nProvider>
      <PictureCropDialog file={new Blob(["x"], { type: "image/png" })} onDone={onDone} onCancel={onCancel} />
    </I18nProvider>,
  );
  return { onDone, onCancel };
}

function drag(el: Element, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

describe("PictureCropDialog", () => {
  it("keeps the whole picture unless the frame is changed", async () => {
    const { onDone } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: bg.cropUse }));
    expect(onDone).toHaveBeenCalledWith({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("resizes the frame by a corner, then moves it", async () => {
    const { onDone } = renderDialog();
    // Bottom-right corner 100 px left and 50 px up: half the picture each way.
    drag(screen.getByTestId("crop-se"), [200, 100], [100, 50]);
    // Then the frame itself 50 px right and 25 px down.
    drag(screen.getByTestId("crop-frame"), [50, 25], [100, 50]);
    await userEvent.click(screen.getByRole("button", { name: bg.cropUse }));
    const r = onDone.mock.calls[0][0];
    expect(r.x).toBeCloseTo(0.25);
    expect(r.y).toBeCloseTo(0.25);
    expect(r.w).toBeCloseTo(0.5);
    expect(r.h).toBeCloseTo(0.5);
  });

  it("goes back to the whole picture, and cancels on Escape", async () => {
    const { onDone, onCancel } = renderDialog();
    drag(screen.getByTestId("crop-nw"), [0, 0], [60, 30]);
    await userEvent.click(screen.getByRole("button", { name: bg.cropWhole }));
    await userEvent.click(screen.getByRole("button", { name: bg.cropUse }));
    expect(onDone).toHaveBeenCalledWith({ x: 0, y: 0, w: 1, h: 1 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMapKeyboard } from "./useMapKeyboard";

function setup(overrides: Partial<Parameters<typeof useMapKeyboard>[0]> = {}) {
  const params = {
    presenting: false,
    exitPresentation: vi.fn(),
    setSlideIndex: vi.fn(),
    slideCount: 3,
    drawMode: false,
    drawPointCount: 0,
    undoDrawPoint: vi.fn(),
    finishLine: vi.fn(),
    clearDrawPoints: vi.fn(),
    exitDrawMode: vi.fn(),
    chooseMode: false,
    hasGroupSelection: false,
    exitChooseMode: vi.fn(),
    copySelection: vi.fn(),
    pasteClipboard: vi.fn(),
    ...overrides,
  };
  renderHook(() => useMapKeyboard(params));
  return params;
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

describe("useMapKeyboard", () => {
  it("copies and pastes with Ctrl+C / Ctrl+V", () => {
    const p = setup();
    press("c", { ctrlKey: true });
    press("V", { metaKey: true });
    expect(p.copySelection).toHaveBeenCalledTimes(1);
    expect(p.pasteClipboard).toHaveBeenCalledTimes(1);
  });

  it("leaves keys typed into a text field alone", () => {
    const p = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("c", { ctrlKey: true }, input);
    expect(p.copySelection).not.toHaveBeenCalled();
    input.remove();
  });

  it("steps slides and exits while presenting, and nothing else", () => {
    const p = setup({ presenting: true, hasGroupSelection: true });
    press("ArrowRight");
    press("ArrowLeft");
    press("Escape");
    press("c", { ctrlKey: true });
    expect(p.setSlideIndex).toHaveBeenCalledTimes(2);
    const next = vi.mocked(p.setSlideIndex).mock.calls[0][0] as (i: number) => number;
    expect(next(2)).toBe(2);
    expect(p.exitPresentation).toHaveBeenCalledTimes(1);
    expect(p.exitChooseMode).not.toHaveBeenCalled();
    expect(p.copySelection).not.toHaveBeenCalled();
  });

  it("drives line drawing", () => {
    const p = setup({ drawMode: true, drawPointCount: 2 });
    press("Enter");
    press("Backspace");
    press("z", { ctrlKey: true });
    press("Escape");
    expect(p.finishLine).toHaveBeenCalledTimes(1);
    expect(p.undoDrawPoint).toHaveBeenCalledTimes(2);
    expect(p.clearDrawPoints).toHaveBeenCalledTimes(1);
    expect(p.exitDrawMode).not.toHaveBeenCalled();
  });

  it("leaves drawing on Escape once no point is placed", () => {
    const p = setup({ drawMode: true, drawPointCount: 0 });
    press("Escape");
    expect(p.exitDrawMode).toHaveBeenCalledTimes(1);
  });

  it("finishes a choice on Enter", () => {
    const p = setup({ chooseMode: true });
    press("Enter");
    expect(p.exitChooseMode).toHaveBeenCalledTimes(1);
  });
});

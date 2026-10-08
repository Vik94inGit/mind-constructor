import { afterEach, describe, expect, it, vi } from "vitest";
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
    onImagePasteWithoutNode: vi.fn(),
    ...overrides,
  };
  renderHook(() => useMapKeyboard(params));
  return params;
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

// jsdom has no ClipboardEvent/DataTransfer — a plain event carrying a stub is enough.
function pasteEvent(files: { type: string }[] = []) {
  const e = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  e.clipboardData = {
    items: files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })),
    files: [],
  };
  return e;
}

describe("useMapKeyboard", () => {
  afterEach(() => vi.useRealTimers());

  it("copies with Ctrl+C, and pastes copied nodes from the paste event Ctrl+V lets through", () => {
    const p = setup();
    press("c", { ctrlKey: true });
    expect(p.copySelection).toHaveBeenCalledTimes(1);
    const key = new KeyboardEvent("keydown", { key: "V", metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(key);
    // The key press isn't cancelled — otherwise the browser never fires paste.
    expect(key.defaultPrevented).toBe(false);
    window.dispatchEvent(pasteEvent());
    expect(p.pasteClipboard).toHaveBeenCalledTimes(1);
  });

  it("still pastes nodes when a browser fires no paste event", () => {
    vi.useFakeTimers();
    const p = setup();
    press("v", { ctrlKey: true });
    vi.advanceTimersByTime(200);
    expect(p.pasteClipboard).toHaveBeenCalledTimes(1);
  });

  it("doesn't paste nodes for a pasted picture — it belongs to an open node", () => {
    const p = setup();
    window.dispatchEvent(pasteEvent([{ type: "image/png" }]));
    expect(p.pasteClipboard).not.toHaveBeenCalled();
    expect(p.onImagePasteWithoutNode).toHaveBeenCalledTimes(1);
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

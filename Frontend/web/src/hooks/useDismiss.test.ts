import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDismiss } from "./useDismiss";

function setup() {
  const menu = document.createElement("div");
  const button = document.createElement("button");
  const outside = document.createElement("div");
  document.body.append(menu, button, outside);
  return { menu, button, outside };
}

const press = (el: Element) => el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));

describe("useDismiss", () => {
  it("closes on a press outside or Escape, not on a press inside", () => {
    const { menu, outside } = setup();
    const onDismiss = vi.fn();
    renderHook(() => useDismiss({ current: menu }, onDismiss));
    press(menu);
    key("Enter");
    expect(onDismiss).not.toHaveBeenCalled();
    press(outside);
    key("Escape");
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("counts every listed element as inside", () => {
    const { menu, button, outside } = setup();
    const onDismiss = vi.fn();
    renderHook(() => useDismiss([{ current: menu }, { current: button }], onDismiss));
    press(button);
    expect(onDismiss).not.toHaveBeenCalled();
    press(outside);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const { menu, outside } = setup();
    const onDismiss = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useDismiss({ current: menu }, onDismiss, { enabled }), {
      initialProps: { enabled: false },
    });
    press(outside);
    key("Escape");
    expect(onDismiss).not.toHaveBeenCalled();
    rerender({ enabled: true });
    press(outside);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("lets Escape do something else, and always calls the newest callbacks", () => {
    const { menu, outside } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const onEscape = vi.fn();
    const { rerender } = renderHook(({ cb }) => useDismiss({ current: menu }, cb, { onEscape }), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    key("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
    press(outside);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

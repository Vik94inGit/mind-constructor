import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StickerCard } from "./StickerCard";

describe("StickerCard", () => {
  it("renders its content inside the card, in its shape and text size", () => {
    render(
      <StickerCard color="red" shape="round" fontSize={18} minWidth={96} maxWidth={240}>
        <span>hello</span>
      </StickerCard>,
    );
    const card = screen.getByText("hello").closest("[data-puzzle-card]") as HTMLElement;
    expect(card.dataset.cardShape).toBe("round");
    expect(card.style.fontSize).toBe("18px");
  });

  it("keeps its own size when it has one", () => {
    render(
      <StickerCard color="red" width={300} height={150} minWidth={96} maxWidth={240}>
        <span>hi</span>
      </StickerCard>,
    );
    const card = screen.getByText("hi").closest("[data-puzzle-card]") as HTMLElement;
    expect(card.style.width).toBe("300px");
    expect(card.style.height).toBe("150px");
  });

  it("resizes from its grip, twice the pointer's travel at the screen's scale", () => {
    const onResize = vi.fn();
    render(
      <StickerCard color="red" width={200} height={100} screenScale={2} onResize={onResize} resizeHint="Resize" minWidth={96} maxWidth={240}>
        <span>x</span>
      </StickerCard>,
    );
    const card = screen.getByText("x").closest("[data-puzzle-card]") as HTMLElement;
    Object.defineProperty(card, "offsetWidth", { value: 200 });
    Object.defineProperty(card, "offsetHeight", { value: 100 });
    const grip = screen.getByRole("button", { name: "Resize" });
    fireEvent(grip, new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    // jsdom has no PointerEvent: a MouseEvent carries the coordinates.
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 60, clientY: 30 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(onResize).toHaveBeenCalledWith({ w: 250, h: 120 });
  });

  it("has no grip on a locked card or one that isn't the viewer's", () => {
    render(
      <StickerCard color="red" locked onResize={vi.fn()} resizeHint="Resize" minWidth={96} maxWidth={240}>
        <span>x</span>
      </StickerCard>,
    );
    expect(screen.queryByRole("button", { name: "Resize" })).toBeNull();
  });
});

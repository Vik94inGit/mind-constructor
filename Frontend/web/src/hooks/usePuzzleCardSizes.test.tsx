import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { usePuzzleCardSizes } from "./usePuzzleCardSizes";

// A card whose measured box flips on every measurement — the shape of a
// layout whose sizes and joins feed each other and never settle.
function Harness({ onRender, flip }: { onRender: () => void; flip: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  onRender();
  const sizes = usePuzzleCardSizes(ref, "same");
  return (
    <div ref={ref}>
      <div data-reveal-node="a">
        <div data-puzzle-card data-flip={flip} />
      </div>
      <output>{sizes.get("a")?.w ?? 0}</output>
    </div>
  );
}

describe("usePuzzleCardSizes", () => {
  it("holds a layout whose measurements keep flipping instead of looping forever", () => {
    let calls = 0;
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.hasAttribute("data-puzzle-card")) {
        const w = calls++ % 2 === 0 ? 200 : 215;
        return { x: 0, y: 0, left: 0, top: 0, right: w, bottom: 90, width: w, height: 90, toJSON() {} } as DOMRect;
      }
      return original.call(this);
    };
    let renders = 0;
    try {
      render(<Harness onRender={() => renders++} flip />);
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
    // Without the guard this throws "Maximum update depth exceeded".
    expect(renders).toBeLessThan(15);
  });

  it("still follows a card that changes size once and settles", () => {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.hasAttribute("data-puzzle-card")) {
        return { x: 0, y: 0, left: 0, top: 0, right: 230, bottom: 90, width: 230, height: 90, toJSON() {} } as DOMRect;
      }
      return original.call(this);
    };
    try {
      const { container } = render(<Harness onRender={() => {}} flip={false} />);
      expect(container.querySelector("output")?.textContent).toBe("230");
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
});

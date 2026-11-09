import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MathText } from "./MathText";

describe("MathText", () => {
  it("shows text without a formula as it is", () => {
    const { container } = render(<MathText text="It costs $5 and $10" />);
    expect(container.textContent).toBe("It costs $5 and $10");
    expect(container.querySelector("[data-math]")).toBeNull();
  });

  it("draws a pasted formula with KaTeX, keeping the words around it", async () => {
    const { container } = render(<MathText text="Area \(\pi r^2\) of a circle" />);
    await waitFor(() => expect(container.querySelector('[data-math="inline"] .katex')).not.toBeNull());
    expect(container.textContent).toContain("Area ");
    expect(container.textContent).toContain(" of a circle");
  });

  it("shows a broken formula's source instead of failing", async () => {
    const { container } = render(<MathText text="$$\frac{1}{$$" />);
    await waitFor(() => expect(container.querySelector('[data-math="display"]')).not.toBeNull());
    expect(screen.getByText(/frac/)).toBeTruthy();
  });
});

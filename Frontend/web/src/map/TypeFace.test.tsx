import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypeFace } from "./TypeFace";

describe("TypeFace", () => {
  it("shows the type's emoji in emoji first", () => {
    render(<TypeFace type="Solution" size={15} emojiFirst typeEmoji={{ Solution: "🌟" }} />);
    expect(screen.getByText("🌟")).toBeInTheDocument();
  });

  it("shows the symbol in symbols first, or for a type kept on its symbol", () => {
    const { container, rerender } = render(<TypeFace type="Solution" size={15} emojiFirst={false} typeEmoji={{}} />);
    expect(container.textContent).not.toContain("💡");
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(<TypeFace type="Solution" size={15} emojiFirst typeEmoji={{ Solution: "symbol" }} />);
    expect(container.textContent).not.toContain("💡");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

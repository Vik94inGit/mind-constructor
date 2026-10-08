import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NodeFlipIcon } from "./NodeFlipIcon";
import { isValidEmoji } from "../utils/emojiFace";

function faces() {
  const card = screen.getByTestId("node-flip-icon").firstElementChild as HTMLElement;
  const [front, back] = Array.from(card.children) as HTMLElement[];
  return { card, front, back };
}

describe("NodeFlipIcon", () => {
  it("puts the type face up by default, the emoji on the back", () => {
    render(<NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst={false} flipped={false} />);
    const { front, back, card } = faces();
    expect(front.textContent).toBe("TYPE");
    expect(back.textContent).toBe("🔥");
    expect(card.className).toContain("group-hover:[transform:rotateY(180deg)]");
  });

  it("puts the emoji face up in emoji-first mode, and turns over while selected", () => {
    render(<NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst flipped />);
    const { front, back, card } = faces();
    expect(front.textContent).toBe("🔥");
    expect(back.textContent).toBe("TYPE");
    expect(card.className).toContain("[transform:rotateY(180deg)]");
    expect(card.className).not.toContain("group-hover:");
  });
});

describe("isValidEmoji", () => {
  it("accepts emoji and empty, refuses text", () => {
    expect(isValidEmoji("")).toBe(true);
    expect(isValidEmoji("👩‍💻")).toBe(true);
    expect(isValidEmoji("❤️")).toBe(true);
    expect(isValidEmoji("ok")).toBe(false);
    expect(isValidEmoji("Ж")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FLIP_HOLD_MS, NodeFlipIcon } from "./NodeFlipIcon";
import { isValidEmoji } from "../utils/emojiFace";

function faces() {
  const root = screen.getByTestId("node-flip-icon");
  const card = root.firstElementChild as HTMLElement;
  const [front, back] = Array.from(card.children) as HTMLElement[];
  return { root, card, front, back };
}

describe("NodeFlipIcon", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("puts the type face up by default, the emoji on the back", () => {
    render(<NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst={false} selected={false} />);
    const { front, back, root } = faces();
    expect(front.textContent).toBe("TYPE");
    expect(back.textContent).toBe("🔥");
    expect(root.dataset.flipped).toBe("false");
  });

  it("puts the emoji face up in emoji-first mode", () => {
    render(<NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst selected={false} />);
    const { front, back } = faces();
    expect(front.textContent).toBe("🔥");
    expect(back.textContent).toBe("TYPE");
  });

  it("turns over once when chosen, then settles home on its own", () => {
    const { rerender } = render(
      <NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst={false} selected={false} />,
    );
    rerender(<NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst={false} selected />);
    expect(faces().root.dataset.flipped).toBe("true");
    act(() => vi.advanceTimersByTime(FLIP_HOLD_MS));
    expect(faces().root.dataset.flipped).toBe("false");
  });

  it("turns over again for each new flip token", () => {
    const { rerender } = render(
      <NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst={false} selected={false} flipToken={0} />,
    );
    expect(faces().root.dataset.flipped).toBe("false");
    rerender(<NodeFlipIcon typeFace={<span>TYPE</span>} emoji="🔥" emojiFirst={false} selected={false} flipToken={7} />);
    expect(faces().root.dataset.flipped).toBe("true");
    act(() => vi.advanceTimersByTime(FLIP_HOLD_MS));
    expect(faces().root.dataset.flipped).toBe("false");
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

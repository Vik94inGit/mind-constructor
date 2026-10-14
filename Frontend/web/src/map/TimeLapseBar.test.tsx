import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeLapseBar, timeLapseOrder, timeLapseStepMs } from "./TimeLapseBar";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import type { NodeDoc } from "../types";

const t = TRANSLATIONS.en;
const node = (nodeId: string, createdAt?: string) =>
  ({ nodeId, text: "", type: "unknown", parentId: null, userId: "u1", health: 100, defeated: false, createdAt }) as NodeDoc;

describe("timeLapseOrder", () => {
  it("puts the nodes oldest first, keeping list order for equal or missing times", () => {
    const nodes = [node("c", "2026-03-01"), node("a", "2026-01-01"), node("x"), node("b", "2026-02-01"), node("y")];
    expect(timeLapseOrder(nodes).map((n) => n.nodeId)).toEqual(["x", "y", "a", "b", "c"]);
  });
});

describe("timeLapseStepMs", () => {
  it("spreads the replay over about ten seconds, within limits", () => {
    expect(timeLapseStepMs(40)).toBe(250);
    expect(timeLapseStepMs(2)).toBe(500);
    expect(timeLapseStepMs(1000)).toBe(125);
  });
});

describe("TimeLapseBar", () => {
  function renderBar(props: Partial<React.ComponentProps<typeof TimeLapseBar>> = {}) {
    const handlers = { onStep: vi.fn(), onTogglePlay: vi.fn(), onExit: vi.fn() };
    render(
      <I18nProvider>
        <TimeLapseBar step={1} total={3} playing={false} {...handlers} {...props} />
      </I18nProvider>,
    );
    return handlers;
  }

  it("steps forward on its own while playing", () => {
    vi.useFakeTimers();
    const { onStep } = renderBar({ playing: true });
    act(() => void vi.advanceTimersByTime(timeLapseStepMs(3)));
    expect(onStep).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });

  it("stops at the last node", () => {
    vi.useFakeTimers();
    const { onStep } = renderBar({ playing: true, step: 3 });
    act(() => void vi.advanceTimersByTime(2000));
    expect(onStep).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows how far it is, and plays, pauses and closes", async () => {
    const { onTogglePlay, onExit } = renderBar();
    expect(screen.getByText(t.map.toolbar.timeLapseStep(1, 3))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: t.map.toolbar.timeLapsePlay }));
    expect(onTogglePlay).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: t.map.toolbar.timeLapseExit }));
    expect(onExit).toHaveBeenCalled();
  });
});

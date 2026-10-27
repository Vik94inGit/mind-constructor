import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadTimeLapseSpeed, TimeLapseBar, timeLapseOrder, timeLapseStepMs } from "./TimeLapseBar";
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
  const said = (text: string) => ({ ...node("n"), text });
  it("stays on a node long enough to read it, longer for more words, within limits", () => {
    expect(timeLapseStepMs(said("Hi"))).toBe(1800);
    expect(timeLapseStepMs(said("x".repeat(40)))).toBe(2800);
    expect(timeLapseStepMs(said("x".repeat(500)))).toBe(5000);
    expect(timeLapseStepMs(undefined)).toBe(600);
  });

  it("offers three speeds", () => {
    const n = said("x".repeat(40));
    expect(timeLapseStepMs(n, "slow")).toBeGreaterThan(timeLapseStepMs(n, "normal"));
    expect(timeLapseStepMs(n, "fast")).toBeLessThan(timeLapseStepMs(n, "normal"));
    expect(timeLapseStepMs(n, "fast")).toBeGreaterThanOrEqual(900);
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

  it("steps forward on its own while playing, once the node has been read", () => {
    vi.useFakeTimers();
    const current = { ...node("a"), text: "Hi" };
    const { onStep } = renderBar({ playing: true, current });
    act(() => void vi.advanceTimersByTime(timeLapseStepMs(current) - 50));
    expect(onStep).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(60));
    expect(onStep).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });

  it("plays slower or faster at the chosen speed, and remembers it", async () => {
    localStorage.clear();
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: t.map.toolbar.timeLapseSpeeds.slow }));
    expect(screen.getByRole("button", { name: t.map.toolbar.timeLapseSpeeds.slow }).getAttribute("aria-pressed")).toBe("true");
    expect(loadTimeLapseSpeed()).toBe("slow");
    localStorage.clear();
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

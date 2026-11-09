import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import { QuizOverlay } from "./QuizOverlay";

const cards = [
  { nodeId: "a", question: "Causes of WW1", answerList: ["Alliances", "Militarism"] },
  { nodeId: "b", question: "Photosynthesis", answer: "Light into sugar" },
];

function renderQuiz(marks = {}) {
  const onMark = vi.fn();
  const onExit = vi.fn();
  render(
    <I18nProvider>
      <QuizOverlay cards={cards} marks={marks} onMark={onMark} onExit={onExit} />
    </I18nProvider>,
  );
  return { onMark, onExit };
}

describe("QuizOverlay", () => {
  it("hides the answer until the card is turned, then marks it and moves on", () => {
    const { onMark } = renderQuiz();
    expect(screen.getByText("Causes of WW1")).toBeTruthy();
    expect(screen.queryByText("Alliances")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByText("Alliances")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Shaky" }));
    expect(onMark).toHaveBeenCalledWith("a", "shaky");
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
  });

  it("works from the keyboard: Space turns, 3 marks, Esc leaves", () => {
    const { onMark, onExit } = renderQuiz();
    fireEvent.keyDown(window, { key: "3" }); // not turned yet: no mark
    expect(onMark).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "3" });
    expect(onMark).toHaveBeenCalledWith("a", "know");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalled();
  });

  it("starts with what isn't known and offers to go over the shaky ones at the end", () => {
    renderQuiz({ a: "know" });
    expect(screen.getByText("Photosynthesis")).toBeTruthy(); // the known card waits till last
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Know it" }));
    expect(screen.getByText("Know it 1 · Shaky 0 · Not yet 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go over the shaky ones" }));
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
    expect(screen.getByText("1 / 1")).toBeTruthy();
  });
});

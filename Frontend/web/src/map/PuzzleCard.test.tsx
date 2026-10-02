import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PuzzleCard, puzzleEdgesFor, puzzlePath } from "./PuzzleCard";

describe("puzzleEdgesFor", () => {
  it("is stable for the same seed", () => {
    expect(puzzleEdgesFor("node-1")).toEqual(puzzleEdgesFor("node-1"));
  });

  it("always cuts at least one tab and one blank", () => {
    for (let i = 0; i < 200; i++) {
      const edges = puzzleEdgesFor(`n${i}`);
      expect(edges).toContain(1);
      expect(edges).toContain(-1);
    }
  });
});

describe("puzzlePath", () => {
  it("draws a closed outline", () => {
    const d = puzzlePath(0, 0, 120, 60, [1, -1, 1, -1]);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).not.toContain("NaN");
  });
});

describe("PuzzleCard", () => {
  it("renders its content inside the piece", () => {
    render(
      <PuzzleCard seed="abc" color="red" minWidth={96} maxWidth={240}>
        <span>hello</span>
      </PuzzleCard>,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

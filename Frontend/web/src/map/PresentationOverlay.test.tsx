import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { PresentationOverlay } from "./PresentationOverlay";
import { computeSlideGroups } from "../utils/presentation";
import { makeNode } from "../test/fixtures";

const en = TRANSLATIONS.en;

function setup(index = 0) {
  const groups = computeSlideGroups([
    makeNode({ nodeId: "trip", text: "Weekend trip", type: "Problem", createdAt: "2026-01-01T00:00:00Z" }),
    makeNode({ nodeId: "hotel", text: "Book a hotel", type: "Option", parentId: "trip", x: 100, createdAt: "2026-01-02T00:00:00Z" }),
    makeNode({ nodeId: "train", text: "Buy train tickets", type: "Option", parentId: "trip", x: 300, createdAt: "2026-01-03T00:00:00Z" }),
    makeNode({ nodeId: "cheap", text: "Find a cheap one", type: "Idea", parentId: "hotel", createdAt: "2026-01-04T00:00:00Z" }),
  ]);
  const onOpenNode = vi.fn();
  const onIndexChange = vi.fn();
  render(
    <I18nProvider>
      <PresentationOverlay slides={groups} index={index} onIndexChange={onIndexChange} onExit={() => {}} onOpenNode={onOpenNode} />
    </I18nProvider>,
  );
  return { onOpenNode, onIndexChange };
}

describe("PresentationOverlay", () => {
  it("shows a parent with its children on one slide", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Weekend trip" })).toBeInTheDocument();
    const kids = screen.getAllByRole("listitem");
    expect(kids.map((k) => k.textContent)).toEqual([
      expect.stringContaining("Book a hotel"),
      expect.stringContaining("Buy train tickets"),
    ]);
    expect(screen.getByText(en.ui.presentation.slideCount(1, 4))).toBeInTheDocument();
  });

  it("goes on to the next parent and its children, naming the parent above", () => {
    setup(1);
    expect(screen.getByRole("heading", { name: "Book a hotel" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(en.ui.presentation.under("Weekend trip")))).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Find a cheap one");
  });

  it("opens the parent or a child on the map", () => {
    const { onOpenNode } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: en.ui.presentation.showOnMap })[0]);
    expect(onOpenNode).toHaveBeenLastCalledWith("trip");
    const train = screen.getAllByRole("listitem")[1];
    fireEvent.click(within(train).getByRole("button", { name: en.ui.presentation.showOnMap }));
    expect(onOpenNode).toHaveBeenLastCalledWith("train");
  });

  it("opens a child's own slide when its card is tapped, and goes back up from Under", () => {
    const { onIndexChange } = setup();
    fireEvent.click(screen.getByText("Buy train tickets"));
    // trip, hotel, train, cheap: all of the trip's children before the hotel's own.
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByText("Book a hotel"));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
  });

  it("goes back up to the parent's slide", () => {
    const { onIndexChange } = setup(1);
    fireEvent.click(screen.getByText(new RegExp(en.ui.presentation.under("Weekend trip"))));
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });
});

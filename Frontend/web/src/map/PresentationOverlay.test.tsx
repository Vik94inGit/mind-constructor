import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { PresentationOverlay } from "./PresentationOverlay";
import { computeSlideGroups } from "../utils/presentation";
import { makeNode } from "../test/fixtures";
import * as nodesApi from "../api/nodes";

vi.mock("../api/nodes", () => ({
  getNode: vi.fn(async (nodeId: string) => ({ nodeId, images: nodeId === "trip" ? ["/api/images/a", "/api/images/b"] : [] })),
}));

const en = TRANSLATIONS.en;

function setup(index = 0) {
  const groups = computeSlideGroups([
    makeNode({ nodeId: "trip", text: "Weekend trip", type: "Problem", createdAt: "2026-01-01T00:00:00Z" }),
    makeNode({ nodeId: "hotel", text: "Book a hotel", type: "Option", parentId: "trip", x: 100, createdAt: "2026-01-02T00:00:00Z" }),
    makeNode({ nodeId: "train", text: "Buy train tickets", type: "Option", parentId: "trip", x: 300, createdAt: "2026-01-03T00:00:00Z", cardImage: "/api/images/card" }),
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

  it("shows the slide node's pictures, fetched with the node, and opens one full size", async () => {
    setup();
    const pictures = await screen.findAllByRole("button", { name: en.ui.images.open });
    expect(pictures).toHaveLength(2);
    expect(nodesApi.getNode).toHaveBeenCalledWith("trip");
    expect(pictures[0].querySelector("img")?.getAttribute("src")).toMatch(/\/api\/images\/a$/);
    fireEvent.click(pictures[1]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("img")?.getAttribute("src")).toMatch(/\/api\/images\/b$/);
    fireEvent.click(within(dialog).getByRole("button", { name: en.ui.images.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a child's picture card on its card", () => {
    setup();
    const train = screen.getAllByRole("listitem")[1];
    expect(train.querySelector("img")?.getAttribute("src")).toMatch(/\/api\/images\/card$/);
  });
});

describe("PresentationOverlay summary", () => {
  function renderWith(nodes: ReturnType<typeof makeNode>[], onTypeFilterChange = vi.fn(), typeFilter: import("../types").NodeType[] = []) {
    const groups = computeSlideGroups(nodes.filter((n) => n.text));
    const onIndexChange = vi.fn();
    const onOpenNode = vi.fn();
    render(
      <I18nProvider>
        <PresentationOverlay
          slides={groups}
          index={0}
          onIndexChange={onIndexChange}
          onExit={() => {}}
          onOpenNode={onOpenNode}
          summaryNodes={nodes}
          typeFilter={typeFilter}
          onTypeFilterChange={onTypeFilterChange}
        />
      </I18nProvider>,
    );
    return { onIndexChange, onOpenNode, onTypeFilterChange };
  }

  it("lists a map's nodes by type and filters them with the type chips", () => {
    const { onTypeFilterChange, onIndexChange } = renderWith([
      makeNode({ nodeId: "p", text: "Too slow", type: "Problem", createdAt: "1" }),
      makeNode({ nodeId: "s", text: "Cache it", type: "Solution", parentId: "p", createdAt: "2" }),
    ]);
    fireEvent.click(screen.getByRole("tab", { name: en.ui.presentation.summaryTab }));
    expect(screen.getByRole("heading", { name: en.ui.presentation.byTypeTitle })).toBeInTheDocument();
    const chips = within(screen.getByRole("group", { name: en.ui.presentation.filterTypes }));
    fireEvent.click(chips.getByRole("button", { name: /Solution/ }));
    expect(onTypeFilterChange).toHaveBeenLastCalledWith(["Solution"]);
    fireEvent.click(screen.getByText("Cache it"));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
  });

  it("shows a template's questions with answers and progress per level", () => {
    const { onOpenNode } = renderWith([
      makeNode({ nodeId: "root", text: "Bike sharing", prompt: "What's the idea?", type: "Idea" }),
      makeNode({ nodeId: "a1", text: "Commuters", prompt: "What problem does it solve?", level: 1, parentId: "root" }),
      makeNode({ nodeId: "a2", text: "", ghost: true, prompt: "Why would it work?", level: 1, parentId: "root" }),
      makeNode({ nodeId: "b1", text: "", ghost: true, prompt: "What's the plan?", level: 2, parentId: "root" }),
    ]);
    fireEvent.click(screen.getByRole("tab", { name: en.ui.presentation.summaryTab }));
    expect(screen.getByRole("heading", { name: en.ui.presentation.level(1) })).toBeInTheDocument();
    expect(screen.getByText(en.ui.presentation.answeredOf(1, 2))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(en.ui.presentation.locked(1)))).toBeInTheDocument();
    fireEvent.click(screen.getByText("Why would it work?"));
    expect(onOpenNode).toHaveBeenLastCalledWith("a2");
  });
});

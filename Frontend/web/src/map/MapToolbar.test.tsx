import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MapToolbar } from "./MapToolbar";
import { I18nProvider } from "../i18n/I18nContext";
import { ThemeProvider } from "../theme/ThemeContext";
import { TRANSLATIONS } from "../i18n/translations";

const t = TRANSLATIONS.en;

function renderToolbar(overrides: Partial<React.ComponentProps<typeof MapToolbar>> = {}) {
  const handlers = {
    onExpand: vi.fn(),
    onToggleMove: vi.fn(),
    onToggleDraw: vi.fn(),
    onPickReadingMode: vi.fn(),
    onToggleCompact: vi.fn(),
    onLoadTexts: vi.fn().mockResolvedValue(undefined),
    onSearchMatches: vi.fn(),
    onPickSearchResult: vi.fn(),
    onToggleMapMode: vi.fn(),
    onExitDemo: vi.fn(),
    onInvite: vi.fn(),
    onCreateNode: vi.fn(),
    onCreateCircle: vi.fn(),
    onCopyMap: vi.fn(),
    onPaste: vi.fn(),
    onExportText: vi.fn(),
    onPresent: vi.fn(),
  };
  const utils = render(
    <MemoryRouter>
      <I18nProvider>
        <ThemeProvider>
          <MapToolbar
            isDemo={false}
            isOwner={false}
            isDiscussionMode={true}
            expanded={true}
            moveMode={false}
            drawMode={false}
            readingMode="actual"
            compact={false}
            nodes={[]}
            {...handlers}
            {...overrides}
          />
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  return { ...utils, ...handlers };
}

describe("MapToolbar", () => {
  it("collapses to just the expand button while a quick-add ring is up", () => {
    const { onExpand } = renderToolbar({ expanded: false });
    expect(screen.queryByTitle(t.map.toolbar.back)).not.toBeInTheDocument();
    expect(screen.getByTitle(t.map.toolbar.expandToolbar)).toBeInTheDocument();
    screen.getByTitle(t.map.toolbar.expandToolbar).click();
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("shows a Back link when not a demo session", () => {
    renderToolbar({ isDemo: false });
    expect(screen.getByTitle(t.map.toolbar.back)).toBeInTheDocument();
  });

  it("hides the Back link and offers an exit button for a demo session instead", async () => {
    const user = userEvent.setup();
    const { onExitDemo } = renderToolbar({ isDemo: true });
    expect(screen.queryByTitle(t.map.toolbar.back)).not.toBeInTheDocument();
    const exitBtn = screen.getByTitle(t.ui.demo.exitTitle);
    await user.click(exitBtn);
    expect(onExitDemo).toHaveBeenCalledTimes(1);
  });

  it("toggles move mode", async () => {
    const user = userEvent.setup();
    const { onToggleMove } = renderToolbar({ moveMode: false });
    await user.click(screen.getByTitle(t.map.toolbar.moveOff));
    expect(onToggleMove).toHaveBeenCalledTimes(1);
  });

  it("shows the 'on' tooltip once move mode is active", () => {
    renderToolbar({ moveMode: true });
    expect(screen.getByTitle(t.map.toolbar.moveOn)).toBeInTheDocument();
  });

  it("toggles draw mode", async () => {
    const user = userEvent.setup();
    const { onToggleDraw } = renderToolbar();
    await user.click(screen.getByTitle(t.ui.lines.toolbar));
    expect(onToggleDraw).toHaveBeenCalledTimes(1);
  });

  describe("discussion/personal mode toggle", () => {
    it("is hidden for anyone but the map's owner", () => {
      renderToolbar({ isOwner: false });
      expect(screen.queryByTitle(t.map.toolbar.discussionTooltip)).not.toBeInTheDocument();
      expect(screen.queryByTitle(t.map.toolbar.personalTooltip)).not.toBeInTheDocument();
    });

    it("shows the discussion tooltip in discussion mode and toggles on click", async () => {
      const user = userEvent.setup();
      const { onToggleMapMode } = renderToolbar({ isOwner: true, isDiscussionMode: true });
      const btn = screen.getByTitle(t.map.toolbar.discussionTooltip);
      expect(btn).toHaveTextContent("⚔");
      await user.click(btn);
      expect(onToggleMapMode).toHaveBeenCalledTimes(1);
    });

    it("shows the personal tooltip once in personal mode", () => {
      renderToolbar({ isOwner: true, isDiscussionMode: false });
      const btn = screen.getByTitle(t.map.toolbar.personalTooltip);
      expect(btn).toHaveTextContent("✎");
    });
  });

  describe("the + menu", () => {
    it("is closed until the trigger is clicked", () => {
      renderToolbar();
      expect(screen.queryByText(t.map.addMenu.createNode)).not.toBeInTheDocument();
    });

    it("opens on click, and an item both fires its action and closes the menu", async () => {
      const user = userEvent.setup();
      const { onCreateNode } = renderToolbar();
      await user.click(screen.getByTitle(t.map.toolbar.add));
      const createNodeItem = screen.getByText(t.map.addMenu.createNode);
      expect(createNodeItem).toBeInTheDocument();

      await user.click(createNodeItem);
      expect(onCreateNode).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(t.map.addMenu.createNode)).not.toBeInTheDocument();
    });

    it("offers Invite only to the map's owner", async () => {
      const user = userEvent.setup();
      renderToolbar({ isOwner: false });
      await user.click(screen.getByTitle(t.map.toolbar.add));
      expect(screen.queryByText(t.map.addMenu.invite)).not.toBeInTheDocument();
    });
  });

  describe("the view (reading mode) menu", () => {
    it("opens on click and offers Present, which fires onPresent and closes the menu", async () => {
      const user = userEvent.setup();
      const { onPresent } = renderToolbar();
      await user.click(screen.getByTitle(t.map.toolbar.readingMode));
      const presentItem = screen.getByText(t.map.toolbar.presentation);
      expect(presentItem).toBeInTheDocument();

      await user.click(presentItem);
      expect(onPresent).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(t.map.toolbar.presentation)).not.toBeInTheDocument();
    });

    it("is highlighted once a non-default reading mode is active", () => {
      renderToolbar({ readingMode: "puzzle" });
      const btn = screen.getByTitle(t.map.toolbar.readingMode);
      expect(btn.className).toContain("border-accent");
    });
  });
});

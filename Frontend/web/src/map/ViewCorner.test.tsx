import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewCorner } from "./ViewCorner";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const s = TRANSLATIONS.en.ui.abstraction;

function renderCorner(overrides: Partial<React.ComponentProps<typeof ViewCorner>> = {}) {
  const props = {
    level: null,
    levels: 3,
    hiddenCount: 0,
    onLevelChange: vi.fn(),
    readingMode: "actual" as const,
    onReadingModeChange: vi.fn(),
    minimapShown: true,
    onToggleMinimap: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <ViewCorner {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("ViewCorner", () => {
  it("opens its menu from the eye button", async () => {
    renderCorner();
    expect(screen.queryByText(s.minimap)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.getByText(s.minimap)).toBeInTheDocument();
  });

  it("steps one simpler / more detail equalizer: levels first, then text", async () => {
    const props = renderCorner({ level: 2, readingMode: "mixed" });
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.getByText(s.level(2, 3))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: s.richer }));
    expect(props.onLevelChange).toHaveBeenLastCalledWith(null);
    expect(props.onReadingModeChange).toHaveBeenLastCalledWith("mixed");
    await userEvent.click(screen.getByRole("button", { name: s.simpler }));
    expect(props.onLevelChange).toHaveBeenLastCalledWith(1);
    expect(props.onReadingModeChange).toHaveBeenLastCalledWith("mixed");
  });

  it("has one detail equalizer, no separate level or view steppers", async () => {
    renderCorner();
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.getAllByRole("button", { name: s.richer })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: s.fineTune })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: s.moreDetail })).not.toBeInTheDocument();
  });

  it("toggles the minimap", async () => {
    const props = renderCorner();
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    await userEvent.click(screen.getByRole("switch"));
    expect(props.onToggleMinimap).toHaveBeenCalled();
  });

  it("lifts the corner above the minimap while the menu is open", async () => {
    renderCorner();
    const button = screen.getByRole("button", { name: s.menu });
    expect(button.parentElement!.className).toContain("z-[45]");
    await userEvent.click(button);
    expect(button.parentElement!.className).toContain("z-[49]");
  });

  it("switches between the whole map, the overview and the cards", async () => {
    const onViewChange = vi.fn();
    const onLayCardsClose = vi.fn();
    renderCorner({ view: "cards", onViewChange, onLayCardsClose });
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    const a = TRANSLATIONS.en.ui.autoPack;
    expect(screen.getByRole("button", { name: a.views.cards })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: a.views.overview }));
    expect(onViewChange).toHaveBeenCalledWith("overview");
    await userEvent.click(screen.getByRole("button", { name: /Lay the cards close/ }));
    expect(onLayCardsClose).toHaveBeenCalled();
  });

  it("offers to lay the cards close only in the cards view", async () => {
    renderCorner({ view: "map", onViewChange: vi.fn(), onLayCardsClose: vi.fn() });
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.queryByRole("button", { name: /Lay the cards close/ })).not.toBeInTheDocument();
  });
});

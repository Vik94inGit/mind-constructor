import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewCorner } from "./ViewCorner";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const s = TRANSLATIONS.en.ui.abstraction;
const a = TRANSLATIONS.en.ui.autoPack;

function renderCorner(overrides: Partial<React.ComponentProps<typeof ViewCorner>> = {}) {
  const props = {
    minimapShown: true,
    onToggleMinimap: vi.fn(),
    view: "map" as const,
    onViewChange: vi.fn(),
    onLayCardsClose: vi.fn(),
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

  it("has the three views in place of the detail equalizer", async () => {
    renderCorner();
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.queryByRole("button", { name: s.richer })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: s.simpler })).not.toBeInTheDocument();
    for (const v of ["map", "overview", "cards"] as const) {
      expect(screen.getByRole("button", { name: a.views[v] })).toBeInTheDocument();
    }
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
    const props = renderCorner({ view: "cards" });
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.getByRole("button", { name: a.views.cards })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: a.views.overview }));
    expect(props.onViewChange).toHaveBeenCalledWith("overview");
    await userEvent.click(screen.getByRole("button", { name: /Lay the cards close/ }));
    expect(props.onLayCardsClose).toHaveBeenCalled();
  });

  it("offers to lay the cards close only in the cards view", async () => {
    renderCorner({ view: "map" });
    await userEvent.click(screen.getByRole("button", { name: s.menu }));
    expect(screen.queryByRole("button", { name: /Lay the cards close/ })).not.toBeInTheDocument();
  });
});

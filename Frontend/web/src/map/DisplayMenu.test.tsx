import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DisplayMenu } from "./DisplayMenu";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const bg = TRANSLATIONS.en.ui.mapBackground;

function renderMenu(overrides: Partial<React.ComponentProps<typeof DisplayMenu>> = {}) {
  const props = {
    compact: false,
    onToggleCompact: vi.fn(),
    emojiFirst: false,
    onToggleEmojiFirst: vi.fn(),
    onPresent: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <DisplayMenu {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("DisplayMenu background", () => {
  it("lets the map's owner pick a background, the dot grid ticked by default", async () => {
    const onPickBackground = vi.fn();
    renderMenu({ background: null, onPickBackground });
    expect(screen.getByRole("menuitemradio", { name: bg.options.dots })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemradio", { name: bg.options.lined }));
    expect(onPickBackground).toHaveBeenCalledWith("lined");
  });

  it("shows no background choice to anyone else", () => {
    renderMenu({ background: "dark" });
    expect(screen.queryByText(bg.title)).not.toBeInTheDocument();
  });
});

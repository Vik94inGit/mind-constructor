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

  it("uploads the owner's own picture, and removes it", async () => {
    const onPickBackgroundImage = vi.fn();
    const file = new File(["x"], "sea.png", { type: "image/png" });
    renderMenu({ onPickBackground: vi.fn(), onPickBackgroundImage });
    await userEvent.upload(screen.getByLabelText(bg.picture), file);
    expect(onPickBackgroundImage).toHaveBeenCalledWith(file);
    expect(screen.queryByRole("button", { name: bg.removePicture })).not.toBeInTheDocument();
  });

  it("offers to change or remove a picture already set", async () => {
    const onPickBackgroundImage = vi.fn();
    renderMenu({ onPickBackground: vi.fn(), backgroundImage: "/api/images/abcdefgh", onPickBackgroundImage });
    expect(screen.getByText(bg.changePicture)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: bg.removePicture }));
    expect(onPickBackgroundImage).toHaveBeenCalledWith(null);
  });

  it("shows no background choice to anyone else", () => {
    renderMenu({ background: "dark" });
    expect(screen.queryByText(bg.title)).not.toBeInTheDocument();
  });
});

describe("DisplayMenu emoji for each type", () => {
  const types = TRANSLATIONS.en.ui.types;

  it("lets the viewer give a type its own emoji, and go back to its symbol", async () => {
    const onTypeEmoji = vi.fn();
    const symbol = TRANSLATIONS.en.ui.emoji.typeSymbol;
    renderMenu({ emojiFirst: true, typeEmoji: { Solution: "🌟" }, onTypeEmoji });
    await userEvent.click(screen.getByRole("button", { name: `${types.Problem}: ${symbol}` }));
    await userEvent.click(screen.getByRole("button", { name: "❗" }));
    expect(onTypeEmoji).toHaveBeenCalledWith("Problem", "❗");
    await userEvent.click(screen.getByRole("button", { name: `${types.Solution}: 🌟` }));
    await userEvent.click(screen.getByRole("button", { name: symbol }));
    expect(onTypeEmoji).toHaveBeenLastCalledWith("Solution", null);
  });

  it("offers the type's own symbol among the choices", async () => {
    const onTypeEmoji = vi.fn();
    renderMenu({ emojiFirst: true, typeEmoji: { Fail: "symbol" }, onTypeEmoji });
    const symbol = TRANSLATIONS.en.ui.emoji.typeSymbol;
    // A type kept on its symbol says so.
    await userEvent.click(screen.getByRole("button", { name: `${types.Fail}: ${symbol}` }));
    expect(screen.getByRole("button", { name: symbol })).toHaveAttribute("aria-pressed", "true");
    // So does a type nobody picked an emoji for.
    await userEvent.click(screen.getByRole("button", { name: `${types.Problem}: ${symbol}` }));
    expect(screen.getByRole("button", { name: symbol })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers type emoji only while emoji first is on", () => {
    renderMenu({ emojiFirst: false, typeEmoji: {}, onTypeEmoji: vi.fn() });
    expect(screen.queryByTestId("type-emoji-picker")).not.toBeInTheDocument();
  });
});

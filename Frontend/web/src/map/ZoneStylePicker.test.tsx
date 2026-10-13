import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZoneStylePicker } from "./ZoneStylePicker";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const s = TRANSLATIONS.en.ui.zoneStyle;

function renderPicker(overrides: Partial<React.ComponentProps<typeof ZoneStylePicker>> = {}) {
  const props = {
    idPrefix: "t",
    pattern: null,
    color: null,
    autoColor: "var(--zone-positive)",
    onPattern: vi.fn(),
    onColor: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <ZoneStylePicker {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("ZoneStylePicker", () => {
  it("picks a pattern and a palette colour", async () => {
    const props = renderPicker();
    await userEvent.click(screen.getByRole("radio", { name: s.patterns.chess }));
    expect(props.onPattern).toHaveBeenCalledWith("chess");
    await userEvent.click(screen.getByRole("radio", { name: s.colors.sage }));
    expect(props.onColor).toHaveBeenCalledWith("sage");
  });

  it("goes back to no pattern and the sentiment colour", async () => {
    const props = renderPicker({ pattern: "dots", color: "sky" });
    expect(screen.getByRole("radio", { name: s.patterns.dots })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: s.none }));
    expect(props.onPattern).toHaveBeenCalledWith(null);
    await userEvent.click(screen.getByRole("radio", { name: s.autoHint }));
    expect(props.onColor).toHaveBeenCalledWith(null);
  });
});

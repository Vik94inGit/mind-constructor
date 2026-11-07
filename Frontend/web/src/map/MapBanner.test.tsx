import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapBanner } from "./MapBanner";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

describe("MapBanner", () => {
  it("shows the message in its tone and dismisses on ✕", async () => {
    const onDismiss = vi.fn();
    render(
      <I18nProvider>
        <MapBanner tone="danger" message="Could not save" onDismiss={onDismiss} />
      </I18nProvider>,
    );
    const text = screen.getByText("Could not save");
    expect(text).toHaveClass("bg-danger-bg", "text-danger");
    await userEvent.click(screen.getByRole("button", { name: TRANSLATIONS.en.ui.common.close }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("runs its action once and closes", async () => {
    const onDismiss = vi.fn();
    const run = vi.fn();
    render(
      <I18nProvider>
        <MapBanner tone="success" message="Added 7 nodes" action={{ label: "Undo", run }} onDismiss={onDismiss} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

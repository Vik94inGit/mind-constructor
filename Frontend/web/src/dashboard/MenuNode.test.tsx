import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuNode } from "./MenuNode";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const ring = TRANSLATIONS.en.dashboard.ring;

describe("MenuNode", () => {
  it("draws the node and one named ghost per action, and each ghost does its own thing", async () => {
    const user = userEvent.setup();
    const onNote = vi.fn();
    const onCenter = vi.fn();
    render(
      <I18nProvider>
        <MenuNode
          active="note"
          onCenter={onCenter}
          ghosts={[
            { id: "note", label: ring.quickNote, icon: "✎", color: "red", onClick: onNote },
            { id: "map", label: ring.newMap, icon: "+", color: "blue", onClick: vi.fn() },
          ]}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("navigation", { name: ring.label })).not.toBeNull();
    expect(screen.getByText(ring.newMap)).not.toBeNull();
    expect(screen.getByTestId("menu-ghost-note")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("menu-ghost-map")).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByTestId("menu-ghost-note"));
    expect(onNote).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: ring.center }));
    expect(onCenter).toHaveBeenCalledTimes(1);
  });
});

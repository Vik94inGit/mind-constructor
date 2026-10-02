import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZoneNames } from "./ZoneNames";
import type { NamedZone } from "./ZoneNames";
import { I18nProvider } from "../i18n/I18nContext";

// jsdom has no ResizeObserver; nothing here needs it to fire.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

// jsdom has no layout: the scroll wrapper reports a 0x0 view at 0,0, so only
// a zone whose parent sits exactly at the (margin-shifted) origin is "on screen".
const zones: NamedZone[] = [
  { rootId: "near", name: "Near zone", sentiment: "positive", variant: false },
  { rootId: "far", name: "Far zone", sentiment: "negative", variant: true },
];

function renderNames(onGo = vi.fn(), onSetMode?: (rootId: string, mode: string | null) => void) {
  const wrap = document.createElement("div");
  render(
    <I18nProvider>
    <ZoneNames
      wrapRef={{ current: wrap }}
      zones={zones}
      positions={
        new Map([
          ["near", { x: -10, y: -10 }],
          ["far", { x: 2000, y: 1400 }],
        ])
      }
      zoom={1}
      hScrollMargin={10}
      vScrollMargin={10}
      onGo={onGo}
      modes={{ near: "dots" }}
      onSetMode={onSetMode}
    />
    </I18nProvider>,
  );
  return onGo;
}

describe("ZoneNames", () => {
  it("lists every zone, fading the ones whose parent is off screen", () => {
    renderNames();
    expect(screen.getByRole("button", { name: "Near zone" }).className).not.toContain("opacity-60");
    expect(screen.getByRole("button", { name: "Far zone" }).className).toContain("opacity-60");
  });

  it("asks to center on the zone when its name is clicked", async () => {
    const onGo = renderNames();
    await userEvent.setup().click(screen.getByRole("button", { name: "Far zone" }));
    expect(onGo).toHaveBeenCalledWith("far");
  });

  it("lets each zone pick its own view", async () => {
    const onSetMode = vi.fn();
    renderNames(vi.fn(), onSetMode);
    const user = userEvent.setup();
    // The zone with a view shows it on its button; picking one reports it.
    expect(screen.getByRole("button", { name: /Near zone.$/ }).textContent).toBe("•••");
    await user.click(screen.getByRole("button", { name: /Far zone.$/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Puzzle cards/ }));
    expect(onSetMode).toHaveBeenCalledWith("far", "puzzle");
  });
});

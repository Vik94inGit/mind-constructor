import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZoneNames } from "./ZoneNames";
import type { NamedZone } from "./ZoneNames";

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

function renderNames(onGo = vi.fn()) {
  const wrap = document.createElement("div");
  render(
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
    />,
  );
  return onGo;
}

describe("ZoneNames", () => {
  it("lists every zone, fading the ones whose parent is off screen", () => {
    renderNames();
    expect(screen.getByRole("button", { name: /Near zone/ }).className).not.toContain("opacity-60");
    expect(screen.getByRole("button", { name: /Far zone/ }).className).toContain("opacity-60");
  });

  it("goes to the zone's parent node when a name is clicked", async () => {
    const onGo = renderNames();
    await userEvent.setup().click(screen.getByRole("button", { name: /Far zone/ }));
    expect(onGo).toHaveBeenCalledWith("far");
  });
});

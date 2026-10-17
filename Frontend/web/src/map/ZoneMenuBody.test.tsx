import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ZoneMenuBody } from "./ZoneMenuBody";
import { EDGE_SAVE_DELAY_MS } from "./ZoneStylePicker";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const t = TRANSLATIONS.en;

function renderBody(props: Partial<React.ComponentProps<typeof ZoneMenuBody>> = {}) {
  render(
    <I18nProvider>
      <ZoneMenuBody idPrefix="t" {...props} />
    </I18nProvider>,
  );
}

describe("ZoneMenuBody", () => {
  afterEach(() => vi.useRealTimers());

  it("picks the zone's view and layout, then reports the pick", () => {
    const onView = vi.fn();
    const onLayout = vi.fn();
    const onPicked = vi.fn();
    renderBody({ view: { value: null, onPick: onView }, layout: { value: null, onPick: onLayout }, onPicked });
    fireEvent.click(screen.getByRole("menuitemradio", { name: new RegExp(t.ui.display.dots) }));
    expect(onView).toHaveBeenCalledWith("dots");
    expect(onPicked).toHaveBeenCalledTimes(1);
  });

  it("shows no look section to someone who doesn't own the parent", () => {
    renderBody({ view: { value: null, onPick: vi.fn() } });
    expect(screen.queryByRole("slider", { name: t.ui.zoneStyle.edge })).not.toBeInTheDocument();
  });

  it("saves the edge brightness once the slider rests, not on every step", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderBody({ style: { pattern: null, color: null, edge: null, autoColor: "red", onChange } });
    const slider = screen.getByRole("slider", { name: t.ui.zoneStyle.edge });
    expect(slider).toHaveValue("25");
    fireEvent.change(slider, { target: { value: "70" } });
    fireEvent.change(slider, { target: { value: "85" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(EDGE_SAVE_DELAY_MS));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ zoneEdge: 0.85 });
  });
});

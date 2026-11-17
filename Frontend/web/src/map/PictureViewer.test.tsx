import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PictureViewer } from "./PictureViewer";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const s = TRANSLATIONS.en.ui.images;

function setup(sources = ["data:image/png;base64,AA"], start = 0) {
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <PictureViewer sources={sources} start={start} onClose={onClose} />
    </I18nProvider>,
  );
  return { onClose };
}

describe("PictureViewer", () => {
  it("opens over the page at the whole picture, and closes on ✕ or Escape", () => {
    const { onClose } = setup();
    expect(screen.getByTestId("picture-viewer").parentElement).toBe(document.body);
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: s.close }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("zooms in and back to the whole picture from its buttons and keys", () => {
    setup();
    expect(screen.getByRole("button", { name: s.zoomOut })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: s.zoomIn }));
    expect(screen.getByText("150%")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "+" });
    expect(screen.getByText("225%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: s.zoomFit }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("steps through several pictures", () => {
    setup(["data:image/png;base64,AA", "data:image/png;base64,BB", "data:image/png;base64,CC"], 1);
    expect(screen.getByText("100% · 2 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: s.next }));
    expect(screen.getByText("100% · 3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("100% · 1 / 3")).toBeInTheDocument();
  });

  it("has no stepping for a single picture", () => {
    setup();
    expect(screen.queryByRole("button", { name: s.next })).toBeNull();
  });
});

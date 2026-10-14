import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PictureViewer } from "./PictureViewer";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const t = TRANSLATIONS.en;
const pics = ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"];

function renderViewer(images: string[] | null) {
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <PictureViewer images={images} onClose={onClose} />
    </I18nProvider>,
  );
  return onClose;
}

describe("PictureViewer", () => {
  it("says it's loading until the pictures arrive", () => {
    renderViewer(null);
    expect(screen.getByText(t.ui.images.loading)).toBeTruthy();
  });

  it("steps through several pictures with its arrows and the keyboard", async () => {
    renderViewer(pics);
    const src = () => document.querySelector("img")?.getAttribute("src");
    expect(src()).toBe(pics[0]);
    await userEvent.click(screen.getByRole("button", { name: t.ui.images.next }));
    expect(src()).toBe(pics[1]);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(src()).toBe(pics[0]);
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("closes with its button and with Escape", async () => {
    const onClose = renderViewer(pics.slice(0, 1));
    expect(screen.queryByRole("button", { name: t.ui.images.next })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: t.ui.images.close }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

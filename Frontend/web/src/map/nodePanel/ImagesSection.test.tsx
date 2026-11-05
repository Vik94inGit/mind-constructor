import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagesSection } from "./ImagesSection";
import { I18nProvider } from "../../i18n/I18nContext";
import { TRANSLATIONS } from "../../i18n/translations";

const s = TRANSLATIONS.en.ui.images;

function setup(images: string[] = [], canEdit = true) {
  const onAdd = vi.fn();
  const { container } = render(
    <I18nProvider>
      <ImagesSection images={images} canEdit={canEdit} busy={false} onAdd={onAdd} onRemove={vi.fn()} />
    </I18nProvider>,
  );
  return { onAdd, container };
}

describe("ImagesSection templates", () => {
  it("offers the ready-made paintings and adds the one picked", async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(["x"], { type: "image/webp" })));
    vi.stubGlobal("fetch", fetchMock);
    const { onAdd, container } = setup();
    await userEvent.click(screen.getByRole("button", { name: s.templates }));
    expect(container.querySelectorAll("[data-template]")).toHaveLength(10);
    await userEvent.click(screen.getByRole("button", { name: s.templateNames.lightbulb }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/picture-templates/lightbulb.webp");
    const [files] = onAdd.mock.calls[0];
    expect(files[0].name).toBe("lightbulb.webp");
    expect(container.querySelector("[data-template]")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("says so and stays open when a painting can't be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const { onAdd, container } = setup();
    await userEvent.click(screen.getByRole("button", { name: s.templates }));
    await userEvent.click(screen.getByRole("button", { name: s.templateNames.eyes }));
    expect(await screen.findByText(s.templateFailed)).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
    expect(container.querySelectorAll("[data-template]")).toHaveLength(10);
    vi.unstubAllGlobals();
  });

  it("has no templates for a viewer who can't edit", () => {
    setup(["data:image/png;base64,x"], false);
    expect(screen.queryByRole("button", { name: s.templates })).toBeNull();
  });
});

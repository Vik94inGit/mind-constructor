import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagesSection } from "./ImagesSection";
import { I18nProvider } from "../../i18n/I18nContext";
import { TRANSLATIONS } from "../../i18n/translations";

const s = TRANSLATIONS.en.ui.images;

function setup(images: string[] = [], canEdit = true) {
  const onAdd = vi.fn();
  const { container } = render(
    <I18nProvider>
      <ImagesSection images={images} canEdit={canEdit} busy={false} onAdd={onAdd} onRemove={vi.fn()} nodeType="Problem" />
    </I18nProvider>,
  );
  return { onAdd, container };
}

describe("ImagesSection templates", () => {
  it("offers a ready-made picture per type, the node's own type first, and adds the one picked", async () => {
    const { onAdd, container } = setup();
    await userEvent.click(screen.getByRole("button", { name: s.templates }));
    const tiles = container.querySelectorAll("[data-template]");
    expect(tiles).toHaveLength(8);
    expect(tiles[0].getAttribute("data-template")).toBe("stop");
    await userEvent.click(screen.getByRole("button", { name: TRANSLATIONS.en.ui.types.Idea }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [files] = onAdd.mock.calls[0];
    expect(files[0].name).toBe("bulb.svg");
    expect(container.querySelector("[data-template]")).toBeNull();
  });

  it("has no templates for a viewer who can't edit", () => {
    setup(["data:image/png;base64,x"], false);
    expect(screen.queryByRole("button", { name: s.templates })).toBeNull();
  });
});

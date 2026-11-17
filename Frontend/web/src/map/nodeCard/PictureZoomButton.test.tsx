import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PictureZoomButton } from "./PictureZoomButton";
import { I18nProvider } from "../../i18n/I18nContext";
import { TRANSLATIONS } from "../../i18n/translations";
import type { NodeDoc } from "../../types";

vi.mock("../../api/nodes", () => ({
  getNode: vi.fn(async () => ({ nodeId: "n1", images: ["data:image/png;base64,FULL1", "data:image/png;base64,FULL2"] })),
}));

const s = TRANSLATIONS.en.ui.images;

function node(extra: Partial<NodeDoc>): NodeDoc {
  return { nodeId: "n1", ...extra } as NodeDoc;
}

describe("PictureZoomButton", () => {
  it("is not there for a node without a picture on the map", () => {
    render(
      <I18nProvider>
        <PictureZoomButton node={node({})} shown />
      </I18nProvider>,
    );
    expect(screen.queryByRole("button", { name: s.zoom })).toBeNull();
  });

  it("opens the card's picture, then the node's full-size pictures", async () => {
    const onParentClick = vi.fn();
    render(
      <I18nProvider>
        <div onClick={onParentClick}>
          <PictureZoomButton node={node({ cardImage: "data:image/png;base64,CARD" })} shown />
        </div>
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: s.zoom }));
    expect(screen.getByTestId("picture-viewer")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("100% · 1 / 2")).toBeInTheDocument());
    // Neither the 🔍 nor the viewer's own buttons reach the node (it would open its panel).
    await userEvent.click(screen.getByRole("button", { name: s.close }));
    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("picture-viewer")).toBeNull();
  });
});

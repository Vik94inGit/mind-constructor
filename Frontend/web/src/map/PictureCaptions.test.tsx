import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PictureCaptions } from "./PictureCaptions";
import { I18nProvider } from "../i18n/I18nContext";
import { PICTURES, pictureGroups } from "../utils/pictures";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

const posFor = (n: NodeDoc) => ({ x: n.x ?? 0, y: n.y ?? 0 });

function treeNodes(written: number) {
  return PICTURES.tree.dots.map((d, i) =>
    makeNode({
      nodeId: `n${i}`,
      x: 1000 + d.x * 300,
      y: 800 + d.y * 300,
      ghost: i >= written,
      picture: { id: "p1", kind: "tree", dot: i },
    }),
  );
}

function renderCaptions(written: number, overrides: Partial<Parameters<typeof PictureCaptions>[0]> = {}) {
  const props = {
    pictures: pictureGroups(treeNodes(written)),
    posFor,
    zoom: 0.5,
    canEdit: () => true,
    openId: null,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    canGrow: true,
    canShrink: false,
    onResize: vi.fn(),
    onMove: vi.fn(),
    onColor: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <PictureCaptions {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("PictureCaptions", () => {
  it("says how much is drawn", () => {
    renderCaptions(3);
    expect(screen.getByText("Tree · 43% drawn")).toBeTruthy();
  });

  it("says when a picture is done", () => {
    renderCaptions(7);
    expect(screen.getByText("Tree · done!")).toBeTruthy();
  });

  it("opens the bar from the caption", () => {
    const props = renderCaptions(3);
    fireEvent.click(screen.getByRole("button", { name: "Tree · 43% drawn" }));
    expect(props.onOpen).toHaveBeenCalledWith("p1");
  });

  it("is plain text for someone who can't edit the dots", () => {
    renderCaptions(3, { canEdit: () => false });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Tree · 43% drawn")).toBeTruthy();
  });

  it("offers bigger, smaller and move when open", () => {
    const props = renderCaptions(3, { openId: "p1" });
    expect(screen.getByTestId("picture-bar")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Smaller" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Bigger" }));
    expect(props.onResize).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(props.onMove).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("offers soft background colours, the picked one checked", () => {
    const nodes = treeNodes(3).map((n) => ({ ...n, picture: { ...n.picture!, color: "sky" as const } }));
    const props = renderCaptions(3, { openId: "p1", pictures: pictureGroups(nodes) });
    expect(screen.getByRole("radio", { name: "Sky" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Rose" }));
    expect(props.onColor).toHaveBeenCalledWith("rose");
    fireEvent.click(screen.getByRole("radio", { name: "None" }));
    expect(props.onColor).toHaveBeenLastCalledWith(null);
  });
});

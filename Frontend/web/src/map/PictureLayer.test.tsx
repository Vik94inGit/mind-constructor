import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PictureLayer } from "./PictureLayer";
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

describe("PictureLayer", () => {
  it("draws nothing without a picture", () => {
    const { container } = render(
      <I18nProvider>
        <PictureLayer pictures={[]} posFor={posFor} />
      </I18nProvider>,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("inks the lines between written dots and says how much is drawn", () => {
    const { container } = render(
      <I18nProvider>
        <PictureLayer pictures={pictureGroups(treeNodes(3))} posFor={posFor} />
      </I18nProvider>,
    );
    // Dots 0, 1, 2 written: lines 0-1 and 1-2 inked, the other five still guides.
    expect(container.querySelectorAll('line[data-drawn="true"]')).toHaveLength(2);
    expect(container.querySelectorAll("line")).toHaveLength(7);
    expect(screen.getByText("Tree · 43% drawn")).toBeTruthy();
  });

  it("says when a picture is done", () => {
    render(
      <I18nProvider>
        <PictureLayer pictures={pictureGroups(treeNodes(7))} posFor={posFor} />
      </I18nProvider>,
    );
    expect(screen.getByText("Tree · done!")).toBeTruthy();
  });
});

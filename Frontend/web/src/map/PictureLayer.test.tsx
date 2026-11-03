import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
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

  it("inks the lines between written dots", () => {
    const { container } = render(
      <I18nProvider>
        <PictureLayer pictures={pictureGroups(treeNodes(3))} posFor={posFor} />
      </I18nProvider>,
    );
    // Dots 0, 1, 2 written: lines 0-1 and 1-2 inked, the other five still guides.
    expect(container.querySelectorAll('line[data-drawn="true"]')).toHaveLength(2);
    expect(container.querySelectorAll("line")).toHaveLength(7);
  });

  it("draws a picture on its own as numbered dots, each joined to its card by a thin line", () => {
    const nodes = treeNodes(2).map((n) => ({ ...n, picture: { ...n.picture!, size: 80 } }));
    const { container } = render(
      <I18nProvider>
        <PictureLayer pictures={pictureGroups(nodes)} posFor={posFor} />
      </I18nProvider>,
    );
    expect(container.querySelector("[data-own-drawing]")).not.toBeNull();
    expect(container.querySelectorAll("[data-leader]")).toHaveLength(PICTURES.tree.dots.length);
    expect(container.querySelectorAll("[data-dot]")).toHaveLength(PICTURES.tree.dots.length);
    expect(container.querySelector('[data-dot="0"] text')?.textContent).toBe("1");
    // The drawing is 80 units per picture unit round the cards' middle, not on the cards.
    const leader = container.querySelector('[data-leader="0"]')!;
    const ends = ["x1", "y1", "x2", "y2"].map((a) => leader.getAttribute(a));
    expect(`${ends[0]},${ends[1]}`).not.toBe(`${ends[2]},${ends[3]}`);
  });
});

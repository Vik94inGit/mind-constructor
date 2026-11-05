import { afterEach, describe, expect, it } from "vitest";
import { boxObstacle, drawnBox } from "./drawnBox";
import { NODE_FOOTPRINT } from "./canvasLayout";

function rect(left: number, top: number, w: number, h: number) {
  return () => ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("drawnBox", () => {
  it("covers the node and everything it draws, in canvas units", () => {
    const node = document.createElement("div");
    node.setAttribute("data-reveal-node", "n1");
    node.getBoundingClientRect = rect(100, 100, 74, 48);
    const card = document.createElement("div");
    card.getBoundingClientRect = rect(80, 90, 240, 250);
    node.appendChild(card);
    document.body.appendChild(node);
    // Zoom 2, canvas origin at the screen's (0,0).
    const box = drawnBox("n1", (x, y) => ({ x: x / 2, y: y / 2 }))!;
    expect(box).toEqual({ x: 100, y: 107.5, w: 120, h: 125 });
  });

  it("is null for a node that isn't drawn", () => {
    expect(drawnBox("missing", (x, y) => ({ x, y }))).toBeNull();
  });
});

describe("boxObstacle", () => {
  it("keeps a node's whole footprint off the box", () => {
    const o = boxObstacle({ x: 0, y: 0, w: 240, h: 250 }, 10);
    expect(o.footprint).toEqual({ w: (240 + NODE_FOOTPRINT.w) / 2 + 10, h: (250 + NODE_FOOTPRINT.h) / 2 + 10 });
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { RedirectKnobs } from "./RedirectKnobs";
import { I18nProvider } from "../i18n/I18nContext";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

const parent = makeNode({ nodeId: "p", parentId: null });
const child = makeNode({ nodeId: "c", parentId: "p" });
const grandchild = makeNode({ nodeId: "g", parentId: "c" });
const other = makeNode({ nodeId: "o", parentId: null });
const spots: Record<string, { x: number; y: number }> = {
  p: { x: 0, y: 0 },
  c: { x: 1000, y: 0 },
  g: { x: 1000, y: 1000 },
  o: { x: 300, y: 300 },
};

function renderKnobs(overrides: Partial<React.ComponentProps<typeof RedirectKnobs>> = {}) {
  const props = {
    selected: child,
    visibleNodes: [parent, child, grandchild, other],
    posFor: (n: NodeDoc) => spots[n.nodeId],
    zoom: 1,
    canRedirect: () => true,
    onStart: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <RedirectKnobs {...props} />
    </I18nProvider>,
  );
  return props;
}

const knob = (id: string) => document.querySelector<HTMLElement>(`[data-redirect-knob="${id}"]`);

describe("RedirectKnobs", () => {
  it("puts a knob on the opened node's own branch to its parent, and none on its children's", () => {
    renderKnobs();
    expect(knob("c")).not.toBeNull();
    expect(knob("g")).toBeNull();
    expect(knob("o")).toBeNull();
  });

  it("puts none on a node with no parent", () => {
    renderKnobs({ selected: parent });
    expect(document.querySelector("[data-redirect-knob]")).toBeNull();
  });

  it("sits past the ring of ghosts round the opened node, not under it", () => {
    renderKnobs();
    const left = parseFloat(knob("c")!.style.left);
    expect(left).toBeLessThan(1000 - 126);
    expect(knob("c")!.style.top).toBe("0px");
  });

  it("hands the grab over, without panning the map", () => {
    const { onStart } = renderKnobs();
    expect(knob("c")!.style.touchAction).toBe("none");
    fireEvent.pointerDown(knob("c")!);
    expect(onStart).toHaveBeenCalledWith(child, expect.anything());
  });

  it("leaves out branches that can't be redirected", () => {
    renderKnobs({ canRedirect: (n) => n.nodeId !== "c" });
    expect(knob("c")).toBeNull();
  });

  it("steps out of the finger's way while a branch is being redirected, still mounted", () => {
    renderKnobs({ hidden: true });
    expect(knob("c")!.style.visibility).toBe("hidden");
    expect(knob("c")!.style.pointerEvents).toBe("none");
  });
});

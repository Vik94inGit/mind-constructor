import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { CanvasNodeCard } from "./CanvasNodeCard";
import type { CanvasNodeActions } from "./CanvasNodeCard";
import { makeNode } from "../test/fixtures";

const renders = vi.fn();
vi.mock("./NodeCard", () => ({
  NodeCard: (props: { onClick: () => void; onAddBranch?: () => void; onPointerDown?: () => void }) => {
    renders();
    return (
      <div>
        <button onClick={props.onClick}>card</button>
        {props.onAddBranch && <button onClick={props.onAddBranch}>branch</button>}
        {props.onPointerDown && <span>draggable</span>}
      </div>
    );
  },
}));

function actions(): CanvasNodeActions {
  return {
    inlineConfirm: vi.fn(),
    inlineCancel: vi.fn(),
    pointerDown: vi.fn(),
    click: vi.fn(),
    doubleClick: vi.fn(),
    contextMenu: vi.fn(),
    resize: vi.fn(),
    toggleBlockLock: vi.fn(),
    connectStart: vi.fn(),
    addBranch: vi.fn(),
    hoverText: vi.fn(),
  };
}

const node = makeNode({ nodeId: "n1" });

function props(a: CanvasNodeActions, over: Partial<Parameters<typeof CanvasNodeCard>[0]> = {}) {
  return {
    node,
    x: 10,
    y: 20,
    zoom: 1,
    selected: false,
    dragging: false,
    canDrag: false,
    chooseModeActive: false,
    actions: a,
    canResize: false,
    canToggleLock: false,
    canConnect: false,
    canAddBranch: false,
    ...over,
  };
}

describe("CanvasNodeCard", () => {
  it("doesn't re-render when its props are the same values", () => {
    renders.mockClear();
    const a = actions();
    const { rerender } = render(<CanvasNodeCard {...props(a, { flightX: 1, flightY: 2 })} />);
    rerender(<CanvasNodeCard {...props(a, { flightX: 1, flightY: 2 })} />);
    expect(renders).toHaveBeenCalledTimes(1);
    rerender(<CanvasNodeCard {...props(a, { flightX: 1, flightY: 2, x: 11 })} />);
    expect(renders).toHaveBeenCalledTimes(2);
  });

  it("passes its node to the shared actions", () => {
    const a = actions();
    const { getByText } = render(<CanvasNodeCard {...props(a, { canAddBranch: true })} />);
    fireEvent.click(getByText("card"));
    fireEvent.click(getByText("branch"));
    expect(a.click).toHaveBeenCalledWith(node, expect.anything());
    expect(a.addBranch).toHaveBeenCalledWith(node);
  });

  it("leaves out what the viewer can't do, and dragging while editing", () => {
    const { queryByText } = render(<CanvasNodeCard {...props(actions(), { inlineEditing: true })} />);
    expect(queryByText("branch")).toBeNull();
    expect(queryByText("draggable")).toBeNull();
  });
});

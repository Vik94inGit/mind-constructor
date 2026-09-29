import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodeCard } from "./NodeCard";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

const healthHint = TRANSLATIONS.en.ui.node.selectToSeeHealth;

function renderNode(overrides: Partial<React.ComponentProps<typeof NodeCard>> & { node: NodeDoc }) {
  const onClick = vi.fn();
  const utils = render(
    <I18nProvider>
      <NodeCard
        x={0}
        y={0}
        zoom={1}
        selected={false}
        dragging={false}
        canDrag={true}
        chooseModeActive={false}
        onClick={onClick}
        {...overrides}
      />
    </I18nProvider>,
  );
  return { ...utils, onClick };
}

describe("NodeCard", () => {
  describe("parent priority", () => {
    const root = (container: HTMLElement) => container.querySelector("[data-reveal-node]")!;

    it("stacks a parent above other nodes and a dragged node above both", () => {
      const node = makeNode({ nodeId: "a", text: "hello" });
      expect(root(renderNode({ node }).container).className).toContain("z-[31]");
      expect(root(renderNode({ node, isParent: true }).container).className).toContain("z-[32]");
      expect(root(renderNode({ node, isParent: true, dragging: true }).container).className).toContain("z-[33]");
    });

    it("fades a quiet child, but a stronger fade still wins", () => {
      const node = makeNode({ nodeId: "a", text: "hello" });
      expect(root(renderNode({ node, quiet: true }).container).className).toContain("opacity-50");
      const muted = root(renderNode({ node, quiet: true, muted: true }).container).className;
      expect(muted).toContain("opacity-16");
      expect(muted).not.toContain("opacity-50");
    });

    it("leaves out a caption that would cover a parent's", () => {
      const node = makeNode({ nodeId: "a", text: "caption text" });
      const shown = renderNode({ node });
      expect(shown.queryByText("caption text")).not.toBeNull();
      shown.unmount();
      expect(renderNode({ node, hideCaption: true }).queryByText("caption text")).toBeNull();
    });
  });

  it("renders with the node's text as its title attribute", () => {
    const node = makeNode({ nodeId: "a", text: "hello world" });
    const { container } = renderNode({ node });
    expect(container.querySelector('[title="hello world"]')).not.toBeNull();
  });

  describe("interaction handlers", () => {
    it("fires onClick when clicked", async () => {
      const user = userEvent.setup();
      const node = makeNode({ nodeId: "a", text: "hello" });
      const { onClick, container } = renderNode({ node });
      await user.click(container.querySelector('[title="hello"]')!);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("fires onDoubleClick on a double click", async () => {
      const user = userEvent.setup();
      const onDoubleClick = vi.fn();
      const node = makeNode({ nodeId: "a", text: "hello" });
      const { container } = renderNode({ node, onDoubleClick });
      await user.dblClick(container.querySelector('[title="hello"]')!);
      expect(onDoubleClick).toHaveBeenCalledTimes(1);
    });

    it("fires onContextMenu on a right click, without letting it reach the canvas", () => {
      const onContextMenu = vi.fn();
      const node = makeNode({ nodeId: "a", text: "hello" });
      const { container } = renderNode({ node, onContextMenu });
      const el = container.querySelector('[title="hello"]')!;
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      const preventDefault = vi.spyOn(event, "preventDefault");
      el.dispatchEvent(event);
      expect(onContextMenu).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalled();
    });

    it("forwards onPointerDown directly to the outer element", () => {
      const onPointerDown = vi.fn();
      const node = makeNode({ nodeId: "a", text: "hello" });
      const { container } = renderNode({ node, onPointerDown });
      const el = container.querySelector('[title="hello"]')!;
      // jsdom doesn't implement a real PointerEvent constructor — a plain
      // Event with the right type is enough for React's own native
      // "pointerdown" listener to fire and synthesize onPointerDown.
      el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(onPointerDown).toHaveBeenCalledTimes(1);
    });
  });

  describe("caption visibility", () => {
    it("shows the caption for a node in no circle at all", () => {
      const node = makeNode({ nodeId: "a", text: "plain node" });
      renderNode({ node });
      expect(screen.getByText("plain node")).toBeInTheDocument();
    });

    it("prefers the node's title over its text when both are set", () => {
      const node = makeNode({ nodeId: "a", text: "the body text", title: "Short Title" });
      renderNode({ node });
      expect(screen.getByText("Short Title")).toBeInTheDocument();
      expect(screen.queryByText("the body text")).not.toBeInTheDocument();
    });

    it("hides the caption for an ordinary member of an un-chosen circle", () => {
      const node = makeNode({ nodeId: "a", text: "member text" });
      renderNode({ node, groupSentiment: "positive" });
      expect(screen.queryByText("member text")).not.toBeInTheDocument();
    });

    it("still shows the caption for the circle's own root/parent", () => {
      const node = makeNode({ nodeId: "a", text: "root text" });
      renderNode({ node, groupSentiment: "positive", parentCrownSentiment: "positive" });
      expect(screen.getByText("root text")).toBeInTheDocument();
    });

    it("shows every member's caption once its circle is the chosen one", () => {
      const node = makeNode({ nodeId: "a", text: "chosen member" });
      renderNode({ node, groupSentiment: "positive", inChosenCircle: true });
      expect(screen.getByText("chosen member")).toBeInTheDocument();
    });

    it("hides the caption entirely once the node itself is selected", () => {
      const node = makeNode({ nodeId: "a", text: "selected node" });
      renderNode({ node, selected: true });
      expect(screen.queryByText("selected node")).not.toBeInTheDocument();
    });

    it("shows nothing when there is no title and no text to show", () => {
      const node = makeNode({ nodeId: "a", text: "" });
      const { container } = renderNode({ node });
      // No caption chip rendered at all — only the icon markup is there.
      expect(container.textContent).toBe("");
    });
  });

  describe("inline editing", () => {
    it("shows an input pre-filled with the node's own text", () => {
      const node = makeNode({ nodeId: "a", text: "current text" });
      renderNode({ node, inlineEditing: true });
      expect(screen.getByRole("textbox")).toHaveValue("current text");
    });

    it("confirms with the trimmed, edited text on blur", async () => {
      const user = userEvent.setup();
      const onInlineConfirm = vi.fn();
      const node = makeNode({ nodeId: "a", text: "old text", type: "unknown" });
      renderNode({ node, inlineEditing: true, onInlineConfirm });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "  new text  ");
      await user.tab(); // blur

      expect(onInlineConfirm).toHaveBeenCalledWith("new text", "unknown");
    });

    it("cancels instead of confirming when the text comes back unchanged", async () => {
      const user = userEvent.setup();
      const onInlineCancel = vi.fn();
      const onInlineConfirm = vi.fn();
      const node = makeNode({ nodeId: "a", text: "same text", type: "unknown" });
      renderNode({ node, inlineEditing: true, onInlineCancel, onInlineConfirm });

      await user.tab(); // focus then blur without changing anything — actually just blur directly
      screen.getByRole("textbox").blur();

      expect(onInlineConfirm).not.toHaveBeenCalled();
      expect(onInlineCancel).toHaveBeenCalledTimes(1);
    });

    it("cancels (does not confirm) when Escape is pressed", async () => {
      const user = userEvent.setup();
      const onInlineCancel = vi.fn();
      const onInlineConfirm = vi.fn();
      const node = makeNode({ nodeId: "a", text: "some text", type: "unknown" });
      renderNode({ node, inlineEditing: true, onInlineCancel, onInlineConfirm });

      const input = screen.getByRole("textbox");
      await user.type(input, " more");
      await user.keyboard("{Escape}");

      expect(onInlineConfirm).not.toHaveBeenCalled();
      expect(onInlineCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("health ring visibility", () => {
    it("hints to select the node when health isn't showing (unselected)", () => {
      const node = makeNode({ nodeId: "a", text: "x" });
      const { container } = renderNode({ node, selected: false });
      expect(container.querySelector(`[title="${healthHint}"]`)).not.toBeNull();
    });

    it("shows no hint once selected in discussion mode — health is visible instead", () => {
      const node = makeNode({ nodeId: "a", text: "x" });
      const { container } = renderNode({ node, selected: true, discussionMode: true });
      expect(container.querySelector(`[title="${healthHint}"]`)).toBeNull();
    });

    it("keeps the hint even when selected in Personal mode — health never shows there", () => {
      const node = makeNode({ nodeId: "a", text: "x" });
      const { container } = renderNode({ node, selected: true, discussionMode: false });
      expect(container.querySelector(`[title="${healthHint}"]`)).not.toBeNull();
    });
  });
});

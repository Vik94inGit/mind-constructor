import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInlineEditDraft } from "./useInlineEditDraft";
import { makeNode } from "../test/fixtures";

function setup() {
  const onInlineConfirm = vi.fn();
  const onInlineCancel = vi.fn();
  const node = makeNode({ nodeId: "a", text: "Saved", type: "Problem" });
  const hook = renderHook(({ editing }) => useInlineEditDraft({ node, inlineEditing: editing, onInlineConfirm, onInlineCancel }), {
    initialProps: { editing: true },
  });
  return { ...hook, onInlineConfirm, onInlineCancel };
}

describe("useInlineEditDraft", () => {
  it("confirms a changed, trimmed draft", () => {
    const { result, onInlineConfirm } = setup();
    act(() => result.current.setDraftText("  New text  "));
    act(() => result.current.resolveInlineEdit());
    expect(onInlineConfirm).toHaveBeenCalledWith("New text", "Problem");
  });

  it("confirms a type-only change", () => {
    const { result, onInlineConfirm } = setup();
    act(() => result.current.setDraftType("Solution"));
    act(() => result.current.resolveInlineEdit());
    expect(onInlineConfirm).toHaveBeenCalledWith("Saved", "Solution");
  });

  it("cancels an empty or unchanged draft", () => {
    const { result, onInlineConfirm, onInlineCancel } = setup();
    act(() => result.current.resolveInlineEdit());
    act(() => result.current.setDraftText("   "));
    act(() => result.current.resolveInlineEdit());
    expect(onInlineCancel).toHaveBeenCalledTimes(2);
    expect(onInlineConfirm).not.toHaveBeenCalled();
  });

  it("cancels after Escape even with a changed draft, then resets", () => {
    const { result, onInlineConfirm, onInlineCancel } = setup();
    act(() => result.current.setDraftText("Changed"));
    act(() => result.current.markCanceling());
    act(() => result.current.resolveInlineEdit());
    expect(onInlineCancel).toHaveBeenCalledTimes(1);
    expect(onInlineConfirm).not.toHaveBeenCalled();
    act(() => result.current.resolveInlineEdit());
    expect(onInlineConfirm).toHaveBeenCalledWith("Changed", "Problem");
  });

  it("starts each edit from what's saved", () => {
    const { result, rerender } = setup();
    act(() => result.current.setDraftText("Half typed"));
    rerender({ editing: false });
    rerender({ editing: true });
    expect(result.current.draftText).toBe("Saved");
  });
});

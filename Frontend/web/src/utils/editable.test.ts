import { describe, expect, it } from "vitest";
import { clipboardHasText, isEditableTarget } from "./editable";

function clipboard(items: Record<string, string>): DataTransfer {
  return { getData: (type: string) => items[type] ?? "" } as unknown as DataTransfer;
}

describe("isEditableTarget", () => {
  it("is true for text fields", () => {
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("clipboardHasText", () => {
  it("sees words on the clipboard", () => {
    expect(clipboardHasText(clipboard({ "text/plain": "a thought" }))).toBe(true);
  });

  it("is false for a bare picture or blank text", () => {
    expect(clipboardHasText(clipboard({}))).toBe(false);
    expect(clipboardHasText(clipboard({ "text/plain": "  \n" }))).toBe(false);
    expect(clipboardHasText(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { canvasTapOpensMenu, type CanvasTapState } from "./canvasTapMenu";

const idle: CanvasTapState = { pointerType: "touch", somethingOpen: false, busyMode: false, entranceActive: false, canEdit: true };

describe("canvasTapOpensMenu", () => {
  it("opens on a finger or pen tap with nothing open", () => {
    expect(canvasTapOpensMenu(idle)).toBe(true);
    expect(canvasTapOpensMenu({ ...idle, pointerType: "pen" })).toBe(true);
  });

  it("leaves a mouse to its right-click", () => {
    expect(canvasTapOpensMenu({ ...idle, pointerType: "mouse" })).toBe(false);
  });

  it("only closes what is open", () => {
    expect(canvasTapOpensMenu({ ...idle, somethingOpen: true })).toBe(false);
  });

  it("stays out of modes, the entrance, and maps the viewer can't change", () => {
    expect(canvasTapOpensMenu({ ...idle, busyMode: true })).toBe(false);
    expect(canvasTapOpensMenu({ ...idle, entranceActive: true })).toBe(false);
    expect(canvasTapOpensMenu({ ...idle, canEdit: false })).toBe(false);
  });
});

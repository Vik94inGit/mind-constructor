import { describe, expect, it } from "vitest";
import { mapBackgroundStyle } from "./mapBackground";

describe("mapBackgroundStyle", () => {
  it("draws the dot grid when the map never picked a background", () => {
    expect(mapBackgroundStyle(null)).toEqual(mapBackgroundStyle("dots"));
    expect(mapBackgroundStyle(undefined).style.backgroundImage).toContain("radial-gradient");
  });

  it("draws nothing over the paper for plain, ruled lines for lined", () => {
    expect(mapBackgroundStyle("plain").style.backgroundImage).toBeUndefined();
    expect(mapBackgroundStyle("lined").style.backgroundImage).toContain("linear-gradient");
  });

  it("switches the canvas to dark colours for soft dark", () => {
    expect(mapBackgroundStyle("dark").className).toBe("canvas-soft-dark");
    expect(mapBackgroundStyle("dots").className).toBe("");
  });

  it("tints the paper softly with a picked colour, keeping the pattern", () => {
    const tinted = mapBackgroundStyle("lined", "sage");
    expect(tinted.style.backgroundColor).toBe("color-mix(in srgb, #6f9e74 14%, var(--paper))");
    expect(tinted.style.backgroundImage).toBe(mapBackgroundStyle("lined").style.backgroundImage);
    expect(mapBackgroundStyle("plain", null).style.backgroundColor).toBe("var(--paper)");
  });
});

import { describe, expect, it } from "vitest";
import { mapBackgroundStyle, shadeLayer } from "./mapBackground";

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

  it("lays an uploaded picture under a veil of the paper, the pattern on top", () => {
    const { style } = mapBackgroundStyle("dots", null, "data:image/webp;base64,AAAA");
    const layers = String(style.backgroundImage);
    expect(layers.indexOf("radial-gradient")).toBeLessThan(layers.indexOf("linear-gradient"));
    expect(layers).toContain("color-mix(in srgb, var(--paper) 60%, transparent)");
    expect(layers).toContain('url("data:image/webp;base64,AAAA")');
    expect(style.backgroundSize).toBe("22px 22px, auto, cover");

    const plain = mapBackgroundStyle("plain", "sky", "data:image/png;base64,BBBB").style;
    expect(String(plain.backgroundImage).startsWith("linear-gradient(color-mix(in srgb, color-mix(in srgb, #5d8fcf 14%")).toBe(true);
    expect(plain.backgroundSize).toBe("auto, cover");
  });

  it("darkens or lightens the picture over its veil, and leaves it as it is at 0", () => {
    expect(shadeLayer(0)).toBeNull();
    expect(shadeLayer(undefined)).toBeNull();
    expect(shadeLayer(-50)).toBe("linear-gradient(color-mix(in srgb, #000 40%, transparent), color-mix(in srgb, #000 40%, transparent))");
    expect(shadeLayer(100)).toContain("#fff 80%");
    expect(shadeLayer(500)).toContain("#fff 80%");

    const { style } = mapBackgroundStyle("dots", null, "data:image/webp;base64,AAAA", 30);
    const layers = String(style.backgroundImage);
    expect(layers.indexOf("#fff 24%")).toBeLessThan(layers.indexOf("var(--paper) 60%"));
    expect(style.backgroundSize).toBe("22px 22px, auto, auto, cover");
    expect(style.backgroundRepeat).toBe("repeat, no-repeat, no-repeat, no-repeat");
    expect(mapBackgroundStyle("plain", null, "data:image/webp;base64,AAAA", -30).style.backgroundSize).toBe("auto, auto, cover");
  });

  it("marks a canvas with a picture for higher-contrast icons, and only then", () => {
    expect(mapBackgroundStyle("dots", null, "data:image/webp;base64,AAAA").className).toBe("canvas-on-picture");
    expect(mapBackgroundStyle("dark", null, "data:image/webp;base64,AAAA").className).toBe("canvas-soft-dark canvas-on-picture");
    expect(mapBackgroundStyle("dots", "sage").className).toBe("");
    expect(mapBackgroundStyle("dark").className).toBe("canvas-soft-dark");
  });
});

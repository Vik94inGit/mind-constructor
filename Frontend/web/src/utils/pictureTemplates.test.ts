import { describe, expect, it } from "vitest";
import { PICTURES, TYPE_PICTURE_KINDS } from "./pictures";
import { pictureTemplateFile, pictureTemplateSrc, pictureTemplateSvg, templateKindsFor } from "./pictureTemplates";

describe("templateKindsFor", () => {
  it("puts the node's own type first, then every other type once", () => {
    const kinds = templateKindsFor("Problem");
    expect(kinds[0]).toBe("stop");
    expect([...kinds].sort()).toEqual([...TYPE_PICTURE_KINDS].sort());
  });

  it("keeps the usual order with no type", () => {
    expect(templateKindsFor()).toEqual([...TYPE_PICTURE_KINDS]);
  });
});

describe("pictureTemplateSvg", () => {
  it("draws every dot and path in the picture's colour, with no text", () => {
    const svg = pictureTemplateSvg("bulb", 200);
    expect(svg).toContain('width="200"');
    expect(svg.match(/<circle /g)).toHaveLength(PICTURES.bulb.dots.length);
    expect(svg.match(/<polygon |<polyline /g)).toHaveLength(PICTURES.bulb.paths.length);
    expect(svg).toContain(PICTURES.bulb.color);
    expect(svg).not.toContain("<text");
  });

  it("fills a closed outline and leaves an open line unfilled", () => {
    const svg = pictureTemplateSvg("bulb");
    expect(svg).toContain("<polygon ");
    expect(svg).toContain('<polyline points="');
  });

  it("keeps every dot inside the square", () => {
    for (const kind of TYPE_PICTURE_KINDS) {
      const svg = pictureTemplateSvg(kind, 100);
      for (const m of svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0);
        expect(Number(m[1])).toBeLessThanOrEqual(100);
        expect(Number(m[2])).toBeGreaterThanOrEqual(0);
        expect(Number(m[2])).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("template as src and file", () => {
  it("is an SVG data URL for the thumbnail", () => {
    expect(pictureTemplateSrc("key").startsWith("data:image/svg+xml")).toBe(true);
  });

  it("is an SVG file to add to a node", () => {
    const file = pictureTemplateFile("flag");
    expect(file.type).toBe("image/svg+xml");
    expect(file.name).toBe("flag.svg");
  });
});

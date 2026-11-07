import { describe, expect, it, vi } from "vitest";
import { MAP_KIND_PICTURES, PICTURE_TEMPLATES, pickMapKindPicture, pictureTemplateFile, pictureTemplateThumb, pictureTemplateUrl } from "./pictureTemplates";

describe("picture templates", () => {
  it("offers the ten paintings, each once", () => {
    expect(PICTURE_TEMPLATES).toHaveLength(10);
    expect(new Set(PICTURE_TEMPLATES).size).toBe(10);
  });

  it("has a thumbnail and a full painting for each", () => {
    for (const kind of PICTURE_TEMPLATES) {
      expect(pictureTemplateThumb(kind)).toBeTruthy();
      expect(pictureTemplateUrl(kind)).toMatch(/^\/picture-templates\/[a-z-]+\.webp$/);
    }
  });

  it("fetches the full painting as a WebP file", async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(["x"], { type: "image/webp" }))) as unknown as typeof fetch;
    const file = await pictureTemplateFile("heartMirror", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/picture-templates/heart-mirror.webp");
    expect(file.type).toBe("image/webp");
    expect(file.name).toBe("heart-mirror.webp");
  });

  it("rejects when the painting can't be fetched", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(pictureTemplateFile("eyes", fetcher)).rejects.toThrow();
  });
});

describe("structure pictures", () => {
  it("gives each starting point its own painting", () => {
    expect(pickMapKindPicture("idea")).toBe("lightbulb");
    expect(pickMapKindPicture("problem")).toBe("puppet");
    expect(pickMapKindPicture("decision")).toBe("yoyo");
  });

  it("picks a retrospective's and a plan's painting at random", () => {
    expect(pickMapKindPicture("retro", () => 0)).toBe("heartMirror");
    expect(pickMapKindPicture("retro", () => 0.99)).toBe("clockHeads");
    expect(pickMapKindPicture("goal", () => 0)).toBe("clockJuice");
    expect(pickMapKindPicture("goal", () => 0.5)).toBe("orangeClock");
    expect(pickMapKindPicture("goal", () => 0.999)).toBe("fishing");
  });

  it("only offers paintings that exist", () => {
    for (const list of Object.values(MAP_KIND_PICTURES)) for (const p of list) expect(PICTURE_TEMPLATES).toContain(p);
  });
});

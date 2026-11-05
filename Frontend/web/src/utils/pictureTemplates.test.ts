import { describe, expect, it, vi } from "vitest";
import { PICTURE_TEMPLATES, pictureTemplateFile, pictureTemplateThumb, pictureTemplateUrl } from "./pictureTemplates";

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

import { describe, expect, it } from "vitest";
import { imageSrc } from "./images";

describe("imageSrc", () => {
  it("sends a stored picture's address to the backend like an API request", () => {
    expect(imageSrc("/api/images/abc123def456")).toMatch(/\/api\/images\/abc123def456$/);
  });

  it("uses an inline data URL as is", () => {
    const jpeg = "data:image/jpeg;base64,/9j/4AAQ";
    expect(imageSrc(jpeg)).toBe(jpeg);
  });
});

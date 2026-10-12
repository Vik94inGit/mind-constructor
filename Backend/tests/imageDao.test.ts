import { describe, beforeEach, it, expect, vi } from "vitest";
import { Image } from "../src/models/Image.js";
import { fileStorageEnabled, putFile, getFile, deleteFiles } from "../src/config/fileStorage.js";
import { createImageDao, readImageDataDao, deleteImagesByMapDao } from "../src/dao/imageDao.js";

vi.mock("../src/models/Image.js", () => ({
  IMAGE_URL_PREFIX: "/api/images/",
  Image: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("../src/config/fileStorage.js", () => ({
  fileStorageEnabled: vi.fn(),
  putFile: vi.fn(),
  getFile: vi.fn(),
  deleteFiles: vi.fn(),
}));

const bytes = Buffer.from([1, 2, 3]);
const fields = { mapId: "m1", nodeId: "n1", userId: "u1", mime: "image/png", data: bytes };

describe("imageDao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts a picture in the bucket when file storage is on, keeping only its key in MongoDB", async () => {
    vi.mocked(fileStorageEnabled).mockReturnValue(true);
    const url = await createImageDao(fields);
    const imageId = url.slice("/api/images/".length);
    expect(putFile).toHaveBeenCalledWith(`images/${imageId}`, bytes, "image/png");
    expect(Image.create).toHaveBeenCalledWith({
      imageId, mapId: "m1", nodeId: "n1", userId: "u1", mime: "image/png", storageKey: `images/${imageId}`,
    });
  });

  it("keeps the bytes in MongoDB when no bucket is configured", async () => {
    vi.mocked(fileStorageEnabled).mockReturnValue(false);
    await createImageDao(fields);
    expect(putFile).not.toHaveBeenCalled();
    expect(Image.create).toHaveBeenCalledWith(expect.objectContaining({ data: bytes }));
  });

  it("reads a picture's bytes from wherever they are kept", async () => {
    vi.mocked(getFile).mockResolvedValue(bytes);
    expect(await readImageDataDao({ _id: "i1", storageKey: "images/a" })).toBe(bytes);
    vi.mocked(Image.findById).mockResolvedValue({ data: bytes } as never);
    expect(await readImageDataDao({ _id: "i1", storageKey: null })).toBe(bytes);
  });

  it("deletes the bucket files along with the pictures", async () => {
    vi.mocked(Image.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([{ storageKey: "images/a" }]) } as never);
    await deleteImagesByMapDao("m1");
    expect(Image.find).toHaveBeenCalledWith({ mapId: "m1", storageKey: { $ne: null } }, "storageKey");
    expect(deleteFiles).toHaveBeenCalledWith(["images/a"]);
    expect(Image.deleteMany).toHaveBeenCalledWith({ mapId: "m1" });
  });
});

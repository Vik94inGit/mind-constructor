import { describe, expect, it, vi } from "vitest";
import { addStructurePicture } from "./structurePicture";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({ updateNode: vi.fn() }));

describe("addStructurePicture", () => {
  it("adds the kind's painting as the root's picture and picture card", async () => {
    const fetchFile = vi.fn(async () => new File(["x"], "goal-cake.webp", { type: "image/webp" }));
    const update = vi.fn(async (nodeId: string) => ({ nodeId }) as NodeDoc);
    const node = await addStructurePicture("n1", "goal", {
      random: () => 0.99,
      fetchFile,
      shrink: async () => "data:image/webp;base64,big",
      makeCard: async () => "data:image/jpeg;base64,card",
      update,
    });
    expect(fetchFile).toHaveBeenCalledWith("goalCake");
    expect(update).toHaveBeenCalledWith("n1", { images: ["data:image/webp;base64,big"], cardImage: "data:image/jpeg;base64,card" });
    expect(node).toEqual({ nodeId: "n1" });
  });

  it("leaves the node alone when the painting can't be fetched", async () => {
    const update = vi.fn();
    const node = await addStructurePicture("n1", "idea", {
      fetchFile: async () => {
        throw new Error("offline");
      },
      update,
    });
    expect(node).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

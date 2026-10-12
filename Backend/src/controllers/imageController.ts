import type { Request, Response } from "express";
import { getImageAbl } from "../abl/imageAbl.js";
import { handleAblError } from "./errorHandling.js";

// GET /api/images/:imageId — a node's stored picture, as the image itself
// (not JSON), so a frontend can put its address straight into an <img>.
export const getImage = async (req: Request<{ imageId: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });

    const image = await getImageAbl(req.params.imageId, userId);
    if (!image) return res.status(404).json({ success: false, error: "Image not found" });

    // A stored picture never changes (a new one gets a new id), so the
    // browser may keep it as long as it likes — privately, since it's only
    // for members of the map.
    res.set("Content-Type", image.mime);
    res.set("Cache-Control", "private, max-age=31536000, immutable");
    res.set("X-Content-Type-Options", "nosniff");
    return res.status(200).send(Buffer.from(image.data));
  } catch (error) {
    return handleAblError(res, error, [], { message: "Internal Server Error", logLabel: "getImage" });
  }
};

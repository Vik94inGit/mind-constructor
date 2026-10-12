import { Router } from "express";
import { getImage } from "../controllers/imageController.js";
import { protect } from "#src/middleware/auth.js";

const router = Router();
router.get<{ imageId: string }>("/:imageId", protect, getImage);

export default router;

import mongoose from "mongoose";

// A node's picture, kept in its own collection rather than inline on the
// Node document: the node stores only the picture's address
// (IMAGE_URL_PREFIX + imageId), so node documents, the map's node list and
// every realtime node event stay small however many pictures a map holds.
// Served by GET /api/images/:imageId (imageController.ts) to members of the
// map who may see the node. Removed with its node (nodeDao.ts's cascade),
// with its map (deleteMapDao), or as soon as the node stops pointing at it
// (nodeAbl.ts's updateNodeAbl).
export const IMAGE_URL_PREFIX = "/api/images/";
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

const ImageSchema = new mongoose.Schema(
  {
    imageId: { type: String, required: true, unique: true }, // public id, nanoid — same pattern as Map/Node/Edge
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // who added it
    mime: { type: String, enum: IMAGE_MIME_TYPES, required: true },
    // The decoded bytes — a quarter smaller than the base64 data URL a
    // frontend sends.
    data: { type: Buffer, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        delete ret.data;
        return ret;
      },
    },
  },
);

// nodeId: the cleanup after a node edit or delete; mapId: deleteMapDao.
ImageSchema.index({ nodeId: 1 });
ImageSchema.index({ mapId: 1 });

export const Image = mongoose.model("Image", ImageSchema);

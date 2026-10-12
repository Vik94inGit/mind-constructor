// One-off CLI tool, safe to run more than once:
//  1. moves pictures saved before the image store existed (data URLs inline
//     on Node.images / iconImage / cardImage) into the image store
//     (models/Image.ts), leaving each node with just their addresses;
//  2. once a file storage bucket is configured (config/fileStorage.ts), moves
//     pictures whose bytes are still in MongoDB into the bucket.
// Pictures keep showing without it, wherever they are, so this only frees
// database space.
//
// Usage: npm run images:move

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Node } from "../src/models/Node.js";
import { Image } from "../src/models/Image.js";
import { storeImageFields } from "../src/abl/nodeAbl.js";
import { fileStorageEnabled, putFile } from "../src/config/fileStorage.js";

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing!");
  await mongoose.connect(process.env.MONGO_URI);

  const inline = /^data:/;
  const cursor = Node.find(
    { $or: [{ images: inline }, { iconImage: inline }, { cardImage: inline }] },
    "_id mapId userId images iconImage cardImage",
  ).cursor();

  let moved = 0;
  for await (const node of cursor) {
    const updates: Record<string, unknown> = {
      images: node.images,
      iconImage: node.iconImage,
      cardImage: node.cardImage,
    };
    await storeImageFields(updates, node, node.userId.toString());
    await Node.updateOne({ _id: node._id }, { $set: updates });
    moved++;
  }

  console.log(`Moved the pictures of ${moved} node(s) into the image store.`);

  if (!fileStorageEnabled()) {
    console.log("No file storage bucket configured (S3_BUCKET etc.), so pictures stay in MongoDB.");
  } else {
    let uploaded = 0;
    for await (const image of Image.find({ storageKey: null, data: { $ne: null } }).cursor()) {
      const storageKey = `images/${image.imageId}`;
      await putFile(storageKey, image.data as Buffer, image.mime);
      await Image.updateOne({ _id: image._id }, { $set: { storageKey }, $unset: { data: 1 } });
      uploaded++;
    }
    console.log(`Moved ${uploaded} picture(s) from MongoDB into the file storage bucket.`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

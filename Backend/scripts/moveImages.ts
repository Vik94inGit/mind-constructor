// One-off CLI tool: move pictures saved before the image store existed
// (data URLs inline on Node.images / iconImage / cardImage) into the image
// store (models/Image.ts), leaving each node with just their addresses.
// Safe to run more than once: a node with nothing inline left is skipped.
// Pictures saved inline keep showing without it — the frontend draws either
// kind — so this only shrinks the database and the map's node list.
//
// Usage: npm run images:move

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Node } from "../src/models/Node.js";
import { storeImageFields } from "../src/abl/nodeAbl.js";

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
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

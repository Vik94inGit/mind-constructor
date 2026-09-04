// One-off CLI tool: report how much storage the database is actually using.
// Handy for keeping an eye on a free-tier cluster's cap (e.g. Atlas M0 is
// 512 MB) without needing to log into the provider's dashboard.
//
// Usage: npm run db:stats

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

function toMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing!");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active database connection");

  const stats = await db.stats();
  const totalUsed = stats.storageSize + stats.indexSize;

  console.log(`Database: ${stats.db}`);
  console.log(`Collections: ${stats.collections}  |  Documents: ${stats.objects}`);
  console.log("");
  console.log(`Data size:     ${toMB(stats.dataSize)} MB  (raw document data)`);
  console.log(`Storage size:  ${toMB(stats.storageSize)} MB  (data + allocation overhead)`);
  console.log(`Index size:    ${toMB(stats.indexSize)} MB`);
  console.log(`------------------------------------`);
  console.log(`Total used:    ${toMB(totalUsed)} MB  (storage + indexes — what a tier cap counts)`);
  console.log("");
  console.log("For reference, common Atlas free/low-tier caps: M0 = 512 MB, M2 = 2 GB, M5 = 5 GB.");

  // Per-collection breakdown, biggest first — useful for spotting what's
  // actually eating the quota (e.g. stale weapon-node/attack history).
  const collections = await db.listCollections().toArray();
  const perCollection = await Promise.all(
    collections.map(async (c) => {
      const s = await db.command({ collStats: c.name });
      return { name: c.name, storageSize: s.storageSize as number, count: s.count as number };
    }),
  );
  perCollection.sort((a, b) => b.storageSize - a.storageSize);

  console.log("\nBy collection:");
  for (const c of perCollection) {
    console.log(`  ${c.name.padEnd(20)} ${toMB(c.storageSize).padStart(8)} MB   (${c.count} docs)`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// One-off CLI tool: promote a user to admin by email.
// There's no in-app "make me admin" endpoint on purpose — self-promotion
// would be a privilege-escalation hole. This script is the intended way to
// mint the first (and any later) admin: run it locally against the same
// database the app uses.
//
// Usage: npm run admin:promote -- someone@example.com

import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

dotenv.config();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run admin:promote -- someone@example.com");
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing!");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOneAndUpdate(
    { email },
    { role: "admin" },
    { new: true },
  );

  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${user.username} (${user.email}) is now an admin`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

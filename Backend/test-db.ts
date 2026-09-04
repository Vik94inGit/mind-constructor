import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI not found!");
  process.exit(1);
}

console.log("Trying to connect to:", MONGO_URI);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("SUCCESS: Connected to MongoDB!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("FAILED to connect:");
    console.error(err);
    process.exit(1);
  });

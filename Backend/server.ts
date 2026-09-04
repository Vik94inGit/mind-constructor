import dotenv from "dotenv";
dotenv.config();
import express from "express";
import http from "http";

import type { Express, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./src/routes/authRoutes.js";
import mapRoute from "./src/routes/mapRoute.js";
import nodeRoute from "./src/routes/nodeRoute.js";
import edgeRoute from "./src/routes/edgeRoute.js";
import { initRealtime } from "./src/realtime/io.js";

console.log(
  "Checking MONGO_URI:",
  process.env.MONGO_URI ? "FOUND" : "NOT FOUND",
);

const app: Express = express();
app.get("/__debug", (req, res) => {
  console.log("🔥🔥🔥 DEBUG ENDPOINT HIT 🔥🔥🔥");
  res.status(200).json({
    server: "THIS IS MY EXPRESS SERVER",
    port: PORT,
  });
});
const PORT: number = Number(process.env.PORT) || 3000;

console.log("DEBUG: Script is starting...");

app.use((req, res, next) => {
  console.log(`[EXPRESS] ${req.method} ${req.originalUrl}`);
  next();
});

// CORS_ORIGIN restricts the API to specific frontend origin(s) in production
// (comma-separated, e.g. "https://my-app.vercel.app"). Left unset, both this
// and Socket.IO's own cors (src/realtime/io.ts) stay wide open, which is
// fine for local dev but should be narrowed once a frontend domain exists.
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/nodes", nodeRoute);
app.use("/api/edges", edgeRoute);
app.use("/api", mapRoute);

// Socket.IO attaches to the same HTTP server Express listens on — one
// port, both the REST API and the websocket upgrade.
const httpServer = http.createServer(app);
initRealtime(httpServer);

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing!");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB Connected");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Critical Failure:", err);
    process.exit(1);
  }
}

const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMainModule || process.env.NODE_ENV !== "test") {
  run();
}

// Export the app for testing
export { app };

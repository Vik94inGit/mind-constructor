// Live sync for a map: every viewer who has the map open joins a Socket.IO
// room keyed by the map's *public* id (the internal Mongo _id never leaves
// the server, same rule the REST API follows everywhere else). Controllers
// call broadcastToMap() right after a mutation commits, so every other
// open tab sees the same node/edge/attack update the actor's own tab does
// from its optimistic local state — without polling.
import type { Server as HTTPServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { findUserByIdDao } from "../dao/userDao.js";
import { getMapByIdDao } from "../dao/mapsDao.js";
import { anyPublicNodeHiddenDao } from "../dao/visibilityDao.js";

let io: SocketIOServer | null = null;

const roomFor = (publicMapId: string) => `map:${publicMapId}`;
// The map owner also sits in this room, which gets the events about branches hidden from everyone else.
const ownerRoomFor = (publicMapId: string) => `map:${publicMapId}:owner`;

export function initRealtime(httpServer: HTTPServer): SocketIOServer {
  // Mirrors the REST API's own cors() in server.ts: CORS_ORIGIN (comma-
  // separated) narrows both to a specific frontend domain in production;
  // unset, both stay wide open ("*"), which is fine for local dev.
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins ?? "*" },
  });

  // Same JWT the REST `protect` middleware checks — a socket that never
  // sends a valid token never finishes connecting.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Not authorized – no token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
      const user = await findUserByIdDao(decoded.id);
      if (!user || user.isBlocked) return next(new Error("Not authorized"));

      socket.data.userId = user._id.toString();
      next();
    } catch {
      next(new Error("Not authorized – invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    // A tab can have several maps open across its lifetime (navigating
    // the dashboard, back to a map, a different map) — join/leave per map
    // rather than binding a whole connection to one room.
    socket.on("join-map", async (publicMapId: string, ack?: (ok: boolean) => void) => {
      const userId = socket.data.userId as string;
      if (typeof publicMapId !== "string" || !publicMapId) return ack?.(false);

      // Same membership check the REST endpoints use — a non-member can't
      // listen in on a map's live updates any more than they could GET it.
      const map = await getMapByIdDao(publicMapId, userId);
      if (!map) return ack?.(false);

      socket.join(roomFor(publicMapId));
      if (map.ownerId.toString() === userId) socket.join(ownerRoomFor(publicMapId));
      ack?.(true);
    });

    socket.on("leave-map", (publicMapId: string) => {
      if (typeof publicMapId === "string") {
        socket.leave(roomFor(publicMapId));
        socket.leave(ownerRoomFor(publicMapId));
      }
    });
  });

  return io;
}

// Every public node id mentioned in a payload (a node, an edge's two ends, an
// attack's target and weapon node, …) — what decides whether the event is
// about a branch hidden from invited members.
function collectNodeIds(value: unknown, out: Set<string>, depth = 0) {
  if (!value || typeof value !== "object" || depth > 3) return;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key === "nodeId" && typeof v === "string") out.add(v);
    else if (v && typeof v === "object") collectNodeIds(v, out, depth + 1);
  }
}

// One queue per map, so events reach clients in the order they were emitted
// even though deciding who may see each one takes a database lookup.
const queues = new Map<string, Promise<void>>();

// Courtesy layer, never load-bearing: a controller's REST response is
// already correct on its own, so a missing/uninitialized `io` (e.g. under
// the test app, which never calls initRealtime) is a silent no-op rather
// than a thrown error. An event about a node in a branch the owner has hidden
// goes to the owner alone; everything else goes to the whole map.
export function broadcastToMap(publicMapId: string, event: string, payload: unknown) {
  if (!io) return;
  const next = (queues.get(publicMapId) ?? Promise.resolve()).then(async () => {
    const ids = new Set<string>();
    collectNodeIds(payload, ids);
    let hidden = false;
    try {
      hidden = await anyPublicNodeHiddenDao(publicMapId, ids);
    } catch {
      // if the check fails, err on the side of not leaking
      hidden = ids.size > 0;
    }
    io?.to(hidden ? ownerRoomFor(publicMapId) : roomFor(publicMapId)).emit(event, payload);
  });
  queues.set(publicMapId, next);
  void next.finally(() => {
    if (queues.get(publicMapId) === next) queues.delete(publicMapId);
  });
}

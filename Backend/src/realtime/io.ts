// Live sync for a map: every viewer who has the map open joins a Socket.IO
// room keyed by the map's *public* id (the internal Mongo _id never leaves
// the server, same rule the REST API follows everywhere else). Controllers
// call broadcastToMap() right after a mutation commits, so every other
// open tab sees the same node/edge/attack update the actor's own tab does
// from its optimistic local state — without polling.
import type { Server as HTTPServer } from "http";
import type { RequestHandler } from "express";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { findUserByIdDao } from "../dao/userDao.js";
import { getMapByIdDao } from "../dao/mapsDao.js";
import { anyPublicNodeHiddenDao } from "../dao/visibilityDao.js";
import { verifySocketToken } from "./socketToken.js";

let io: SocketIOServer | null = null;

const roomFor = (publicMapId: string) => `map:${publicMapId}`;
// The map owner also sits in this room, which gets the events about branches hidden from everyone else.
const ownerRoomFor = (publicMapId: string) => `map:${publicMapId}:owner`;

// sessionMiddleware: the *same* express-session instance server.ts builds
// and mounts on the REST API — sharing it (rather than each side building
// its own) is what lets a browser's mc_sid cookie authenticate the socket
// handshake against the same Redis-backed session store the REST API reads.
export function initRealtime(httpServer: HTTPServer, sessionMiddleware: RequestHandler): SocketIOServer {
  // Mirrors the REST API's own cors() in server.ts: CORS_ORIGIN (comma-
  // separated) narrows both to a specific frontend domain in production;
  // unset, both stay wide open ("*"), which is fine for local dev.
  // credentials: true is required too — without it the handshake's
  // polling/XHR requests won't carry the session cookie cross-site even
  // with the client's own withCredentials: true.
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins ?? "*", credentials: true },
  });

  // Runs sessionMiddleware against the handshake's underlying HTTP request,
  // so socket.request.session below is the same session object protect()
  // reads for a plain REST call — the documented way to share an Express
  // session with Socket.IO (io.engine.use, available since Socket.IO 4.6+).
  io.engine.use(sessionMiddleware);

  io.use(async (socket, next) => {
    try {
      // The session cookie when the browser sent one; otherwise the
      // short-lived token the client fetched over the same-origin REST API
      // (GET /api/auth/socket-token) — Safari never sends the cookie on this
      // cross-site connection. See socketToken.ts.
      const userId =
        (socket.request as { session?: { userId?: string } }).session?.userId ??
        verifySocketToken(socket.handshake.auth?.token, process.env.SESSION_SECRET as string);
      if (!userId) return next(new Error("Not authorized – no session"));

      const user = await findUserByIdDao(userId);
      if (!user || user.isBlocked) return next(new Error("Not authorized"));

      socket.data.userId = user._id.toString();
      next();
    } catch {
      next(new Error("Not authorized"));
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

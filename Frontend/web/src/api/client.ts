import * as offline from "../offline/sync";
import { NetworkError } from "../offline/sync";

// Empty by default in production — requests go out as same-origin relative
// paths, routed through vercel.json's /api/(.*) rewrite to the Render
// backend, so the session cookie reads as first-party rather than a
// cross-site one for the bulk of the app's traffic. Local dev sets
// VITE_API_URL explicitly (see .env.example) since there's no such proxy
// running locally.
//
// A production build ignores VITE_API_URL unless VITE_API_DIRECT is "true":
// pointing REST straight at the backend's own domain makes the session cookie
// third-party, which Safari (iPhone, iPad and Mac) blocks outright — signing
// in "works", then every request after it fails as "Not authorized". Chrome
// still allowed it, which is how that setting could go unnoticed.
const API_URL: string =
  import.meta.env.PROD && import.meta.env.VITE_API_DIRECT !== "true" ? "" : import.meta.env.VITE_API_URL || "";

// The one map a demo session (see api/auth.ts's tryDemo) is ever allowed
// onto — ProtectedRoute reads this to bounce a demo user's own dashboard/
// home requests straight back to it instead.
const DEMO_MAP_ID_KEY = "mc_demo_map_id";

export const getDemoMapId = (): string | null => localStorage.getItem(DEMO_MAP_ID_KEY);
export const setDemoMapId = (mapId: string): void => localStorage.setItem(DEMO_MAP_ID_KEY, mapId);
export const clearDemoMapId = (): void => localStorage.removeItem(DEMO_MAP_ID_KEY);

export class ApiRequestError extends Error {
  status: number;
  payload: any;
  readyAt?: string;
  constructor(status: number, message: string, payload?: any) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.readyAt = payload?.readyAt;
  }
}

export const OFFLINE_MESSAGE = "You're offline — this needs a connection to the server.";
const NOT_SYNCED_MESSAGE = "This was made offline and isn't saved on the server yet — try again once it has synced.";

export interface OfflineAnswer<T> {
  /** What the server would most likely have answered — returned now, while the request waits in the outbox. */
  optimistic: () => T | Promise<T>;
  /** For a create: the temporary id `optimistic` hands out… */
  localId?: string;
  /** …and where the server's real id sits in its reply (e.g. "nodeId", "folder.folderId"). */
  idKey?: string;
  /** Fold into a request to the same path queued just before (a drag's stream of moves becomes one). */
  merge?: boolean;
  /** Not something the user did on purpose (a scroll position, a preference): synced without being counted as a change. */
  quiet?: boolean;
}

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** A change that can be made offline (see offline/sync.ts). Without it, a change fails while offline. */
  offline?: OfflineAnswer<T>;
  /** GET only: false skips the offline copy (a one-time token, say). */
  cache?: boolean;
}

// The one place a request actually goes out — also what offline/sync.ts uses
// to send queued changes. Throws NetworkError only when the server was never
// reached; any HTTP answer, error or not, comes back as { status, payload }.
async function send(method: string, path: string, body: unknown): Promise<{ status: number; payload: any }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      // The session lives in an httpOnly cookie now, not a header this code
      // attaches itself — "include" is what makes the browser actually send
      // (and accept Set-Cookie for) it, on both the same-origin proxied path
      // and any request that stays cross-site.
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError("unreachable");
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;
  return { status: res.status, payload };
}

offline.setTransport(send);

function toError(status: number, payload: any): ApiRequestError {
  if (status === 401) {
    // The cookie itself is httpOnly — nothing here to clear. The one
    // piece of frontend-owned state tied to "was logged in" is this.
    clearDemoMapId();
  }
  const message = payload?.error || `Request failed (${status})`;
  return new ApiRequestError(status, message, payload);
}

export async function apiRequest<T>(path: string, opts: RequestOptions<T> = {}): Promise<T> {
  const { method = "GET", body, offline: offlineAnswer, cache = true } = opts;
  await offline.ready();

  if (method === "GET") return getWithCache<T>(path, cache);

  const queue = async (): Promise<T> => {
    // Kept as written: temporary ids are swapped for real ones when it's sent.
    await offline.enqueue(method, path, body, {
      localId: offlineAnswer!.localId,
      idKey: offlineAnswer!.idKey,
      merge: offlineAnswer!.merge,
      quiet: offlineAnswer!.quiet,
    });
    return offlineAnswer!.optimistic();
  };

  // Behind earlier offline changes (or offline outright): wait in line, so
  // the server sees everything in the order it was done.
  if (offlineAnswer && offline.getOfflineUserId() && (offline.pendingCount() > 0 || !offline.isOnline())) {
    return queue();
  }

  const realPath = offline.remapPath(path);
  const realBody = offline.remapBody(body);
  if (offline.hasUnsyncedId(realPath, realBody)) throw new ApiRequestError(0, NOT_SYNCED_MESSAGE);

  let res: { status: number; payload: any };
  try {
    res = await send(method, realPath, realBody);
  } catch {
    offline.markReachable(false);
    if (offlineAnswer && offline.getOfflineUserId()) return queue();
    throw new ApiRequestError(0, OFFLINE_MESSAGE);
  }
  offline.markReachable(true);
  if (res.status < 200 || res.status >= 300) throw toError(res.status, res.payload);
  return res.payload as T;
}

async function getWithCache<T>(path: string, useCache: boolean): Promise<T> {
  // Changes made offline go first, so this answer already includes them.
  if (useCache && offline.pendingCount() > 0 && offline.isOnline()) await offline.flush();

  const realPath = offline.remapPath(path);
  const cached = async (): Promise<T | undefined> => {
    if (!useCache) return undefined;
    // Made offline and synced since: until the server's own copy has been
    // read once, the one kept under its temporary id stands in.
    return (await offline.getCached<T>(realPath)) ?? (realPath !== path ? offline.getCached<T>(path) : undefined);
  };
  const cachedOr = async (message: string): Promise<T> => {
    const hit = await cached();
    if (hit === undefined) throw new ApiRequestError(0, message);
    return hit;
  };

  // Made offline, not on the server yet: only this browser knows it.
  if (offline.hasUnsyncedId(realPath)) return cachedOr(NOT_SYNCED_MESSAGE);
  // Changes still waiting to be sent: the kept copy already shows them, the
  // server's doesn't. Not for who's signed in, though — that's the server's to say.
  if (useCache && offline.pendingCount() > 0 && !path.startsWith("/api/auth/")) {
    const hit = await cached();
    if (hit !== undefined) return hit;
  }
  if (!offline.isOnline()) return cachedOr(OFFLINE_MESSAGE);

  let res: { status: number; payload: any };
  try {
    res = await send("GET", realPath, undefined);
  } catch {
    offline.markReachable(false);
    return cachedOr(OFFLINE_MESSAGE);
  }
  offline.markReachable(true);
  if (res.status < 200 || res.status >= 300) {
    // Signed out, or no longer allowed in: the kept copy mustn't keep answering for it.
    if (useCache && (res.status === 401 || res.status === 403 || res.status === 404)) {
      void offline.deleteCached(realPath);
    }
    throw toError(res.status, res.payload);
  }
  if (useCache) void offline.setCached(realPath, res.payload);
  return res.payload as T;
}

// Working without a connection, and catching up once it's back.
//
// Two things live here, both kept in this browser (see store.ts):
//
// - The read cache: the last answer to every GET the app made, keyed by its
//   path, plus what the map page last showed (useMapData writes its current
//   nodes/links/lines back over the same keys). Offline, api/client.ts answers
//   GETs from it, so the dashboard and every map opened before still open.
//
// - The outbox: changes made while offline (a new node, a moved one, a renamed
//   map…), in the order they were made. Each api function that can work
//   offline answers right away with what the server would most likely have
//   said, and its request waits here. Once the server is reachable again they
//   are sent, oldest first. Something created offline gets a temporary id
//   (`local_…`); when its create goes through, the server's real id replaces
//   the temporary one in every later request that still mentions it.
//
// Conflicts are settled by the server, last write wins: a queued edit to a
// node someone else deleted meanwhile is answered with an error, dropped, and
// counted in `failed` so the UI can say some offline changes didn't make it.

import { kvClear, kvGet, kvSet, kvUpdate } from "./store";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface QueuedRequest {
  id: string;
  userId: string;
  method: Method;
  path: string;
  body?: unknown;
  /** For a create: the temporary id the optimistic answer carried… */
  localId?: string;
  /** …and where the real one sits in the server's reply (dotted path, e.g. "folder.folderId"). */
  idKey?: string;
  /** Bookkeeping the user didn't consciously do (where they scrolled to, a preference): sent, but not counted or announced. */
  quiet?: boolean;
  createdAt: number;
}

export interface SyncStatus {
  /** The last request reached the server (and the browser thinks it has a network). */
  online: boolean;
  /** Offline changes still waiting to be sent, for the signed-in user. */
  pending: number;
  syncing: boolean;
  /** Offline changes the server refused while catching up, since the user last dismissed it. */
  failed: { count: number; lastError: string } | null;
  /** The session ran out while changes were waiting — they're sent after signing back in. */
  needsSignIn: boolean;
}

export interface Transport {
  (method: Method, path: string, body: unknown): Promise<{ status: number; payload: any }>;
}

/** Thrown by a Transport when the request never reached the server. */
export class NetworkError extends Error {}

const OUTBOX_KEY = "outbox";
const ID_MAP_KEY = "idmap";
const CACHE_PREFIX = "cache:";
const TEXT_PREFIX = "text:";
// Exactly 24 hex digits after the prefix, so ordinary words in a node's text
// ("local-first", "local_news") are never mistaken for one.
const LOCAL_PREFIX = "local_";
const LOCAL_ID_RE = /\blocal_[0-9a-f]{24}\b/g;
const RETRY_MS = 15_000;
const ID_MAP_LIMIT = 1000;

let transport: Transport | null = null;
let outbox: QueuedRequest[] = [];
let idMap: Record<string, string> = {};
let currentUserId: string | null = null;
let reachable = true;
let flushing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let status: SyncStatus = { online: true, pending: 0, syncing: false, failed: null, needsSignIn: false };
const listeners = new Set<() => void>();
const syncedListeners = new Set<(ids: Record<string, string>) => void>();

// ---------- startup ----------

let readyPromise: Promise<void> | null = null;
/** Loads the outbox and id map saved by an earlier visit. Every entry point awaits it. */
export function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      outbox = (await kvGet<QueuedRequest[]>(OUTBOX_KEY)) ?? [];
      idMap = (await kvGet<Record<string, string>>(ID_MAP_KEY)) ?? {};
      if (typeof window !== "undefined") {
        window.addEventListener("online", () => {
          reachable = true;
          publish();
          void flush();
        });
        window.addEventListener("offline", () => publish());
      }
      publish();
    })();
  }
  return readyPromise;
}

export function setTransport(fn: Transport): void {
  transport = fn;
}

/** Who is signed in — only their own queued changes are ever sent. null when signed out. */
export function setOfflineUser(userId: string | null): void {
  if (userId === currentUserId) return;
  currentUserId = userId;
  if (userId) status = { ...status, needsSignIn: false };
  publish();
  if (userId) void ready().then(() => flush());
}

export function getOfflineUserId(): string | null {
  return currentUserId;
}

// ---------- status ----------

function browserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Worth trying the network at all. */
export function isOnline(): boolean {
  return reachable && browserOnline();
}

function myOutbox(): QueuedRequest[] {
  return currentUserId ? outbox.filter((r) => r.userId === currentUserId) : [];
}

export function pendingCount(): number {
  return myOutbox().length;
}

function publish(patch: Partial<SyncStatus> = {}): void {
  status = { ...status, ...patch, online: isOnline(), pending: myOutbox().filter((r) => !r.quiet).length };
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called after the outbox empties, with every temporary id the server has replaced so far. */
export function onSynced(listener: (ids: Record<string, string>) => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

export function dismissSyncFailures(): void {
  publish({ failed: null });
}

/** A request reached the server, or didn't. */
export function markReachable(ok: boolean): void {
  if (reachable === ok) return;
  reachable = ok;
  publish();
  if (ok) void flush();
  else scheduleRetry();
}

function scheduleRetry(): void {
  if (retryTimer || typeof window === "undefined") return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    // Probing is what the flush itself does: its first request either gets through or doesn't.
    if (pendingCount() > 0) {
      reachable = true;
      void flush();
    }
  }, RETRY_MS);
}

// ---------- temporary ids ----------

export function newLocalId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return LOCAL_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isLocalId(id: string | null | undefined): boolean {
  return !!id && new RegExp(`^${LOCAL_ID_RE.source}$`).test(id);
}

/** The server's id for a temporary one, once its create has gone through. */
export function resolveId(id: string): string {
  return idMap[id] ?? id;
}

/** Swaps every already-known temporary id in a path. */
export function remapPath(path: string): string {
  return path.replace(LOCAL_ID_RE, (id) => idMap[id] ?? id);
}

/** Same, anywhere inside a JSON-able body. */
export function remapBody<T>(body: T): T {
  if (body === undefined) return body;
  const json = JSON.stringify(body);
  if (!json.includes(LOCAL_PREFIX)) return body;
  return JSON.parse(json.replace(LOCAL_ID_RE, (id) => idMap[id] ?? id));
}

/** Any temporary id still in this request whose create hasn't reached the server. */
export function hasUnsyncedId(path: string, body?: unknown): boolean {
  const text = path + (body === undefined ? "" : JSON.stringify(body));
  return (text.match(LOCAL_ID_RE) ?? []).some((id) => !idMap[id]);
}

// ---------- outbox ----------

async function saveOutbox(): Promise<void> {
  await kvSet(OUTBOX_KEY, outbox);
}

export interface EnqueueOptions {
  localId?: string;
  idKey?: string;
  /** Fold into the request queued just before this one if it went to the same path (latest values win). */
  merge?: boolean;
  quiet?: boolean;
}

export async function enqueue(method: Method, path: string, body: unknown, opts: EnqueueOptions = {}): Promise<void> {
  await ready();
  if (!currentUserId) throw new Error("Not signed in");
  const last = outbox[outbox.length - 1];
  if (
    opts.merge &&
    last &&
    last.userId === currentUserId &&
    last.method === method &&
    last.path === path &&
    !last.localId &&
    isPlainObject(last.body) &&
    isPlainObject(body)
  ) {
    last.body = { ...last.body, ...body };
  } else {
    outbox.push({
      id: newLocalId(),
      userId: currentUserId,
      method,
      path,
      body,
      localId: opts.localId,
      idKey: opts.idKey,
      quiet: opts.quiet,
      createdAt: Date.now(),
    });
  }
  await saveOutbox();
  publish();
  scheduleRetry();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readPath(obj: any, dotted: string): unknown {
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * Sends every queued change of the signed-in user, oldest first. Stops at the
 * first one the server can't take right now (offline, server error, signed
 * out) and keeps it for next time; drops one the server refuses outright.
 * Safe to call any time — overlapping calls share one run.
 */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    await ready();
    if (!transport || !currentUserId || pendingCount() === 0) return;
    publish({ syncing: true });
    let sentAny = false;
    const failedBefore = status.failed;
    let failed = failedBefore;
    try {
      for (;;) {
        const req = myOutbox()[0];
        if (!req) break;
        const remove = async () => {
          outbox = outbox.filter((r) => r.id !== req.id);
          await saveOutbox();
          publish();
        };

        // Its own parent never made it to the server — nothing to attach it to.
        if (hasUnsyncedId(req.path, req.body)) {
          if (!req.quiet) failed = { count: (failed?.count ?? 0) + 1, lastError: "Depends on a change that couldn't be saved" };
          await remove();
          continue;
        }

        let res: { status: number; payload: any };
        try {
          res = await transport(req.method, remapPath(req.path), remapBody(req.body));
        } catch (err) {
          if (err instanceof NetworkError) {
            reachable = false;
            scheduleRetry();
            break;
          }
          throw err;
        }
        reachable = true;

        if (res.status === 401) {
          publish({ needsSignIn: true });
          break;
        }
        if (isRetryable(res.status)) {
          scheduleRetry();
          break;
        }
        if (res.status >= 400) {
          if (!req.quiet) failed = {
            count: (failed?.count ?? 0) + 1,
            lastError: res.payload?.error || `Request failed (${res.status})`,
          };
        } else {
          if (!req.quiet) sentAny = true;
          if (req.localId && req.idKey) {
            const realId = readPath(res.payload, req.idKey);
            if (typeof realId === "string") await rememberIdMapping(req.localId, realId);
          }
        }
        await remove();
      }
    } finally {
      publish({ syncing: false, failed });
    }
    if ((sentAny || failed !== failedBefore) && pendingCount() === 0) {
      const ids = { ...idMap };
      syncedListeners.forEach((l) => l(ids));
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function rememberIdMapping(localId: string, realId: string): Promise<void> {
  idMap[localId] = realId;
  const keys = Object.keys(idMap);
  if (keys.length > ID_MAP_LIMIT) keys.slice(0, keys.length - ID_MAP_LIMIT).forEach((k) => delete idMap[k]);
  await kvSet(ID_MAP_KEY, idMap);
}

// ---------- read cache ----------

export function getCached<T>(path: string): Promise<T | undefined> {
  return kvGet<T>(CACHE_PREFIX + path);
}

export function setCached(path: string, payload: unknown): Promise<void> {
  return kvSet(CACHE_PREFIX + path, payload);
}

export function deleteCached(path: string): Promise<void> {
  return kvUpdate(CACHE_PREFIX + path, () => undefined);
}

/** Changes a cached answer in place; does nothing when there's none to change. */
export function patchCached<T>(path: string, fn: (prev: T) => T): Promise<void> {
  return kvUpdate<T>(CACHE_PREFIX + path, (prev) => (prev === undefined ? prev : fn(prev)));
}

/** Like patchCached, but starts from `initial` when nothing is cached yet. */
export function upsertCached<T>(path: string, initial: T, fn: (prev: T) => T): Promise<void> {
  return kvUpdate<T>(CACHE_PREFIX + path, (prev) => fn(prev ?? initial));
}

/** Node texts of one map (the node list itself comes without them — see api/maps.ts's getNodesText). */
export function getCachedTexts(mapId: string): Promise<Record<string, string>> {
  return kvGet<Record<string, string>>(TEXT_PREFIX + mapId).then((t) => t ?? {});
}

export function rememberTexts(mapId: string, texts: Record<string, string>): Promise<void> {
  const entries = Object.entries(texts).filter(([, text]) => text);
  if (entries.length === 0) return Promise.resolve();
  return kvUpdate<Record<string, string>>(TEXT_PREFIX + mapId, (prev) => ({ ...prev, ...Object.fromEntries(entries) }));
}

/** Forgets everything read from the server (on sign-out). Unsent changes stay, tagged with their user. */
export function clearReadCache(): Promise<void> {
  return kvClear((key) => !key.startsWith(CACHE_PREFIX) && !key.startsWith(TEXT_PREFIX));
}

// ---------- the nodes on screen ----------

// The latest copy of every node the app has on screen, so an offline edit can
// answer with the whole node (the canvas replaces a node with whatever the
// update returns), not just the changed fields.
const knownNodes = new Map<string, any>();

export function rememberNodes(nodes: { nodeId: string }[]): void {
  nodes.forEach((n) => knownNodes.set(n.nodeId, n));
}

export function knownNode<T>(nodeId: string): T | undefined {
  return knownNodes.get(nodeId) ?? knownNodes.get(resolveId(nodeId));
}

/** Test helper. */
export function resetSyncForTests(): void {
  outbox = [];
  idMap = {};
  currentUserId = null;
  reachable = true;
  flushing = null;
  readyPromise = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  knownNodes.clear();
  status = { online: true, pending: 0, syncing: false, failed: null, needsSignIn: false };
}

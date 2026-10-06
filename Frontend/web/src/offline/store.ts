// A small key-value store in this browser's IndexedDB: where the app keeps its
// copy of what it last saw from the server (so maps open without a
// connection) and the changes made while offline that still have to be sent.
// Falls back to memory when IndexedDB isn't there (tests, some private
// windows) — the app then works offline only until the page is reloaded.

const DB_NAME = "mind-constructor-offline";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === "undefined") return resolve(null);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
          tx.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (memory.has(key)) return memory.get(key) as T;
  const value = await run<T>("readonly", (s) => s.get(key));
  if (value !== undefined) memory.set(key, value);
  return value;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  await run("readwrite", (s) => s.put(value, key));
}

export async function kvDelete(key: string): Promise<void> {
  memory.delete(key);
  await run("readwrite", (s) => s.delete(key));
}

/** Removes every key that passes `keep(key) === false`. */
export async function kvClear(keep: (key: string) => boolean): Promise<void> {
  for (const key of [...memory.keys()]) if (!keep(key)) memory.delete(key);
  const keys = (await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) ?? [];
  const doomed = keys.map(String).filter((k) => !keep(k));
  if (doomed.length) await run("readwrite", (s) => doomed.forEach((k) => s.delete(k)));
}

// Read-modify-write updates to one key are chained, so two at once (a pasted
// batch of nodes, each adding itself to the cached node list) can't overwrite
// each other's change.
const chains = new Map<string, Promise<unknown>>();
export function kvUpdate<T>(key: string, fn: (prev: T | undefined) => T | undefined): Promise<void> {
  const next = (chains.get(key) ?? Promise.resolve())
    .then(async () => {
      const value = fn(await kvGet<T>(key));
      if (value === undefined) await kvDelete(key);
      else await kvSet(key, value);
    })
    .catch(() => {});
  chains.set(key, next);
  return next;
}

/** Test helper: forget everything, memory included. */
export function kvResetForTests(): void {
  memory.clear();
  chains.clear();
}

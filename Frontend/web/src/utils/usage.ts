import { API_URL } from "../api/client";

// How the app is used, for the admin page (Backend's abl/usageAbl.ts): a
// handful of named events like "opened the app", "added a quick note",
// "finished Think it through". Never what a thought says: an event carries
// only its name and a few short labels from a fixed list (a node type, a view
// name), and the backend drops anything else. Keep the list in step with the
// backend's EVENT_PROPS.
export type UsageEvent =
  | { name: "app_opened"; props?: { page: string } }
  | { name: "page_viewed"; props: { page: string } }
  | { name: "signed_up"; props: { method: "password" | "google" } }
  | { name: "signed_in"; props: { method: "password" | "google" } }
  | { name: "demo_started" }
  | { name: "quick_note_added" }
  | { name: "map_created"; props?: { template?: string; shape?: string } }
  | { name: "node_created"; props?: { type?: string } }
  | { name: "search_used"; props: { found: "yes" | "no" } }
  | { name: "think_started" }
  | { name: "think_finished" }
  | { name: "feeling_set" }
  | { name: "checked_in"; props: { moment: "before" | "after" } }
  | { name: "text_split" }
  | { name: "picture_drawn" }
  | { name: "view_changed"; props: { view: string } }
  | { name: "map_shared" }
  | { name: "node_attacked"; props?: { weapon?: string } }
  | { name: "node_protected" }
  | { name: "map_finished" }
  | { name: "replay_played" };

interface Queued {
  name: string;
  props?: Record<string, string>;
  at: string;
}

type Transport = (events: Queued[], keepalive: boolean) => Promise<"sent" | "retry" | "drop">;

// What the backend takes in one request (usageAbl.ts MAX_EVENTS_PER_REQUEST),
// and how many this tab keeps while the server can't be reached.
const BATCH = 50;
const MAX_QUEUED = 200;
const FLUSH_DELAY_MS = 5000;

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let signedIn = false;
let sending = false;

const defaultTransport: Transport = async (events, keepalive) => {
  try {
    const res = await fetch(`${API_URL}/api/usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive,
      body: JSON.stringify({ events }),
    });
    if (res.ok) return "sent";
    // Signed out, or a batch the server won't take: sending it again won't help.
    if (res.status >= 400 && res.status < 500) return "drop";
    return "retry";
  } catch {
    return "retry";
  }
};

let transport: Transport = defaultTransport;

/** Tests only: where batches go instead of the server. */
export function setUsageTransport(next: Transport | null) {
  transport = next ?? defaultTransport;
}

/** The browser asks sites not to track it (Global Privacy Control or Do Not Track). */
export function browserOptedOut(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

const enabled = () => signedIn && !browserOptedOut() && (import.meta.env.MODE !== "test" || transport !== defaultTransport);

/**
 * Who's signed in, told by AuthContext. Events only count for a signed-in
 * user; signing out sends what's waiting first, then stops.
 */
export function setUsageUser(userId: string | null) {
  const next = !!userId;
  if (signedIn && !next) void flushUsage();
  signedIn = next;
  if (!next) queue = [];
}

/** Notes that the signed-in user did something. Cheap: batched, sent a few seconds later. */
export function track(event: UsageEvent) {
  if (!enabled()) return;
  const props = "props" in event && event.props ? cleanProps(event.props) : undefined;
  queue.push({ name: event.name, ...(props ? { props } : {}), at: new Date().toISOString() });
  if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);
  if (queue.length >= BATCH) void flushUsage();
  else if (!timer) timer = setTimeout(() => void flushUsage(), FLUSH_DELAY_MS);
}

function cleanProps(props: Record<string, string | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined && v !== "") out[k] = v;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Sends everything waiting now. `keepalive` lets it finish while the page closes. */
export async function flushUsage(keepalive = false): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (sending || queue.length === 0) return;
  sending = true;
  try {
    while (queue.length > 0) {
      const batch = queue.slice(0, BATCH);
      const result = await transport(batch, keepalive);
      if (result === "retry") {
        // Offline or the server is waking up: try again later, still in order.
        if (!timer) timer = setTimeout(() => void flushUsage(), FLUSH_DELAY_MS * 6);
        return;
      }
      queue = queue.slice(batch.length);
    }
  } finally {
    sending = false;
  }
}

/** Tests only. */
export function resetUsage() {
  if (timer) clearTimeout(timer);
  timer = null;
  queue = [];
  signedIn = false;
  sending = false;
}

/** What a route is called in the numbers: never the map's own id. */
export function pageName(pathname: string): string {
  if (pathname === "/") return "dashboard";
  if (/^\/maps\/[^/]+/.test(pathname)) return "map";
  const first = pathname.split("/")[1] ?? "";
  return /^[a-z-]{1,24}$/.test(first) ? first : "other";
}

if (typeof window !== "undefined") {
  // Closing or hiding the tab: send what's waiting before it's gone.
  window.addEventListener("pagehide", () => void flushUsage(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushUsage(true);
  });
}

// Empty by default in production — requests go out as same-origin relative
// paths, routed through vercel.json's /api/(.*) rewrite to the Render
// backend, so the session cookie reads as first-party rather than a
// cross-site one for the bulk of the app's traffic. Local dev sets
// VITE_API_URL explicitly (see .env.example) since there's no such proxy
// running locally.
const API_URL: string = import.meta.env.VITE_API_URL || "";

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

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = opts;

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      // The session lives in an httpOnly cookie now, not a header this code
      // attaches itself — "include" is what makes the browser actually send
      // (and accept Set-Cookie for) it, on both the same-origin proxied path
      // and any request that stays cross-site.
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, "Can't reach the server. Is the backend running?");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    if (res.status === 401) {
      // The cookie itself is httpOnly — nothing here to clear. The one
      // piece of frontend-owned state tied to "was logged in" is this.
      clearDemoMapId();
    }
    const message = payload?.error || res.statusText || "Request failed";
    throw new ApiRequestError(res.status, message, payload);
  }

  return payload as T;
}

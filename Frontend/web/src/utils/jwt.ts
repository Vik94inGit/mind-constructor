// Client-side only needs the payload to know "who am I" on reload — the
// server is the one actually verifying the signature on every request.
export function decodeJwtId(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json);
    return typeof data.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

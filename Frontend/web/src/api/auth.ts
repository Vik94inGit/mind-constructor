import { apiRequest, setDemoMapId, clearDemoMapId } from "./client";
import type { User } from "../types";

interface AuthResponse {
  success: boolean;
  user: Pick<User, "_id" | "username" | "email" | "role" | "isDemo">;
}

export async function register(username: string, email: string, password: string) {
  const res = await apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
  return res.user;
}

export async function login(email: string, password: string) {
  const res = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return res.user;
}

export async function googleLogin(idToken: string) {
  const res = await apiRequest<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: { idToken },
  });
  return res.user;
}

interface DemoAuthResponse extends AuthResponse {
  map: { mapId: string };
}

// "Try it without registering" — mints a real throwaway account and a real,
// already-seeded map server-side (see Backend's createDemoSessionAbl), so
// this returns the new map's own id too: the caller has somewhere to
// navigate straight to, not just a logged-in user with an empty dashboard.
export async function tryDemo() {
  const res = await apiRequest<DemoAuthResponse>("/api/auth/demo", {
    method: "POST",
  });
  setDemoMapId(res.map.mapId);
  return { user: res.user, mapId: res.map.mapId };
}

export async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } finally {
    clearDemoMapId();
  }
}

// Who the current session cookie belongs to — used by AuthContext on
// mount, in place of the old "decode the JWT's id claim, then cross-
// reference the user list" dance, which no longer has a token to decode.
// Swallows any failure (no session, network) into null rather than
// throwing, since "not logged in" is an expected, common outcome here.
export async function me(): Promise<User | null> {
  try {
    const res = await apiRequest<{ success: boolean; user: User }>("/api/auth/me");
    return res.user;
  } catch {
    return null;
  }
}

export async function listUsers(): Promise<User[]> {
  return apiRequest<User[]>("/api/auth/users");
}

export async function blockUser(id: string): Promise<User> {
  const res = await apiRequest<{ success: boolean; user: User }>(`/api/auth/users/${id}/block`, {
    method: "PATCH",
  });
  return res.user;
}

export async function unblockUser(id: string): Promise<User> {
  const res = await apiRequest<{ success: boolean; user: User }>(`/api/auth/users/${id}/unblock`, {
    method: "PATCH",
  });
  return res.user;
}

export async function deleteUser(id: string) {
  return apiRequest<{ success: boolean; deletedUserId: string; deletedOwnedMaps: number }>(
    `/api/auth/users/${id}`,
    { method: "DELETE" },
  );
}

export async function wipeDatabase() {
  return apiRequest<{ success: boolean; message: string }>("/api/auth/users", { method: "DELETE" });
}

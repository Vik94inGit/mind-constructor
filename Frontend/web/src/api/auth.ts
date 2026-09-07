import { apiRequest, setToken, clearToken } from "./client";
import type { User } from "../types";

interface AuthResponse {
  success: boolean;
  token: string;
  user: Pick<User, "_id" | "username" | "email" | "role">;
}

export async function register(username: string, email: string, password: string) {
  const res = await apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { username, email, password },
    auth: false,
  });
  setToken(res.token);
  return res.user;
}

export async function login(email: string, password: string) {
  const res = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setToken(res.token);
  return res.user;
}

export async function googleLogin(idToken: string) {
  const res = await apiRequest<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: { idToken },
    auth: false,
  });
  setToken(res.token);
  return res.user;
}

export async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } finally {
    clearToken();
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

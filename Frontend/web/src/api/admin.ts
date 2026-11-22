import { apiRequest } from "./client";
import type { User } from "../types";

/** A user on the admin page, with how much they use the app (Backend's adminAbl.ts). */
export interface AdminUser extends User {
  createdAt: string | null;
  ownedMaps: number;
  writtenNodes: number;
  lastActiveAt: string | null;
  /** Not an admin, never wrote a thought, and idle long enough to clean up. */
  unused: boolean;
}

/** One row of the admin page's list of every map. */
export interface AdminMap {
  mapId: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  memberCount: number;
  nodeCount: number;
  writtenNodes: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return (await apiRequest<{ success: boolean; users: AdminUser[] }>("/api/admin/users", { cache: false })).users;
}

/** Deletes the given accounts, but only those the server still finds unused. */
export async function deleteUnusedUsers(userIds: string[]) {
  return apiRequest<{ success: boolean; deleted: string[]; skipped: string[] }>("/api/admin/users/delete-unused", {
    method: "POST",
    body: { userIds },
  });
}

export async function listAllMaps(): Promise<AdminMap[]> {
  return (await apiRequest<{ success: boolean; maps: AdminMap[] }>("/api/admin/maps", { cache: false })).maps;
}

export async function deleteMapAsAdmin(mapId: string) {
  return apiRequest<{ success: boolean; deletedMapId: string }>(`/api/admin/maps/${encodeURIComponent(mapId)}`, {
    method: "DELETE",
  });
}

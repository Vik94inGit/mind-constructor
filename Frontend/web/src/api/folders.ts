import { apiRequest } from "./client";
import type { FolderDoc } from "../types";

export async function listFolders(): Promise<FolderDoc[]> {
  const res = await apiRequest<{ success: boolean; folders: FolderDoc[] }>("/api/folders");
  return res.folders;
}

export async function createFolder(name: string): Promise<FolderDoc> {
  const res = await apiRequest<{ success: boolean; folder: FolderDoc }>("/api/folders", {
    method: "POST",
    body: { name },
  });
  return res.folder;
}

export async function renameFolder(folderId: string, name: string): Promise<FolderDoc> {
  const res = await apiRequest<{ success: boolean; folder: FolderDoc }>(`/api/folders/${folderId}`, {
    method: "PATCH",
    body: { name },
  });
  return res.folder;
}

export async function deleteFolder(folderId: string) {
  return apiRequest<{ success: boolean; folderId: string }>(`/api/folders/${folderId}`, { method: "DELETE" });
}

/** Puts a map in one of your folders, or back at the top level with null. */
export async function moveMapToFolder(mapId: string, folderId: string | null) {
  return apiRequest<{ success: boolean; mapId: string; folderId: string | null }>(`/api/folders/maps/${mapId}`, {
    method: "PATCH",
    body: { folderId },
  });
}

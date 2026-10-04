import type { FolderDoc, MapDoc } from "../types";

// What the dashboard grid shows: folders first (by name), then maps — the
// whole state of the "file browser" as a pure function of what's loaded.

export type LibraryItem =
  | { kind: "folder"; folder: FolderDoc; mapCount: number }
  | { kind: "map"; map: MapDoc };

export const PAGE_SIZE = 24;

/** The folder of yours a map is in, if any. */
export function folderOfMap(folders: FolderDoc[], mapId: string): FolderDoc | undefined {
  return folders.find((f) => f.mapIds.includes(mapId));
}

const matches = (name: string, query: string) => name.toLocaleLowerCase().includes(query);

/**
 * - Searching: every folder and every map whose name matches, wherever it is.
 * - In a folder: that folder's maps.
 * - Otherwise: all folders, plus the maps that aren't in any of them.
 */
export function libraryItems(
  maps: MapDoc[],
  folders: FolderDoc[],
  openFolderId: string | null,
  query: string,
): LibraryItem[] {
  const q = query.trim().toLocaleLowerCase();
  const byName = <T>(name: (x: T) => string) => (a: T, b: T) => name(a).localeCompare(name(b));
  const folderItems = (list: FolderDoc[]): LibraryItem[] =>
    [...list].sort(byName((f) => f.name)).map((folder) => ({
      kind: "folder",
      folder,
      mapCount: maps.filter((m) => folder.mapIds.includes(m.mapId)).length,
    }));
  const mapItems = (list: MapDoc[]): LibraryItem[] => list.map((map) => ({ kind: "map", map }));

  if (q) {
    return [
      ...folderItems(folders.filter((f) => matches(f.name, q))),
      ...mapItems(maps.filter((m) => matches(m.name, q))),
    ];
  }
  if (openFolderId) {
    const folder = folders.find((f) => f.folderId === openFolderId);
    return folder ? mapItems(maps.filter((m) => folder.mapIds.includes(m.mapId))) : [];
  }
  const filed = new Set(folders.flatMap((f) => f.mapIds));
  return [...folderItems(folders), ...mapItems(maps.filter((m) => !filed.has(m.mapId)))];
}

/** One page of `items` (1-based), with `page` clamped into range. */
export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount };
}

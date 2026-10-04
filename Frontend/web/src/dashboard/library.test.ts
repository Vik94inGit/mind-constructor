import { describe, expect, it } from "vitest";
import { folderOfMap, libraryItems, paginate } from "./library";
import type { FolderDoc, MapDoc } from "../types";

const map = (mapId: string, name: string) => ({ mapId, name }) as MapDoc;
const folder = (folderId: string, name: string, mapIds: string[]): FolderDoc => ({ folderId, name, mapIds });

const maps = [map("m1", "Budget"), map("m2", "Trip plan"), map("m3", "Hiring")];
const folders = [folder("f2", "Work", ["m1", "m3", "gone"]), folder("f1", "Home", [])];

const describeItems = (items: ReturnType<typeof libraryItems>) =>
  items.map((i) => (i.kind === "folder" ? `folder:${i.folder.name}:${i.mapCount}` : `map:${i.map.name}`));

describe("libraryItems", () => {
  it("shows folders by name, then the maps in no folder", () => {
    expect(describeItems(libraryItems(maps, folders, null, ""))).toEqual([
      "folder:Home:0",
      "folder:Work:2",
      "map:Trip plan",
    ]);
  });

  it("shows only an open folder's maps, skipping ones no longer visible", () => {
    expect(describeItems(libraryItems(maps, folders, "f2", ""))).toEqual(["map:Budget", "map:Hiring"]);
  });

  it("searches every folder and map by name, ignoring case and the open folder", () => {
    expect(describeItems(libraryItems(maps, folders, "f1", "  hI "))).toEqual(["map:Hiring"]);
    expect(describeItems(libraryItems(maps, folders, null, "o"))).toEqual(["folder:Home:0", "folder:Work:2"]);
  });

  it("shows nothing for a folder that no longer exists", () => {
    expect(libraryItems(maps, folders, "nope", "")).toEqual([]);
  });
});

describe("folderOfMap", () => {
  it("finds the folder holding a map", () => {
    expect(folderOfMap(folders, "m3")?.name).toBe("Work");
    expect(folderOfMap(folders, "m2")).toBeUndefined();
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 5 }, (_, i) => i);

  it("slices one page", () => {
    expect(paginate(items, 2, 2)).toEqual({ items: [2, 3], page: 2, pageCount: 3 });
  });

  it("clamps the page into range", () => {
    expect(paginate(items, 9, 2)).toEqual({ items: [4], page: 3, pageCount: 3 });
    expect(paginate([], 3, 2)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});

import { describe, it, expect } from "vitest";
import { unusedProfiles, namesPreview, filterMaps, shortDate } from "./cleanup";
import type { AdminMap, AdminUser } from "../api/admin";

const user = (over: Partial<AdminUser>): AdminUser => ({
  _id: "u",
  username: "u",
  email: "u@x",
  createdAt: null,
  ownedMaps: 0,
  writtenNodes: 0,
  lastActiveAt: null,
  unused: false,
  ...over,
});

const map = (over: Partial<AdminMap>): AdminMap => ({
  mapId: "m",
  name: "Map",
  ownerId: "o",
  ownerName: "owner",
  memberCount: 1,
  nodeCount: 0,
  writtenNodes: 0,
  createdAt: null,
  updatedAt: null,
  ...over,
});

describe("unusedProfiles", () => {
  it("keeps only unused, non-admin accounts other than the viewer", () => {
    const users = [
      user({ _id: "a", unused: true }),
      user({ _id: "b", unused: false }),
      user({ _id: "c", unused: true, role: "admin" }),
      user({ _id: "me", unused: true }),
    ];
    expect(unusedProfiles(users, "me").map((u) => u._id)).toEqual(["a"]);
  });
});

describe("namesPreview", () => {
  it("shows the first names and counts the rest", () => {
    expect(namesPreview(["a", "b", "c"], 2)).toEqual({ names: "a, b", more: 1 });
    expect(namesPreview(["a"], 2)).toEqual({ names: "a", more: 0 });
  });
});

describe("filterMaps", () => {
  const maps = [map({ mapId: "1", name: "Trip plan", ownerName: "Ann" }), map({ mapId: "2", name: "Exam", ownerName: "Bob" })];
  it("matches the name or the owner, ignoring case", () => {
    expect(filterMaps(maps, "trip").map((m) => m.mapId)).toEqual(["1"]);
    expect(filterMaps(maps, "BOB").map((m) => m.mapId)).toEqual(["2"]);
    expect(filterMaps(maps, "  ")).toHaveLength(2);
  });
});

describe("shortDate", () => {
  it("is null for no date or a bad one", () => {
    expect(shortDate(null, "en")).toBeNull();
    expect(shortDate("nope", "en")).toBeNull();
    expect(shortDate("2026-11-22T00:00:00Z", "en")).toContain("2026");
  });
});

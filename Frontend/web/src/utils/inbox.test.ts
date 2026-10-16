import { describe, expect, it, vi } from "vitest";
import { addQuickNote, findInbox, notePosition } from "./inbox";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import type { MapDoc } from "../types";

vi.mock("../api/maps", () => ({ createMap: vi.fn(async () => ({ mapId: "inbox", name: "Inbox", ownerId: "u1" })) }));
vi.mock("../api/nodes", () => ({
  listNodes: vi.fn(async () => [{ nodeId: "a" }, { nodeId: "b" }]),
  createNode: vi.fn(async (_mapId: string, input: object) => ({ nodeId: "n", ...input })),
}));

const map = (mapId: string, name: string, ownerId = "u1") => ({ mapId, name, ownerId }) as MapDoc;

describe("inbox", () => {
  it("lays notes out in rows, never two on one spot", () => {
    const spots = Array.from({ length: 90 }, (_, i) => notePosition(i));
    expect(new Set(spots.map((p) => `${p.x}:${p.y}`)).size).toBe(90);
    expect(notePosition(1).y).toBe(notePosition(0).y);
    expect(notePosition(5).y).toBeGreaterThan(notePosition(0).y);
  });

  it("finds your own map named Inbox, not someone else's", () => {
    expect(findInbox([map("x", "Inbox", "u2"), map("y", "Inbox")], "u1", "Inbox")?.mapId).toBe("y");
    expect(findInbox([map("x", "Inbox", "u2")], "u1", "Inbox")).toBeNull();
  });

  it("makes the Inbox the first time, then adds after the notes already there", async () => {
    localStorage.clear();
    const first = await addQuickNote("Buy milk", [], "u1", "Inbox");
    expect(first.created).toBe(true);
    expect(mapsApi.createMap).toHaveBeenCalledWith(expect.objectContaining({ name: "Inbox", discussionMode: false }));
    expect(nodesApi.createNode).toHaveBeenLastCalledWith("inbox", expect.objectContaining({ text: "Buy milk", ...notePosition(0) }));

    const second = await addQuickNote("Call mum", [map("inbox", "Renamed")], "u1", "Inbox");
    expect(second.created).toBe(false);
    expect(nodesApi.createNode).toHaveBeenLastCalledWith("inbox", expect.objectContaining({ text: "Call mum", ...notePosition(2) }));
  });
});

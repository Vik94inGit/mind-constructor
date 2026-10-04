import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import * as mapsApi from "../api/maps";
import * as offline from "./sync";
import { kvResetForTests } from "./store";

type Handler = (method: string, path: string, body: any) => { status: number; body?: unknown } | "offline";

let handler: Handler;
const calls: { method: string; path: string; body: any }[] = [];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  kvResetForTests();
  offline.resetSyncForTests();
  offline.setOfflineUser("u1");
  calls.length = 0;
  handler = () => ({ status: 200, body: {} });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path, body });
      const res = handler(method, path, body);
      if (res === "offline") throw new TypeError("Failed to fetch");
      return json(res.status, res.body ?? {});
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const goOffline = () => {
  handler = () => "offline";
};

describe("reading while offline", () => {
  it("answers a GET from the copy kept when it last succeeded", async () => {
    handler = () => ({ status: 200, body: [{ nodeId: "n1", type: "Problem" }] });
    await nodesApi.listNodes("m1");

    goOffline();
    const nodes = await nodesApi.listNodes("m1");
    expect(nodes).toEqual([{ nodeId: "n1", type: "Problem" }]);
  });

  it("fails plainly when nothing was kept", async () => {
    goOffline();
    await expect(apiRequest("/api/never-seen")).rejects.toMatchObject({ status: 0 });
  });

  it("forgets the kept copy once the server says the caller is signed out", async () => {
    handler = () => ({ status: 200, body: { user: { _id: "u1" } } });
    await apiRequest("/api/auth/me");
    handler = () => ({ status: 401, body: { error: "Not authorized" } });
    await expect(apiRequest("/api/auth/me")).rejects.toMatchObject({ status: 401 });
    goOffline();
    await expect(apiRequest("/api/auth/me")).rejects.toMatchObject({ status: 0 });
  });
});

describe("changing things while offline", () => {
  it("queues a new node and a link to it, then sends both with the server's real id", async () => {
    goOffline();
    const node = await nodesApi.createNode("m1", { text: "Idea", type: "Option", x: 1, y: 2 });
    expect(offline.isLocalId(node.nodeId)).toBe(true);
    expect(node).toMatchObject({ text: "Idea", health: 100, defeated: false, userId: "u1" });

    const edge = await edgesApi.createEdge("m1", { fromNodeId: "n0", toNodeId: node.nodeId });
    expect(offline.isLocalId(edge.edgeId)).toBe(true);
    expect(offline.pendingCount()).toBe(2);

    // It shows up in the map's kept node list too, so the map opens with it.
    expect((await nodesApi.listNodes("m1")).map((n) => n.nodeId)).toEqual([node.nodeId]);

    const synced = vi.fn();
    offline.onSynced(synced);
    handler = (method, path) => {
      if (method === "POST" && path === "/api/nodes/m1") return { status: 201, body: { nodeId: "real-node" } };
      if (method === "POST" && path === "/api/edges/m1") return { status: 201, body: { edgeId: "real-edge" } };
      return { status: 200, body: [] };
    };
    calls.length = 0;
    await offline.flush();

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /api/nodes/m1", "POST /api/edges/m1"]);
    expect(calls[1].body).toEqual({ fromNodeId: "n0", toNodeId: "real-node" });
    expect(offline.pendingCount()).toBe(0);
    expect(offline.resolveId(node.nodeId)).toBe("real-node");
    expect(synced).toHaveBeenCalledWith(expect.objectContaining({ [node.nodeId]: "real-node" }));
  });

  it("folds a stream of moves of one node into a single request", async () => {
    offline.rememberNodes([{ nodeId: "n1", text: "x", type: "Problem", health: 80 } as never]);
    goOffline();
    await nodesApi.updateNode("n1", { x: 1, y: 1 });
    await nodesApi.updateNode("n1", { x: 5, y: 6 });
    const last = await nodesApi.updateNode("n1", { x: 9, y: 9 });
    expect(last).toMatchObject({ nodeId: "n1", text: "x", health: 80, x: 9, y: 9 });
    expect(offline.pendingCount()).toBe(1);

    handler = () => ({ status: 200, body: { nodeId: "n1" } });
    calls.length = 0;
    await offline.flush();
    expect(calls).toEqual([{ method: "PATCH", path: "/api/nodes/n1", body: { x: 9, y: 9 } }]);
  });

  it("keeps later changes in line behind earlier ones even once back online", async () => {
    goOffline();
    await nodesApi.updateNode("n1", { title: "a" });
    handler = () => ({ status: 200, body: { nodeId: "n2" } });
    // The browser is online again, but the queue isn't empty: this waits its turn.
    await nodesApi.updateNode("n2", { title: "b" });
    expect(offline.pendingCount()).toBe(2);
    calls.length = 0;
    await offline.flush();
    expect(calls.map((c) => c.path)).toEqual(["/api/nodes/n1", "/api/nodes/n2"]);
  });

  it("drops a change the server refuses, and anything that depended on it", async () => {
    goOffline();
    const node = await nodesApi.createNode("m1", { text: "Idea", type: "Option" });
    await nodesApi.updateNode(node.nodeId, { title: "named" });
    await nodesApi.updateNode("n9", { title: "fine" });

    handler = (method, path) =>
      path === "/api/nodes/m1" ? { status: 403, body: { error: "Not a member" } } : { status: 200, body: {} };
    calls.length = 0;
    await offline.flush();

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /api/nodes/m1", "PATCH /api/nodes/n9"]);
    expect(offline.pendingCount()).toBe(0);
    expect(offline.getSyncStatus().failed).toEqual({ count: 2, lastError: expect.any(String) });
  });

  it("keeps everything for later when the server can't take it right now", async () => {
    goOffline();
    await nodesApi.updateNode("n1", { title: "a" });
    handler = () => ({ status: 503, body: {} });
    await offline.flush();
    expect(offline.pendingCount()).toBe(1);

    handler = () => ({ status: 401, body: { error: "Not authorized" } });
    await offline.flush();
    expect(offline.pendingCount()).toBe(1);
    expect(offline.getSyncStatus().needsSignIn).toBe(true);
  });

  it("only ever sends the signed-in user's own changes", async () => {
    goOffline();
    await nodesApi.updateNode("n1", { title: "mine" });
    offline.setOfflineUser("u2");
    expect(offline.pendingCount()).toBe(0);
    handler = () => ({ status: 200, body: {} });
    calls.length = 0;
    await offline.flush();
    expect(calls).toEqual([]);
  });

  it("refuses offline what only the server can decide", async () => {
    goOffline();
    await expect(nodesApi.attackNode("n1", "nitpick", { type: "Problem", text: "no" })).rejects.toMatchObject({
      status: 0,
    });
    expect(offline.pendingCount()).toBe(0);
  });

  it("creates a whole map offline that opens with its seeded nodes", async () => {
    handler = () => ({ status: 200, body: { success: true, maps: [{ mapId: "old", name: "Old" }] } });
    await mapsApi.listMaps("all");
    goOffline();
    const map = await mapsApi.createMap({ name: "Trip", ownerColor: "#000" });
    const root = await nodesApi.createNode(map.mapId, { text: "Where?", type: "Problem" });
    expect((await mapsApi.getMap(map.mapId)).name).toBe("Trip");
    expect((await nodesApi.listNodes(map.mapId)).map((n) => n.nodeId)).toEqual([root.nodeId]);
    expect(await mapsApi.getNodesText(map.mapId, [root.nodeId])).toEqual({ [root.nodeId]: "Where?" });
    expect((await mapsApi.listMaps("all")).map((m) => m.name)).toEqual(["Trip", "Old"]);

    handler = (method, path) => {
      if (path === "/api/") return { status: 201, body: { mapId: "real-map" } };
      if (path === "/api/nodes/real-map") return { status: 201, body: { nodeId: "real-root" } };
      return { status: 200, body: {} };
    };
    calls.length = 0;
    await offline.flush();
    expect(calls.map((c) => c.path)).toEqual(["/api/", "/api/nodes/real-map"]);
  });
});

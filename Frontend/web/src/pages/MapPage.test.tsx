// A smoke test over the whole map page: it loads a small map, draws its
// nodes, and answers the everyday interactions (selecting a node opens its
// panel, a click on empty canvas closes it, shift-clicks build a group
// selection). Its job is to catch the page itself breaking — every hook it's
// built from has its own, finer tests.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MapPage } from "./MapPage";
import { I18nProvider } from "../i18n/I18nContext";
import { ThemeProvider } from "../theme/ThemeContext";
import { makeNode } from "../test/fixtures";
import { markEntranceSeen } from "../utils/nodeEntrance";
import type { MapDoc } from "../types";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { _id: "u1", username: "me", email: "me@x" }, logout: vi.fn() }),
}));
vi.mock("../api/socket", () => {
  const socket = { on: vi.fn(), off: vi.fn(), connected: false, io: { on: vi.fn(), off: vi.fn() } };
  return { getSocket: () => socket, joinMap: vi.fn(), leaveMap: vi.fn() };
});
vi.mock("../api/maps", () => ({
  getMap: vi.fn(),
  getAttackIndicators: vi.fn(async () => []),
  getNodesText: vi.fn(async () => ({})),
  selectCircle: vi.fn(),
  deselectCircle: vi.fn(),
  updateMap: vi.fn(),
}));
vi.mock("../api/nodes", () => ({
  listNodes: vi.fn(),
  updateNode: vi.fn(),
  createNode: vi.fn(),
  getAttackHistory: vi.fn(async () => []),
  getNode: vi.fn(async () => ({ images: [] })),
}));
vi.mock("../api/edges", () => ({ listEdges: vi.fn(async () => []), createEdge: vi.fn() }));
vi.mock("../api/lines", () => ({ listLines: vi.fn(async () => []) }));
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";

// jsdom has neither — the page only needs them to exist.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", NoopResizeObserver);
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!window.matchMedia) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

const MAP: MapDoc = { mapId: "m1", name: "Test map", ownerId: "u1", discussionMode: true } as MapDoc;

function renderPage() {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={["/maps/m1"]}>
          <Routes>
            <Route path="/maps/:mapId" element={<MapPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>,
  );
}

function nodeEl(nodeId: string) {
  const el = document.querySelector(`[data-reveal-node="${nodeId}"]`);
  if (!el) throw new Error(`node ${nodeId} not drawn`);
  return el as HTMLElement;
}

describe("MapPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(mapsApi.getMap).mockResolvedValue(MAP);
    vi.mocked(nodesApi.listNodes).mockResolvedValue([
      makeNode({ nodeId: "a", title: "Alpha", x: 900, y: 600 }),
      makeNode({ nodeId: "b", title: "Beta", x: 1300, y: 700 }),
      makeNode({ nodeId: "c", title: "Gamma", x: 1100, y: 900, userId: "u2" }),
    ]);
  });

  it("loads the map and draws every node", async () => {
    renderPage();
    await waitFor(() => expect(document.querySelectorAll("[data-reveal-node]")).toHaveLength(3));
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gamma").length).toBeGreaterThan(0);
  });

  it("opens a node's panel on click and closes it from empty canvas", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => nodeEl("a"));
    expect(screen.queryByDisplayValue("some text")).toBeNull();
    await user.click(within(nodeEl("a")).getAllByText("Alpha")[0]);
    expect(await screen.findByDisplayValue("some text")).toBeInTheDocument();
    await user.click(nodeEl("a").parentElement!);
    await waitFor(() => expect(screen.queryByDisplayValue("some text")).toBeNull());
  });

  it("steps to the next and previous node with the arrow keys at the ends of the text", async () => {
    vi.mocked(nodesApi.listNodes).mockResolvedValue([
      makeNode({ nodeId: "a", title: "Alpha", text: "text A", x: 900, y: 600 }),
      makeNode({ nodeId: "b", title: "Beta", text: "text B", x: 1300, y: 700 }),
    ]);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => nodeEl("a"));
    await user.click(within(nodeEl("a")).getAllByText("Alpha")[0]);
    const ta = (await screen.findByDisplayValue("text A")) as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    await user.keyboard("{ArrowDown}");
    const next = (await screen.findByDisplayValue("text B")) as HTMLTextAreaElement;
    next.focus();
    next.setSelectionRange(0, 0);
    await user.keyboard("{ArrowUp}");
    expect(await screen.findByDisplayValue("text A")).toBeInTheDocument();
  });

  it("builds a group selection with shift-clicks on your own nodes only", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => nodeEl("a"));
    await user.keyboard("{Shift>}");
    await user.click(within(nodeEl("a")).getAllByText("Alpha")[0]);
    await user.click(within(nodeEl("b")).getAllByText("Beta")[0]);
    await user.click(within(nodeEl("c")).getAllByText("Gamma")[0]);
    await user.keyboard("{/Shift}");
    expect(await screen.findByText("2 nodes selected")).toBeInTheDocument();
  });

  it("changes a node's parent by tapping the new one, and Escape leaves without changing it", async () => {
    vi.mocked(nodesApi.updateNode).mockImplementation(async (nodeId, patch) => makeNode({ nodeId, ...patch }));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => nodeEl("b"));
    await user.click(within(nodeEl("b")).getAllByText("Beta")[0]);
    await user.click(await screen.findByText(/Change parent/));
    expect(await screen.findByText("Tap the new parent for “Beta”")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Tap the new parent for “Beta”")).toBeNull());
    expect(nodesApi.updateNode).not.toHaveBeenCalled();

    await user.click(within(nodeEl("b")).getAllByText("Beta")[0]);
    await user.click(await screen.findByText(/Change parent/));
    await user.click(within(nodeEl("a")).getAllByText("Alpha")[0]);
    await waitFor(() => expect(nodesApi.updateNode).toHaveBeenCalledWith("b", expect.objectContaining({ parentId: "a" })));
    expect(screen.queryByText("Tap the new parent for “Beta”")).toBeNull();
  });

  it("keeps the ghost ring down after a node picked from it is cancelled, until the node is opened again", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => nodeEl("a"));
    await user.click(within(nodeEl("a")).getAllByText("Alpha")[0]);
    const ghost = () => document.querySelector<HTMLButtonElement>('button.animate-ghost-in[aria-label="Idea"]');
    await waitFor(() => expect(ghost()).not.toBeNull(), { timeout: 4000 });
    await user.click(ghost()!);
    await user.click(ghost()!);
    const panel = await screen.findByTestId("new-node-panel", {}, { timeout: 4000 });
    await user.click(within(panel).getAllByRole("button", { name: "Cancel" })[0]);
    await waitFor(() => expect(screen.queryByTestId("new-node-panel")).toBeNull(), { timeout: 4000 });
    // Give the ring every chance to come back.
    await new Promise((r) => setTimeout(r, 300));
    expect(ghost()).toBeNull();

    await user.click(nodeEl("a").parentElement!);
    await waitFor(() => expect(screen.queryByDisplayValue("some text")).toBeNull(), { timeout: 4000 });
    await user.click(within(nodeEl("a")).getAllByText("Alpha")[0]);
    await waitFor(() => expect(ghost()).not.toBeNull(), { timeout: 4000 });
  }, 15000);

  it("asks once for a view after the map has opened, and keeps the answer", async () => {
    markEntranceSeen("m1");
    vi.mocked(nodesApi.listNodes).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => makeNode({ nodeId: `n${i}`, title: `Node ${i}`, x: 700 + i * 150, y: 700 })),
    );
    const user = userEvent.setup();
    renderPage();
    const prompt = await screen.findByTestId("view-prompt");
    await user.click(within(prompt).getByText("Overview"));
    await waitFor(() => expect(screen.queryByTestId("view-prompt")).toBeNull());
    expect(localStorage.getItem("mc_map_view")).toBe("overview");
  });

  it("shows the error view when the map fails to load", async () => {
    vi.mocked(mapsApi.getMap).mockRejectedValue(new Error("down"));
    renderPage();
    expect(await screen.findByRole("link")).toBeInTheDocument();
  });
});

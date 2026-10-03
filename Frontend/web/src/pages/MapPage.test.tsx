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
import type { MapDoc } from "../types";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { _id: "u1", username: "me", email: "me@x" }, logout: vi.fn() }),
}));
vi.mock("../api/socket", () => {
  const socket = { on: vi.fn(), off: vi.fn(), connected: false };
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

  it("shows the error view when the map fails to load", async () => {
    vi.mocked(mapsApi.getMap).mockRejectedValue(new Error("down"));
    renderPage();
    expect(await screen.findByRole("link")).toBeInTheDocument();
  });
});

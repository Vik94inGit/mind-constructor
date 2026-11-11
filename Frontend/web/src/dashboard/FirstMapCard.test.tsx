import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FirstMapCard } from "./FirstMapCard";
import { I18nProvider } from "../i18n/I18nContext";
import type { MapDoc } from "../types";

vi.mock("../api/nodes", () => ({
  listNodes: vi.fn(async (mapId: string) =>
    mapId === "first"
      ? [
          { nodeId: "root", parentId: null, type: "Problem", x: 100, y: 100, text: "", createdAt: "2026-11-10T09:00:00Z" },
          { nodeId: "q", parentId: "root", type: "Idea", x: 300, y: 200, ghost: true, prompt: "Why?", text: "" },
        ]
      : [{ nodeId: "note", parentId: null, type: "Idea", x: 0, y: 0, text: "", createdAt: "2026-11-10T10:00:00Z" }],
  ),
}));
vi.mock("../api/maps", () => ({
  getNodesText: vi.fn(async (mapId: string) => (mapId === "first" ? { root: "Too little sleep" } : { note: "Buy milk" })),
}));

const first = { mapId: "first", name: "Sleep", ownerId: "u1", kind: "problem", nodeCount: 2 } as MapDoc;
const inbox = { mapId: "inbox", name: "Inbox", ownerId: "u1", nodeCount: 1 } as MapDoc;

describe("FirstMapCard", () => {
  it("shows the map on top and the latest thoughts under it, newest first, skipping ghosts", async () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <FirstMapCard map={first} inbox={inbox} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Sleep")).toBeTruthy();
    const milk = await screen.findByText("Buy milk");
    const sleep = screen.getByText("Too little sleep");
    expect(milk.compareDocumentPosition(sleep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("in “Inbox”")).toBeTruthy();
    expect(screen.queryByText("Why?")).toBeNull();
    expect(screen.getByTestId("first-map-preview").querySelectorAll("circle")).toHaveLength(2);
    expect(sleep.closest("a")?.getAttribute("href")).toBe("/maps/first?node=root");
  });
});

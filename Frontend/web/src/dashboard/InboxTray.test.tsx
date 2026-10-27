import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InboxTray } from "./InboxTray";
import { I18nProvider } from "../i18n/I18nContext";
import * as inbox from "../utils/inbox";
import type { MapDoc, NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({
  listNodes: vi.fn(async () => [{ nodeId: "a", parentId: null, text: "", createdAt: "1" }]),
}));
vi.mock("../api/maps", () => ({ getNodesText: vi.fn(async () => ({ a: "Buy milk" })) }));
vi.mock("../utils/inbox", async (orig) => ({
  ...(await orig<typeof import("../utils/inbox")>()),
  moveNoteToMap: vi.fn(async () => [{ nodeId: "new" } as NodeDoc]),
}));

const inboxMap = { mapId: "inbox", name: "Inbox", ownerId: "u1", nodeCount: 3 } as MapDoc;
const work = { mapId: "work", name: "Work", ownerId: "u1" } as MapDoc;

function renderTray(map: MapDoc, onMoved = vi.fn()) {
  render(
    <MemoryRouter>
      <I18nProvider>
        <InboxTray inbox={map} maps={[map, work]} onMoved={onMoved} />
      </I18nProvider>
    </MemoryRouter>,
  );
  return onMoved;
}

describe("InboxTray", () => {
  it("counts the unsorted notes", () => {
    renderTray(inboxMap);
    expect(screen.getByText("3 unsorted notes")).toBeTruthy();
  });

  it("is hidden with nothing to sort", () => {
    const { container } = render(
      <MemoryRouter>
        <I18nProvider>
          <InboxTray inbox={{ ...inboxMap, nodeCount: 0 }} maps={[]} onMoved={vi.fn()} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(container.querySelector("[data-inbox-tray]")).toBeNull();
  });

  it("moves a note to the map picked", async () => {
    const onMoved = renderTray(inboxMap);
    fireEvent.click(screen.getByText("Sort"));
    await screen.findByText("Buy milk");
    fireEvent.click(screen.getByText("Move to a map"));
    fireEvent.click(screen.getByText("Work"));
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith(work, 1));
    expect(inbox.moveNoteToMap).toHaveBeenCalledWith("inbox", "a", work);
    expect(screen.queryByText("Buy milk")).toBeNull();
    expect(screen.getByText("Moved to Work.")).toBeTruthy();
  });
});

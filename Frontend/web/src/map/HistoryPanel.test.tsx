import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryPanel } from "./HistoryPanel";
import { I18nProvider } from "../i18n/I18nContext";
import { UI_STRINGS } from "../i18n/uiStrings";
import * as mapsApi from "../api/maps";

vi.mock("../api/maps", () => ({ getMapHistory: vi.fn() }));

const h = UI_STRINGS.en.siege.history;

describe("HistoryPanel", () => {
  it("lists edits and deletions with what was said before and after", async () => {
    vi.mocked(mapsApi.getMapHistory).mockResolvedValue([
      {
        revisionId: "r2",
        nodeId: "gone",
        userId: { _id: "u2", username: "petra" },
        action: "delete",
        before: { text: "We never said that", title: "", type: "Problem" },
        after: null,
        createdAt: "2026-01-02T10:00:00Z",
      },
      {
        revisionId: "r1",
        nodeId: "n1",
        userId: { _id: "u1", username: "viktor" },
        action: "edit",
        before: { text: "Sales are fine", title: "", type: "Option" },
        after: { text: "Sales dropped", title: "", type: "Option" },
        createdAt: "2026-01-01T10:00:00Z",
      },
    ]);
    const onShow = vi.fn();
    render(
      <I18nProvider>
        <HistoryPanel mapId="m1" liveIds={new Set(["n1"])} onShow={onShow} onExit={vi.fn()} />
      </I18nProvider>,
    );
    expect(await screen.findByText("We never said that")).toBeInTheDocument();
    expect(screen.getByText("Sales are fine").tagName).toBe("DEL");
    expect(screen.getByText("Sales dropped").tagName).toBe("INS");
    // Only a node still on the map can be shown there.
    const show = screen.getAllByRole("button", { name: h.show });
    expect(show).toHaveLength(1);
    await userEvent.click(show[0]);
    expect(onShow).toHaveBeenCalledWith("n1");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThoughtResults, useThoughtSearch } from "./ThoughtResults";
import { I18nProvider } from "../i18n/I18nContext";
import * as mapsApi from "../api/maps";

vi.mock("../api/maps", () => ({ searchThoughts: vi.fn() }));

const hit = { nodeId: "n1", mapId: "m1", mapName: "Work", type: "Option" as const, title: "", zoneName: "", snippet: "Call the client" };

describe("thought search", () => {
  it("asks only once there are two characters", async () => {
    vi.mocked(mapsApi.searchThoughts).mockResolvedValue([hit]);
    const { result, rerender } = renderHook(({ q }) => useThoughtSearch(q), { initialProps: { q: "c" } });
    expect(result.current.hits).toEqual([]);
    rerender({ q: "cl" });
    await waitFor(() => expect(result.current.hits).toEqual([hit]));
    expect(mapsApi.searchThoughts).toHaveBeenCalledTimes(1);
    expect(mapsApi.searchThoughts).toHaveBeenCalledWith("cl");
  });

  it("links each thought to its node on its map", () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <ThoughtResults hits={[hit]} failed={false} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Call the client/ })).toHaveAttribute("href", "/maps/m1?node=n1");
  });
});

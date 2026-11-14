import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateMapModal } from "./CreateMapModal";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import * as mapsApi from "../api/maps";
import { seedMapKind } from "../utils/seedMap";
import type { MapDoc } from "../types";

vi.mock("../api/maps", () => ({ createMap: vi.fn() }));
vi.mock("../utils/seedMap", () => ({ seedMapKind: vi.fn() }));
vi.mock("../utils/usage", () => ({ track: vi.fn() }));

const t = TRANSLATIONS.en;
const map = { mapId: "m1", name: "Blank" } as MapDoc;

function renderModal(onCreated = vi.fn()) {
  render(
    <I18nProvider>
      <CreateMapModal onClose={vi.fn()} onCreated={onCreated} />
    </I18nProvider>,
  );
  return onCreated;
}

describe("CreateMapModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mapsApi.createMap).mockResolvedValue(map);
  });

  it("creates an empty map with no kind and seeds no nodes", async () => {
    const onCreated = renderModal();
    await userEvent.type(screen.getByLabelText(t.dashboard.createModal.name), "Blank");
    await userEvent.click(screen.getByText(t.dashboard.createModal.templates.empty.label));
    await userEvent.click(screen.getByRole("button", { name: t.dashboard.createModal.submit }));

    expect(mapsApi.createMap).toHaveBeenCalledWith(expect.objectContaining({ name: "Blank", kind: undefined }));
    expect(seedMapKind).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(map);
  });

  it("still seeds the starter structure for a map type", async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText(t.dashboard.createModal.name), "Learn");
    await userEvent.click(screen.getByText(t.dashboard.createModal.templates.study.label));
    await userEvent.click(screen.getByRole("button", { name: t.dashboard.createModal.submit }));

    expect(mapsApi.createMap).toHaveBeenCalledWith(expect.objectContaining({ kind: "study" }));
    expect(seedMapKind).toHaveBeenCalledWith("m1", "study", t.ui.templates.nodes);
  });
});

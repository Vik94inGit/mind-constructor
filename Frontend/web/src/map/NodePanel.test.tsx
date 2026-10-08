import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodePanel } from "./NodePanel";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { makeEdge, makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({
  getNode: vi.fn(async () => ({ images: [] })),
  getAttackHistory: vi.fn(async () => [{ attackerId: { _id: "u2", username: "rival" }, weapon: "sword", damage: 7 }]),
  updateNode: vi.fn(),
  attackNode: vi.fn(),
  protectNode: vi.fn(),
  unpackNode: vi.fn(),
}));
vi.mock("../api/edges", () => ({ deleteEdge: vi.fn() }));
import * as nodesApi from "../api/nodes";

const en = TRANSLATIONS.en;

function renderPanel(overrides: Partial<Parameters<typeof NodePanel>[0]> = {}) {
  const node = makeNode({ nodeId: "a", text: "The claim", title: "Claim" });
  const nodes: NodeDoc[] = [
    node,
    makeNode({ nodeId: "b", text: "Other node" }),
    makeNode({ nodeId: "p", text: "Packed one", packedIntoNodeId: "a" }),
  ];
  const props = {
    node,
    nodes,
    edges: [makeEdge("a", "b")],
    currentUserId: "u1",
    discussionMode: true,
    isMapOwner: true,
    onApplyTemplate: vi.fn(async () => {}),
    onClose: vi.fn(),
    onDeleted: vi.fn(),
    onUpdated: vi.fn(),
    onAttacked: vi.fn(),
    onDeleteEdge: vi.fn(),
    onStartChoose: vi.fn(),
    onSelectNode: vi.fn(),
    onEdit: vi.fn(),
    onProtected: vi.fn(),
    onStartPack: vi.fn(),
    onUnpacked: vi.fn(),
    isClusterParent: false,
    onExtractText: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <NodePanel {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("NodePanel", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mc_language", "en");
  });

  it("opens on Info with the owner's editable text", () => {
    renderPanel();
    expect(screen.getByDisplayValue("The claim")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
  });

  it("saves edited text on Enter and closes", async () => {
    const user = userEvent.setup();
    const updated = makeNode({ nodeId: "a", text: "New claim" });
    vi.mocked(nodesApi.updateNode).mockResolvedValue(updated);
    const props = renderPanel();
    const box = screen.getByDisplayValue("The claim");
    await user.clear(box);
    await user.type(box, "New claim{Enter}");
    expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { text: "New claim" });
    expect(props.onUpdated).toHaveBeenCalledWith(updated);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows each tab's content", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: en.map.panelTabs.modify }));
    expect(screen.getByText(/Other node/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: en.map.panelTabs.attack }));
    expect(screen.getByLabelText(en.ui.attack.objection)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: en.map.panelTabs.protect }));
    expect(screen.getByLabelText(en.ui.protect.why)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: en.map.panelTabs.packed(1) }));
    expect(screen.getByText("Packed one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: en.map.panelTabs.history }));
    expect(await screen.findByText("-7")).toBeInTheDocument();
  });

  it("hides Protect in Personal mode", () => {
    renderPanel({ discussionMode: false });
    expect(screen.queryByRole("button", { name: en.map.panelTabs.protect })).toBeNull();
  });
});

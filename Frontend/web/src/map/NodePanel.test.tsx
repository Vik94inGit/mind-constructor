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
    onDelete: vi.fn().mockResolvedValue(true),
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
    await user.click(screen.getByRole("tab", { name: en.map.panelTabs.modify }));
    expect(screen.getByText(/Other node/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: en.map.panelTabs.attack }));
    expect(screen.getByLabelText(en.ui.attack.objection)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: en.map.panelTabs.protect }));
    expect(screen.getByLabelText(en.ui.protect.why)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: en.map.panelTabs.packed(1) }));
    expect(screen.getByText("Packed one")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: en.map.panelTabs.history }));
    expect(await screen.findByText("-7")).toBeInTheDocument();
  });

  it("tabs through the type, the open tab, close and the text before the arrows", async () => {
    const user = userEvent.setup();
    renderPanel({ onStepNode: vi.fn() });
    await user.tab();
    expect(screen.getByRole("radio", { checked: true })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("tab", { name: en.map.panelTabs.info })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: en.ui.common.close })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: en.ui.node.textLabel })).toHaveFocus();
    const close = screen.getByRole("button", { name: en.ui.common.close });
    const prev = screen.getByRole("button", { name: en.ui.node.prevNode });
    expect(close.compareDocumentPosition(prev) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("switches tabs with the arrow keys, one Tab stop for the row", async () => {
    const user = userEvent.setup();
    renderPanel();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.filter((el) => el.tabIndex === 0)).toHaveLength(1);
    screen.getByRole("tab", { name: en.map.panelTabs.info }).focus();
    await user.keyboard("{ArrowRight}");
    const modify = screen.getByRole("tab", { name: en.map.panelTabs.modify });
    expect(modify).toHaveFocus();
    expect(modify).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", modify.id);
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: en.map.panelTabs.history })).toHaveAttribute("aria-selected", "true");
  });

  it("moves between types with the arrows without changing the type", async () => {
    const user = userEvent.setup();
    renderPanel();
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((el) => el.tabIndex === 0)).toEqual([screen.getByRole("radio", { checked: true })]);
    vi.mocked(nodesApi.updateNode).mockClear();
    screen.getByRole("radio", { checked: true }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).not.toBe(screen.getByRole("radio", { checked: true }));
    expect(document.activeElement).toHaveAttribute("role", "radio");
    expect(nodesApi.updateNode).not.toHaveBeenCalled();
  });

  it("opens an attack on your node on its Attack tab", () => {
    const attack = makeNode({ nodeId: "w", text: "Their objection", type: "Problem", userId: "u2", isWeapon: true, weaponIcon: "spear", targetNodeId: "b", parentId: "b" });
    const nodes = [makeNode({ nodeId: "b", text: "Mine" }), attack];
    renderPanel({ node: attack, nodes, edges: [] });
    expect(document.querySelector("#attack-text")).not.toBeNull();
  });

  it("opens an attack reached with the arrows on Info", () => {
    const attack = makeNode({ nodeId: "w", text: "Their objection", type: "Problem", userId: "u2", isWeapon: true, weaponIcon: "spear", targetNodeId: "b", parentId: "b" });
    const nodes = [makeNode({ nodeId: "b", text: "Mine" }), attack];
    renderPanel({ node: attack, nodes, edges: [], stepped: true });
    expect(document.querySelector("#attack-text")).toBeNull();
    expect(screen.getByText("Their objection")).toBeInTheDocument();
  });

  it("hides Protect in Personal mode", () => {
    renderPanel({ discussionMode: false });
    expect(screen.queryByRole("tab", { name: en.map.panelTabs.protect })).toBeNull();
  });

  it("hides Attack in Personal mode", () => {
    renderPanel({ discussionMode: false });
    expect(screen.queryByRole("tab", { name: en.map.panelTabs.attack })).toBeNull();
    expect(screen.getByRole("tab", { name: en.map.panelTabs.info })).toBeInTheDocument();
  });

  it("offers Swap with parent on the Info tab, and swaps when pressed", async () => {
    const onSwapWithParent = vi.fn();
    renderPanel({ onSwapWithParent });
    await userEvent.click(screen.getByRole("button", { name: new RegExp(en.ui.canvas.swapWithParent) }));
    expect(onSwapWithParent).toHaveBeenCalled();
  });

  it("has no Swap with parent without a parent to swap with", () => {
    renderPanel();
    expect(document.querySelector("[data-swap-parent]")).toBeNull();
  });
});

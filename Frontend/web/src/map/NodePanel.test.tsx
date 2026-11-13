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

  it("offers Split into nodes right under the text, on what's typed there", async () => {
    const user = userEvent.setup();
    vi.mocked(nodesApi.updateNode).mockResolvedValue(makeNode({ nodeId: "a", text: "The claim. A reason." }));
    const onSplitText = vi.fn();
    renderPanel({ onSplitText });
    const box = screen.getByDisplayValue("The claim");
    await user.type(box, ". A reason.");
    await user.click(screen.getByRole("button", { name: en.ui.textNodes.splitEntry }));
    expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { text: "The claim. A reason." });
    expect(onSplitText).toHaveBeenCalledWith("The claim. A reason.");
  });

  it("has no Split into nodes when the node can't be split", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: en.ui.textNodes.splitEntry })).toBeNull();
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

  it("turns Edit into Save change once the text is edited, and saves on it", async () => {
    const user = userEvent.setup();
    const updated = makeNode({ nodeId: "a", text: "The claim, edited" });
    vi.mocked(nodesApi.updateNode).mockClear();
    vi.mocked(nodesApi.updateNode).mockResolvedValue(updated);
    const props = renderPanel();
    expect(screen.getByRole("button", { name: en.ui.common.edit })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.ui.node.saveText })).toBeNull();
    await user.type(screen.getByDisplayValue("The claim"), ", edited");
    await user.click(screen.getByRole("button", { name: en.ui.node.saveText }));
    expect(nodesApi.updateNode).toHaveBeenCalledTimes(1);
    expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { text: "The claim, edited" });
    expect(props.onUpdated).toHaveBeenCalledWith(updated);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("keeps Edit, putting the cursor in the text, while nothing has changed", async () => {
    const user = userEvent.setup();
    vi.mocked(nodesApi.updateNode).mockClear();
    const props = renderPanel();
    await user.click(screen.getByRole("button", { name: en.ui.common.edit }));
    expect(screen.getByDisplayValue("The claim")).toHaveFocus();
    expect(nodesApi.updateNode).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
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

  it("tabs through the open tab, close and the text before the arrows", async () => {
    const user = userEvent.setup();
    renderPanel({ onStepNode: vi.fn() });
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

  it("has no row of types to pick from: the type changes from the ring of ghosts", () => {
    renderPanel();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("opens an attack on your node on Info, its Attack tab set to strike back", async () => {
    const attack = makeNode({ nodeId: "w", text: "Their objection", type: "Problem", userId: "u2", isWeapon: true, weaponIcon: "spear", targetNodeId: "b", parentId: "b" });
    const nodes = [makeNode({ nodeId: "b", text: "Mine" }), attack];
    renderPanel({ node: attack, nodes, edges: [] });
    expect(document.querySelector("#attack-text")).toBeNull();
    expect(screen.getByText("Their objection")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: en.map.panelTabs.attack }));
    expect(document.querySelector("#attack-text")).not.toBeNull();
  });

  it("shows the text and its Edit / Save change before the pictures", () => {
    renderPanel();
    const pictures = screen.getByTestId("info-pictures");
    const edit = document.querySelector("[data-text-edit]")!;
    const text = document.querySelector("#node-text")!;
    expect(text.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(edit.compareDocumentPosition(pictures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

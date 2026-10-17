import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiegePanel } from "./SiegePanel";
import { I18nProvider } from "../i18n/I18nContext";
import { UI_STRINGS } from "../i18n/uiStrings";
import { makeNode } from "../test/fixtures";
import * as nodesApi from "../api/nodes";

vi.mock("../api/nodes", () => ({ attackNode: vi.fn(), protectNode: vi.fn() }));

const s = UI_STRINGS.en.siege;

const nodes = [
  makeNode({ nodeId: "k", type: "Problem", text: "No app" }),
  makeNode({ nodeId: "app", type: "Option", parentId: "k", text: "Build an app" }),
  makeNode({ nodeId: "a1", type: "Success", parentId: "app", text: "People use it" }),
  makeNode({ nodeId: "a2", type: "Fail", parentId: "app", text: "Nobody cares" }),
  makeNode({ nodeId: "tt", type: "Option", parentId: "k", text: "TikTok" }),
  makeNode({ nodeId: "t1", type: "Success", parentId: "tt", text: "Views" }),
  makeNode({ nodeId: "t2", type: "Fail", parentId: "tt", text: "No views" }),
];
const holds = [
  { rootId: "k", kind: "kingdom" as const, name: "No app" },
  { rootId: "app", kind: "castle" as const, name: "Build an app" },
  { rootId: "tt", kind: "castle" as const, name: "TikTok" },
];

function renderPanel() {
  const handlers = { onAttacked: vi.fn(), onProtected: vi.fn(), onFocus: vi.fn(), onStrikeBack: vi.fn(), onExit: vi.fn() };
  render(
    <I18nProvider>
      <SiegePanel holds={holds} nodes={nodes} {...handlers} />
    </I18nProvider>,
  );
  return handlers;
}

describe("SiegePanel", () => {
  it("offers sally and fortify only to an attacking castle", async () => {
    renderPanel();
    expect(screen.getByRole("radio", { name: new RegExp(s.strategies.sally.name) })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(s.attacker), "tt");
    expect(screen.getByRole("radio", { name: new RegExp(s.strategies.sally.name) })).toBeEnabled();
  });

  it("places the strategy's move on the map and hands the turn back", async () => {
    const res = { node: nodes[2], weaponNode: makeNode({ nodeId: "w" }), healedParent: null, blocked: false, protector: null };
    vi.mocked(nodesApi.attackNode).mockResolvedValue(res as never);
    const { onAttacked, onFocus } = renderPanel();
    await userEvent.selectOptions(screen.getByLabelText(s.target), "app");
    await userEvent.click(screen.getByRole("radio", { name: new RegExp(s.strategies.assault.name) }));
    await userEvent.click(screen.getByRole("button", { name: s.go }));
    expect(nodesApi.attackNode).toHaveBeenCalledWith("a2", "fatalFlaw", { type: "Fail", text: s.moves.assault("Nobody cares"), byOpponent: true });
    expect(onAttacked).toHaveBeenCalledWith(res);
    expect(onFocus).toHaveBeenCalledWith("a2");
    expect(screen.getByText(s.done(s.strategies.assault.name, "Nobody cares"))).toBeInTheDocument();
  });

  it("lets you strike back at the opponent's last attack", async () => {
    const res = { node: nodes[2], weaponNode: makeNode({ nodeId: "w" }), healedParent: null, blocked: false, protector: null };
    vi.mocked(nodesApi.attackNode).mockResolvedValue(res as never);
    const { onStrikeBack } = renderPanel();
    expect(screen.queryByRole("button", { name: s.strikeBack })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: s.go }));
    await userEvent.click(screen.getByRole("button", { name: s.strikeBack }));
    expect(onStrikeBack).toHaveBeenCalledWith("w");
  });

  it("fortifies the attacking castle's own keep", async () => {
    vi.mocked(nodesApi.protectNode).mockResolvedValue({ success: true, protectionNode: nodes[4], healedNode: nodes[4] });
    const { onProtected } = renderPanel();
    await userEvent.selectOptions(screen.getByLabelText(s.attacker), "tt");
    await userEvent.click(screen.getByRole("radio", { name: new RegExp(s.strategies.fortify.name) }));
    await userEvent.click(screen.getByRole("button", { name: s.go }));
    expect(nodesApi.protectNode).toHaveBeenCalledWith("tt", { type: "Solution", text: s.moves.fortify("TikTok"), byOpponent: true });
    expect(onProtected).toHaveBeenCalled();
  });
});

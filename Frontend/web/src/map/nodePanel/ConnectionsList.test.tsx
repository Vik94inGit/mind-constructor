import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionsList } from "./ConnectionsList";
import { I18nProvider } from "../../i18n/I18nContext";
import { TRANSLATIONS } from "../../i18n/translations";
import { makeNode } from "../../test/fixtures";
import type { EdgeDoc } from "../../types";

const en = TRANSLATIONS.en.ui;
const nodes = [
  makeNode({ nodeId: "a", text: "Root" }),
  makeNode({ nodeId: "b", text: "Middle", parentId: "a" }),
  makeNode({ nodeId: "c", text: "Leaf $x^2$", parentId: "b" }),
  makeNode({ nodeId: "d", text: "Far" }),
];
const edges = [{ edgeId: "e1", fromNodeId: "b", toNodeId: "d", sentiment: "positive" }] as unknown as EdgeDoc[];

function setup(canEdit = true) {
  const props = { onSelectNode: vi.fn(), onUnhook: vi.fn(), onDeleteEdge: vi.fn(), onChangeParent: vi.fn() };
  render(
    <I18nProvider>
      <ConnectionsList node={nodes[1]} nodes={nodes} edges={edges} canEditOwn={canEdit} canEditChildren={canEdit} busy={false} {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("ConnectionsList", () => {
  it("lists the parent, the children and the links, formulas readable", () => {
    setup();
    expect(screen.getByText(/↑ Root/)).toBeTruthy();
    expect(screen.getByText(/↓ Leaf x²/)).toBeTruthy();
    expect(screen.getByText(/→ Far/)).toBeTruthy();
  });

  it("changes them: the parent, a child, a link", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: en.history.changeParent }));
    expect(p.onChangeParent).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: en.contextMenu.unlinkFromParent("Root") }));
    expect(p.onUnhook).toHaveBeenCalledWith(nodes[1]);
    await userEvent.click(screen.getByRole("button", { name: en.contextMenu.unlinkChild("Leaf x²") }));
    expect(p.onUnhook).toHaveBeenCalledWith(nodes[2]);
    await userEvent.click(screen.getByRole("button", { name: en.contextMenu.unlinkEdge("Far") }));
    expect(p.onDeleteEdge).toHaveBeenCalledWith("e1");
    await userEvent.click(screen.getByText(/↑ Root/));
    expect(p.onSelectNode).toHaveBeenCalledWith("a");
  });

  it("offers no branch changes to someone who can't make them", () => {
    setup(false);
    expect(screen.queryByRole("button", { name: en.history.changeParent })).toBeNull();
    expect(screen.queryByRole("button", { name: en.contextMenu.unlinkChild("Leaf x²") })).toBeNull();
  });
});

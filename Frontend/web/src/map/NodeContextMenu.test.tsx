import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { NodeContextMenu } from "./NodeContextMenu";

const en = TRANSLATIONS.en;
const noop = () => {};

function setup(props: Partial<Parameters<typeof NodeContextMenu>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <NodeContextMenu
        x={10}
        y={10}
        isOwner
        canAttack={false}
        nodeType="Problem"
        onCreate={noop}
        onEdit={noop}
        onChangeType={noop}
        onDelete={noop}
        onChoose={noop}
        onAttack={noop}
        onClose={onClose}
        {...props}
      />
    </I18nProvider>,
  );
  return { onClose };
}

describe("NodeContextMenu", () => {
  it("removes one link, or all of them, from the Remove links submenu", () => {
    const removeParent = vi.fn();
    const removeEdge = vi.fn();
    const removeAll = vi.fn();
    const { onClose } = setup({
      links: [
        { key: "p", label: en.ui.contextMenu.unlinkFromParent("Root"), onRemove: removeParent },
        { key: "e", label: en.ui.contextMenu.unlinkEdge("Other"), onRemove: removeEdge },
      ],
      onRemoveAllLinks: removeAll,
    });
    fireEvent.click(screen.getByText(`${en.ui.contextMenu.unlink} ›`));
    fireEvent.click(screen.getByText(new RegExp(en.ui.contextMenu.unlinkEdge("Other"))));
    expect(removeEdge).toHaveBeenCalled();
    expect(removeParent).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("has no Remove links entry for a node with no links", () => {
    setup();
    expect(screen.queryByText(`${en.ui.contextMenu.unlink} ›`)).toBeNull();
  });

  it("picks a parent's zone layout", () => {
    const onPick = vi.fn();
    setup({ zoneLayout: { value: null, onPick } });
    fireEvent.click(screen.getByText(`${en.ui.contextMenu.zones} ›`));
    fireEvent.click(screen.getByText(en.ui.display.zoneLayoutNested));
    expect(onPick).toHaveBeenCalledWith("nested");
  });

  it("sets the viewer's own feeling from the Feeling submenu, even on someone else's node", () => {
    const onPick = vi.fn();
    const { onClose } = setup({ isOwner: false, feeling: { value: undefined, onPick } });
    fireEvent.click(screen.getByText(`${en.ui.feelings.label} ›`));
    fireEvent.click(screen.getByText(en.ui.feelings.names.hopeful));
    expect(onPick).toHaveBeenCalledWith("hopeful");
    expect(onClose).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyMenu } from "./CopyMenu";
import { I18nProvider } from "../../i18n/I18nContext";
import { TRANSLATIONS } from "../../i18n/translations";

const n = TRANSLATIONS.en.ui.node;
const copy = TRANSLATIONS.en.ui.common.copy;

function setup(scopes?: { zone: boolean; above: boolean }) {
  const onCopy = vi.fn();
  render(
    <I18nProvider>
      <CopyMenu copied={false} scopes={scopes} onCopy={onCopy} />
    </I18nProvider>,
  );
  return { onCopy };
}

describe("CopyMenu", () => {
  it("copies a node alone in its branch straight away", async () => {
    const { onCopy } = setup({ zone: false, above: false });
    await userEvent.click(screen.getByRole("button", { name: copy }));
    expect(onCopy).toHaveBeenCalledWith("node");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers the node, its zone and the tree above it", async () => {
    const { onCopy } = setup({ zone: true, above: true });
    await userEvent.click(screen.getByRole("button", { name: new RegExp(copy) }));
    expect(screen.getAllByRole("menuitem").map((b) => b.textContent)).toEqual([n.copyNode, n.copyZone, n.copyAbove]);
    await userEvent.click(screen.getByRole("menuitem", { name: n.copyAbove }));
    expect(onCopy).toHaveBeenCalledWith("above");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves out what the node doesn't have", async () => {
    setup({ zone: true, above: false });
    await userEvent.click(screen.getByRole("button", { name: new RegExp(copy) }));
    expect(screen.getAllByRole("menuitem").map((b) => b.textContent)).toEqual([n.copyNode, n.copyZone]);
  });
});

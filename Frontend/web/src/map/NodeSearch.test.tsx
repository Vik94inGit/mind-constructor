import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NodeSearch } from "./NodeSearch";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import type { NodeDoc, NodeType } from "../types";

const t = TRANSLATIONS.en;

const node = (nodeId: string, type: NodeType, text: string) => ({ nodeId, type, text }) as NodeDoc;
const nodes = [node("a", "Idea", "Swap market"), node("b", "Problem", "No time"), node("c", "Idea", "Reading club")];

function Harness({ onTypes }: { onTypes: (types: NodeType[]) => void }) {
  const [types, setTypes] = useState<NodeType[]>([]);
  return (
    <I18nProvider>
      <NodeSearch
        nodes={nodes}
        onLoadTexts={() => Promise.resolve()}
        onMatches={vi.fn()}
        onPick={vi.fn()}
        types={types}
        onTypes={(next) => {
          onTypes(next);
          setTypes(next);
        }}
        onClose={vi.fn()}
      />
    </I18nProvider>
  );
}

describe("NodeSearch type filter", () => {
  it("offers only the types on the map and lists the nodes of a picked type", async () => {
    const onTypes = vi.fn();
    render(<Harness onTypes={onTypes} />);
    expect(screen.queryByRole("button", { name: new RegExp(t.ui.types.Fail) })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(t.ui.types.Idea) }));
    expect(onTypes).toHaveBeenLastCalledWith(["Idea"]);
    expect(screen.getByText("Swap market")).toBeTruthy();
    expect(screen.getByText("Reading club")).toBeTruthy();
    expect(screen.queryByText("No time")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: t.ui.search.clearTypes }));
    expect(onTypes).toHaveBeenLastCalledWith([]);
  });
});

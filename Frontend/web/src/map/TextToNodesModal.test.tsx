import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { TextToNodesModal } from "./TextToNodesModal";

const en = TRANSLATIONS.en;

function setup(room: number) {
  const onCreate = vi.fn(async () => {});
  const onClose = vi.fn();
  const findSpots = vi.fn((count: number) => Array.from({ length: Math.min(count, room) }, (_, i) => ({ x: i * 200, y: 0 })));
  render(
    <I18nProvider>
      <TextToNodesModal findSpots={findSpots} onCreate={onCreate} onClose={onClose} />
    </I18nProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText(en.split.textPlaceholder), { target: { value: "one\ntwo\nthree" } });
  fireEvent.click(screen.getByText(en.ui.textNodes.next));
  fireEvent.click(screen.getByText(en.ui.textNodes.splitLines));
  return { onCreate, onClose, findSpots };
}

describe("TextToNodesModal", () => {
  it("creates everything straight away when the map has room", async () => {
    const { onCreate, onClose } = setup(10);
    fireEvent.click(screen.getByText(en.ui.textNodes.add(4)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const plan = (onCreate.mock.calls[0] as unknown[])[0] as { pieces: { text: string }[]; packed: Set<string>; spots: unknown[] };
    expect(plan.pieces.map((p) => p.text)).toEqual(["one", "two", "three"]);
    expect(plan.packed.size).toBe(0);
    expect(plan.spots).toHaveLength(4);
  });

  it("says how many fit when the map is short of room, and packs the chosen pieces", async () => {
    const { onCreate, onClose } = setup(2);
    fireEvent.click(screen.getByText(en.ui.textNodes.add(4)));
    expect(screen.getByText(en.ui.textNodes.overflow(2, 4))).toBeTruthy();
    // The last two pieces come pre-chosen — main node + one piece shown.
    fireEvent.click(screen.getByText(en.ui.textNodes.addAndPack(2, 2)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const plan = (onCreate.mock.calls[0] as unknown[])[0] as { pieces: { id: string; text: string }[]; packed: Set<string> };
    const packedTexts = plan.pieces.filter((p) => plan.packed.has(p.id)).map((p) => p.text);
    expect(packedTexts).toEqual(["two", "three"]);
  });

  it("reports when there's no room at all", () => {
    const { onCreate } = setup(0);
    fireEvent.click(screen.getByText(en.ui.textNodes.add(4)));
    expect(screen.getByText(en.ui.textNodes.noRoom)).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("marks a piece by tapping its first and last word, then its type, and splits it into its own bubble", async () => {
    const onCreate = vi.fn(async () => {});
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <TextToNodesModal findSpots={(n) => Array.from({ length: n }, (_, i) => ({ x: i * 200, y: 0 }))} onCreate={onCreate} onClose={onClose} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(en.split.textPlaceholder), { target: { value: "I am tired. Maybe rest today." } });
    fireEvent.click(screen.getByText(en.ui.textNodes.next));
    // Last word first works too.
    fireEvent.click(screen.getByText("today."));
    expect(screen.getByText(en.split.startAt("today."))).toBeTruthy();
    fireEvent.click(screen.getByText("Maybe"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.ui.types.Option) }));
    const bubbles = screen.getAllByTestId("piece-bubble");
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0].textContent).toContain("Maybe rest today.");
    fireEvent.click(screen.getByText(en.ui.textNodes.add(2)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const plan = (onCreate.mock.calls[0] as unknown[])[0] as { pieces: { text: string; type: string }[] };
    expect(plan.pieces).toEqual([expect.objectContaining({ text: "Maybe rest today.", type: "Option" })]);
  });

  it("won't mark a piece across one already marked", () => {
    render(
      <I18nProvider>
        <TextToNodesModal findSpots={() => []} onCreate={vi.fn(async () => {})} onClose={vi.fn()} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(en.split.textPlaceholder), { target: { value: "one two three" } });
    fireEvent.click(screen.getByText(en.ui.textNodes.next));
    fireEvent.click(screen.getByText("two"));
    fireEvent.click(screen.getByText("two"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.ui.types.Option) }));
    // "two" is its own bubble now, between the bubbles holding "one" and "three".
    fireEvent.click(screen.getByText("one"));
    fireEvent.click(screen.getByText("three"));
    expect(screen.getByText(en.split.overlap)).toBeTruthy();
    expect(screen.getAllByTestId("piece-bubble")).toHaveLength(1);
  });
});

describe("TextToNodesModal parents", () => {
  it("hangs a piece from another piece or a node on the map, which then needs no spot", async () => {
    const onCreate = vi.fn(async () => {});
    const onClose = vi.fn();
    const findSpots = vi.fn((n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 200, y: 0 })));
    render(
      <I18nProvider>
        <TextToNodesModal
          findSpots={findSpots}
          onCreate={onCreate}
          onClose={onClose}
          mapNodes={[{ id: "existing", label: "Old child" }]}
        />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(en.split.textPlaceholder), { target: { value: "one\ntwo\nthree" } });
    fireEvent.click(screen.getByText(en.ui.textNodes.next));
    fireEvent.click(screen.getByText(en.ui.textNodes.splitLines));
    const selects = screen.getAllByLabelText(en.split.hangsFrom) as HTMLSelectElement[];
    expect(selects).toHaveLength(3);
    const firstId = Array.from(selects[1].options).find((o) => o.text === "one")!.value;
    fireEvent.change(selects[1], { target: { value: firstId } });
    fireEvent.change(selects[2], { target: { value: "existing" } });
    fireEvent.click(screen.getByText(en.ui.textNodes.add(4)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Main node + "one" + "two" on spots; "three" goes beside the map node.
    expect(findSpots).toHaveBeenCalledWith(3);
    const plan = (onCreate.mock.calls[0] as unknown[])[0] as { pieces: { id: string; text: string; parentId?: string }[] };
    const byText = Object.fromEntries(plan.pieces.map((p) => [p.text, p]));
    expect(byText.one.parentId).toBeUndefined();
    expect(byText.two.parentId).toBe(byText.one.id);
    expect(byText.three.parentId).toBe("existing");
  });
});

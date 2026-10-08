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
});

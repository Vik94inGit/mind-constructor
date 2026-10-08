import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAddGhosts } from "./QuickAddGhosts";
import { PendingNodeCard } from "./PendingNodeCard";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";

const en = TRANSLATIONS.en.ui;
const problemPhrases = en.node.ghostTemplates.Problem;

function renderGhosts() {
  const onPick = vi.fn();
  render(
    <I18nProvider>
      <QuickAddGhosts
        anchorPos={{ x: 1000, y: 800 }}
        bounds={{ minX: 0, minY: 0, maxX: 2400, maxY: 1600 }}
        onPick={onPick}
      />
    </I18nProvider>,
  );
  const ghost = () => screen.getAllByRole("button").find((b) => b.title.startsWith(en.types.Problem))!;
  return { onPick, ghost };
}

describe("QuickAddGhosts templates", () => {
  it("shows no starter phrases until a ghost is picked out", () => {
    renderGhosts();
    expect(screen.queryByText(problemPhrases[0])).toBeNull();
  });

  it("fans out the type's starter phrases on the first click, and a phrase opens the node with it", async () => {
    const user = userEvent.setup();
    const { onPick, ghost } = renderGhosts();
    await user.click(ghost());
    expect(onPick).not.toHaveBeenCalled();
    for (const phrase of problemPhrases) expect(screen.getByText(phrase)).not.toBeNull();

    await user.click(screen.getByText(problemPhrases[1]));
    expect(onPick).toHaveBeenCalledWith("Problem", expect.objectContaining({ x: expect.any(Number) }), problemPhrases[1]);
  });

  it("still opens a blank node on a second click on the ghost itself", async () => {
    const user = userEvent.setup();
    const { onPick, ghost } = renderGhosts();
    await user.click(ghost());
    await user.click(ghost());
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0]).toBe("Problem");
    expect(onPick.mock.calls[0][2]).toBeUndefined();
  });

  it("switches the phrases when another ghost is picked", async () => {
    const user = userEvent.setup();
    renderGhosts();
    await user.click(screen.getAllByRole("button").find((b) => b.title.startsWith(en.types.Fail))!);
    expect(screen.getByText(en.node.ghostTemplates.Fail[0])).not.toBeNull();
    expect(screen.queryByText(problemPhrases[0])).toBeNull();
  });
});

function renderEmojiGhosts(emojiFirst: boolean) {
  const onPick = vi.fn();
  render(
    <I18nProvider>
      <QuickAddGhosts
        anchorPos={{ x: 1000, y: 800 }}
        bounds={{ minX: 0, minY: 0, maxX: 2400, maxY: 1600 }}
        onPick={onPick}
        offerEmoji
        emojiFirst={emojiFirst}
      />
    </I18nProvider>,
  );
  return onPick;
}

const typeGhost = (type: keyof typeof en.types) =>
  screen.getAllByRole("button").find((b) => b.title.startsWith(en.types[type]))!;

describe("QuickAddGhosts emoji ring", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("offers the feelings after the type, and opens the node with both", async () => {
    const user = userEvent.setup();
    const onPick = renderEmojiGhosts(false);
    expect(screen.queryAllByTestId("emoji-ghost")).toHaveLength(0);
    await user.click(typeGhost("Problem"));
    await user.click(typeGhost("Problem"));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText(en.emoji.ringPrompt)).not.toBeNull();
    vi.setSystemTime(Date.now() + 1000);
    await user.click(screen.getByRole("button", { name: en.emoji.feelings[5] }));
    expect(onPick).toHaveBeenCalledWith("Problem", expect.any(Object), undefined, "😟");
  });

  it("the skip ghost opens the node with no emoji", async () => {
    const user = userEvent.setup();
    const onPick = renderEmojiGhosts(false);
    await user.click(typeGhost("Solution"));
    await user.click(typeGhost("Solution"));
    vi.setSystemTime(Date.now() + 1000);
    await user.click(screen.getByRole("button", { name: en.emoji.skip }));
    expect(onPick).toHaveBeenCalledWith("Solution", expect.any(Object), undefined, undefined);
  });

  it("ignores a tap landing on the new ring right after the last one", async () => {
    const user = userEvent.setup();
    const onPick = renderEmojiGhosts(false);
    await user.click(typeGhost("Problem"));
    await user.click(typeGhost("Problem"));
    await user.click(screen.getByRole("button", { name: en.emoji.feelings[0] }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it("in emoji-first mode offers the feelings first, then the types", async () => {
    const user = userEvent.setup();
    const onPick = renderEmojiGhosts(true);
    expect(screen.getAllByTestId("emoji-ghost")).toHaveLength(9);
    vi.setSystemTime(Date.now() + 1000);
    await user.click(screen.getByRole("button", { name: en.emoji.feelings[0] }));
    vi.setSystemTime(Date.now() + 1000);
    await user.click(typeGhost("Option"));
    await user.click(typeGhost("Option"));
    expect(onPick).toHaveBeenCalledWith("Option", expect.any(Object), undefined, "😊");
  });
});

describe("PendingNodeCard", () => {
  it("opens with a ghost template's phrase in the input", () => {
    render(
      <I18nProvider>
        <PendingNodeCard x={0} y={0} type="Problem" initialText="Root cause:" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </I18nProvider>,
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Root cause:");
  });
});

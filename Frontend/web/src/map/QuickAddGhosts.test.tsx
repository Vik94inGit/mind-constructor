import { describe, expect, it, vi } from "vitest";
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

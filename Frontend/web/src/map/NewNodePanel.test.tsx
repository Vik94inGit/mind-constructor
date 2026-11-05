import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewNodePanel } from "./NewNodePanel";
import { MAX_NODE_TEXT } from "../utils/nodeText";
import { I18nProvider } from "../i18n/I18nContext";
import { UI_STRINGS } from "../i18n/uiStrings";

const s = UI_STRINGS.en.newNode;

function renderPanel(prompt?: string) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(
    <I18nProvider>
      <NewNodePanel type="Option" prompt={prompt} onClearEmoji={vi.fn()} onCreate={onCreate} onCancel={vi.fn()} />
    </I18nProvider>,
  );
  return onCreate;
}

describe("NewNodePanel", () => {
  it("shows a picked starter phrase as the placeholder, never as text", () => {
    renderPanel("Alternative:");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByPlaceholderText("Alternative:")).toBeInTheDocument();
  });

  it("makes a ghost from a starter phrase when nothing is written", async () => {
    const onCreate = renderPanel("Alternative:");
    await userEvent.click(screen.getByRole("button", { name: s.createGhost }));
    expect(onCreate).toHaveBeenCalledWith("", "Option", [], "Alternative:");
  });

  it("keeps the starter phrase as the prompt of a written node", async () => {
    const onCreate = renderPanel("Alternative:");
    await userEvent.type(screen.getByRole("textbox"), "Hire a freelancer");
    await userEvent.click(screen.getByRole("button", { name: s.create }));
    expect(onCreate).toHaveBeenCalledWith("Hire a freelancer", "Option", [], "Alternative:");
  });

  it("turns what's written into the prompt with Ghost ticked", async () => {
    const onCreate = renderPanel();
    await userEvent.click(screen.getByRole("checkbox", { name: s.ghost }));
    await userEvent.type(screen.getByRole("textbox"), "Who pays for it?");
    await userEvent.click(screen.getByRole("button", { name: s.createGhost }));
    expect(onCreate).toHaveBeenCalledWith("", "Option", [], "Who pays for it?");
  });

  it("can't create an empty node with no prompt", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: s.create })).toBeDisabled();
  });

  it("pastes words into the text field even when the copy carries a picture too", () => {
    renderPanel();
    const picture = new File(["x"], "copy.png", { type: "image/png" });
    const clipboardData = {
      getData: (type: string) => (type === "text/plain" ? "copied words" : ""),
      items: [{ kind: "file", type: "image/png", getAsFile: () => picture }],
      files: [picture],
    };
    const notPrevented = fireEvent.paste(screen.getByRole("textbox"), { clipboardData });
    expect(notPrevented).toBe(true);
  });

  it("still takes a bare screenshot as a picture", () => {
    renderPanel();
    const picture = new File(["x"], "shot.png", { type: "image/png" });
    const clipboardData = {
      getData: () => "",
      items: [{ kind: "file", type: "image/png", getAsFile: () => picture }],
      files: [picture],
    };
    const notPrevented = fireEvent.paste(screen.getByRole("textbox"), { clipboardData });
    expect(notPrevented).toBe(false);
  });

  it("offers a long paste's rest for a new node and sends it along with Create", async () => {
    const onCreate = renderPanel();
    const o = UI_STRINGS.en.textOverflow;
    const long = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const field = screen.getByRole("textbox");
    fireEvent.paste(field, { clipboardData: { getData: () => long } });
    const kept = (field as HTMLTextAreaElement).value;
    expect(kept.length).toBeLessThanOrEqual(MAX_NODE_TEXT);
    await userEvent.click(screen.getByRole("button", { name: o.carry(1) }));
    expect(screen.getByText(o.willCarry(1))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: s.create }));
    const [text, , , , overflow] = onCreate.mock.calls[0];
    expect(`${text} ${overflow}`).toBe(long);
  });

  it("drops a long paste's rest when it's left out", async () => {
    const onCreate = renderPanel();
    const o = UI_STRINGS.en.textOverflow;
    fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { getData: () => "x ".repeat(700) } });
    await userEvent.click(screen.getByRole("button", { name: o.leave }));
    expect(screen.queryByTestId("text-overflow-offer")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: s.create }));
    expect(onCreate.mock.calls[0]).toHaveLength(4);
  });
});

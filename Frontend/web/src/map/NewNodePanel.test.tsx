import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewNodePanel } from "./NewNodePanel";
import { I18nProvider } from "../i18n/I18nContext";
import { UI_STRINGS } from "../i18n/uiStrings";

const s = UI_STRINGS.en.newNode;

function renderPanel(prompt?: string) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(
    <I18nProvider>
      <NewNodePanel type="Option" prompt={prompt} onTypeChange={vi.fn()} onClearEmoji={vi.fn()} onCreate={onCreate} onCancel={vi.fn()} />
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
});

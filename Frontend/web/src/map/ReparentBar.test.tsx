import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReparentBar } from "./ReparentBar";
import { I18nProvider } from "../i18n/I18nContext";

function renderBar(error: string | null = null) {
  const onCancel = vi.fn();
  render(
    <I18nProvider>
      <ReparentBar childName="Remote job" error={error} onCancel={onCancel} />
    </I18nProvider>,
  );
  return onCancel;
}

describe("ReparentBar", () => {
  it("names the node whose parent is changing", () => {
    renderBar();
    expect(screen.getByText(/Remote job/)).toBeTruthy();
  });

  it("shows why a tapped node can't be the parent", () => {
    renderBar("That is already its parent.");
    expect(screen.getByText("That is already its parent.")).toBeTruthy();
  });

  it("cancels", () => {
    const onCancel = renderBar();
    fireEvent.click(screen.getByRole("button"));
    expect(onCancel).toHaveBeenCalled();
  });
});

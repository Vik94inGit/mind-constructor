import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "../i18n/I18nContext";
import { GestureHint } from "./GestureHint";

const renderHint = () =>
  render(
    <I18nProvider>
      <GestureHint />
    </I18nProvider>,
  );

describe("GestureHint", () => {
  beforeEach(() => localStorage.clear());

  it("shows on the first map, and not again once dismissed", async () => {
    const first = renderHint();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();
    renderHint();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

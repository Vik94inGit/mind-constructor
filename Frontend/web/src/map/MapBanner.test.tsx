import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapBanner } from "./MapBanner";

describe("MapBanner", () => {
  it("shows the message in its tone and dismisses on ✕", async () => {
    const onDismiss = vi.fn();
    render(<MapBanner tone="danger" message="Could not save" onDismiss={onDismiss} />);
    const text = screen.getByText("Could not save");
    expect(text).toHaveClass("bg-danger-bg", "text-danger");
    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

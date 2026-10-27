import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import { CheckInPrompt } from "./CheckInPrompt";
import { ASK_AFTER_MS } from "../utils/feeling";
import type { CheckIn } from "../utils/feeling";

const tf = TRANSLATIONS.en.ui.feelings;
const longAgo = { feeling: "worried" as const, strength: 4, at: Date.now() - ASK_AFTER_MS - 1000 };

function setup(checkIn: CheckIn | null | undefined, finished = false) {
  const onSave = vi.fn();
  const view = render(
    <I18nProvider>
      <CheckInPrompt mapId="m1" checkIn={checkIn} finished={finished} onSave={onSave} />
    </I18nProvider>,
  );
  return { onSave, ...view };
}

describe("CheckInPrompt", () => {
  beforeEach(() => localStorage.clear());

  it("asks 'And now?' on a later visit, and shows the shift once saved", () => {
    const { onSave } = setup({ before: longAgo, after: null });
    expect(screen.getByText(tf.after)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: tf.names.calm }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: tf.save }));
    expect(onSave).toHaveBeenCalledWith({ before: longAgo, after: expect.objectContaining({ feeling: "calm", strength: 2 }) });
    expect(screen.getByRole("status")).toHaveTextContent("😟 4 → 😌 2");
  });

  it("waits right after the map was built, unless the map is finished", () => {
    const fresh = { ...longAgo, at: Date.now() };
    const first = setup({ before: fresh });
    expect(screen.queryByTestId("check-in-prompt")).not.toBeInTheDocument();
    first.unmount();
    setup({ before: fresh }, true);
    expect(screen.getByTestId("check-in-prompt")).toBeInTheDocument();
  });

  it("stays quiet with no before, an after already given, or after 'Not now'", () => {
    const a = setup(null);
    expect(screen.queryByTestId("check-in-prompt")).not.toBeInTheDocument();
    a.unmount();
    const b = setup({ before: longAgo, after: { feeling: "calm", strength: 1, at: 1 } });
    expect(screen.queryByTestId("check-in-prompt")).not.toBeInTheDocument();
    b.unmount();
    const c = setup({ before: longAgo });
    fireEvent.click(screen.getByRole("button", { name: tf.notNow }));
    expect(screen.queryByTestId("check-in-prompt")).not.toBeInTheDocument();
    c.unmount();
    setup({ before: longAgo });
    expect(screen.queryByTestId("check-in-prompt")).not.toBeInTheDocument();
  });
});

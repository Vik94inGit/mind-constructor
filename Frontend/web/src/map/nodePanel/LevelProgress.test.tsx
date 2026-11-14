import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../../i18n/I18nContext";
import { TRANSLATIONS } from "../../i18n/translations";
import { LevelProgress } from "./LevelProgress";

const tt = TRANSLATIONS.en.ui.templates;

describe("LevelProgress", () => {
  it("says which level a template is on and lets you peek at the next one", () => {
    render(
      <I18nProvider>
        <LevelProgress progress={{ level: 1, levels: 3, left: 2, next: ["What is the plan?"], done: false }} />
      </I18nProvider>,
    );
    expect(screen.getByText(tt.progress(1, 3, 2))).toBeInTheDocument();
    fireEvent.click(screen.getByText(tt.peekNext(2)));
    expect(screen.getByText("What is the plan?")).toBeInTheDocument();
  });

  it("says every level is answered once it is, with nothing to peek at", () => {
    render(
      <I18nProvider>
        <LevelProgress progress={{ level: 3, levels: 3, left: 0, next: [], done: true }} />
      </I18nProvider>,
    );
    expect(screen.getByText(tt.progressDone(3))).toBeInTheDocument();
    expect(screen.queryByText(tt.peekNext(4))).toBeNull();
  });
});

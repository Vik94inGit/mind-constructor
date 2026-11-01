import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { I18nProvider, useI18n } from "./I18nContext";
import { loadTranslation, TRANSLATIONS } from "./translations";

function Probe() {
  const { t, setLanguage } = useI18n();
  return (
    <>
      <p>{t.ui.common.cancel}</p>
      <button onClick={() => setLanguage("uk")}>switch</button>
    </>
  );
}

afterEach(() => localStorage.clear());

describe("I18nProvider", () => {
  it("shows English straight away", () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByText(TRANSLATIONS.en.ui.common.cancel)).toBeTruthy();
  });

  it("loads a saved language before showing anything, with no English flash", async () => {
    localStorage.setItem("mc_language", "cs");
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.queryByText(TRANSLATIONS.en.ui.common.cancel)).toBeNull();
    expect(await screen.findByText("Zrušit")).toBeTruthy();
  });

  it("keeps the current language up until the new one has loaded", async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    await act(async () => screen.getByText("switch").click());
    const uk = await loadTranslation("uk");
    expect(await screen.findByText(uk.ui.common.cancel)).toBeTruthy();
  });

  it("every language has the same nested sections as English", async () => {
    for (const lang of ["cs", "uk", "ru"] as const) {
      const t = await loadTranslation(lang);
      expect(Object.keys(t.ui).sort()).toEqual(Object.keys(TRANSLATIONS.en.ui).sort());
      expect(Object.keys(t.ui.think).sort()).toEqual(Object.keys(TRANSLATIONS.en.ui.think).sort());
    }
  });
});

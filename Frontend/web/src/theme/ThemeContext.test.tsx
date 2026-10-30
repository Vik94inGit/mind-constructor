import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { THEME_COLOR, ThemeProvider, useTheme } from "./ThemeContext";

let api: ReturnType<typeof useTheme> | null = null;
function Grab() {
  api = useTheme();
  return null;
}

describe("ThemeProvider", () => {
  it("keeps the theme-color meta on the app's own theme, not the phone's", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = THEME_COLOR.light;
    document.head.appendChild(meta);
    document.documentElement.dataset.theme = "dark";

    render(
      <ThemeProvider>
        <Grab />
      </ThemeProvider>,
    );
    expect(meta.content).toBe(THEME_COLOR.dark);

    act(() => api!.setTheme("light"));
    expect(meta.content).toBe(THEME_COLOR.light);
    meta.remove();
  });
});

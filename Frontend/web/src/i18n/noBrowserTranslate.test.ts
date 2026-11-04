import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";

// The app ships its own translations; Chrome's page translation on top of
// them garbled the Russian menu and made node captions vanish on the map.
describe("index.html", () => {
  it("asks browsers not to translate the page", () => {
    expect(html).toMatch(/<html[^>]*translate="no"/);
    expect(html).toContain('<meta name="google" content="notranslate" />');
  });
});

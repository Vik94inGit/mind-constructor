import { describe, expect, it } from "vitest";
import { ghostDistance, ghostTouches } from "./ghostRing";

const ghost = { half: 26, labelBelow: 44, labelHalfWidth: 40 };

describe("ghostDistance", () => {
  it("keeps the radius when nothing was measured", () => {
    expect(ghostDistance(0, 104, null, ghost)).toBe(104);
  });

  it("keeps the radius around a round icon", () => {
    const icon = { left: -24, right: 24, top: -24, bottom: 24 };
    for (let i = 0; i < 8; i++) expect(ghostDistance((i / 8) * Math.PI * 2, 104, icon, ghost)).toBe(104);
  });

  it("walks every ghost off a picture card, names included", () => {
    // A ~150px card, like a selected parent drawn as a card on a phone.
    const card = { left: -76, right: 76, top: -90, bottom: 90 };
    for (let i = 0; i < 8; i++) {
      const angle = (-i / 8) * Math.PI * 2 - Math.PI / 2;
      const d = ghostDistance(angle, 104, card, ghost);
      expect(d).toBeGreaterThanOrEqual(104);
      expect(ghostTouches(Math.cos(angle) * d, Math.sin(angle) * d, card, ghost)).toBe(false);
    }
  });

  it("only moves as far as it has to", () => {
    const card = { left: -76, right: 76, top: -90, bottom: 90 };
    // Straight right: clear once the ghost's (and its name's) left edge passes the card's right edge.
    const d = ghostDistance(0, 104, card, ghost);
    expect(d).toBeGreaterThanOrEqual(116);
    expect(d).toBeLessThan(118);
  });

  it("clears a card that isn't centered on the ring", () => {
    const card = { left: -40, right: 40, top: -30, bottom: 160 };
    const down = ghostDistance(Math.PI / 2, 104, card, ghost);
    expect(down).toBeGreaterThanOrEqual(160 + ghost.half);
    expect(ghostDistance(-Math.PI / 2, 104, card, ghost)).toBe(104);
  });
});

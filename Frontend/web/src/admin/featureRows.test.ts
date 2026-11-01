import { describe, expect, it } from "vitest";
import { featureRows, FEATURE_EVENTS } from "./featureRows";
import { FEATURES } from "../utils/usage";

describe("featureRows", () => {
  it("lists every feature, unused ones first", () => {
    const rows = featureRows({
      events: [
        { name: "quick_note_added", count: 10, users: 3 },
        { name: "app_opened", count: 50, users: 4 },
      ],
      features: [{ name: "pack", count: 2, users: 1 }],
    });
    expect(rows).toHaveLength(FEATURE_EVENTS.length + FEATURES.length);
    expect(rows.some((r) => r.name === "app_opened")).toBe(false);
    expect(rows[rows.length - 1]).toMatchObject({ kind: "event", name: "quick_note_added", count: 10, users: 3 });
    expect(rows[rows.length - 2]).toMatchObject({ kind: "feature", name: "pack", count: 2, users: 1 });
    expect(rows[0].users).toBe(0);
  });

  it("works with a server that doesn't send features yet", () => {
    expect(featureRows({ events: [] }).every((r) => r.count === 0)).toBe(true);
  });
});

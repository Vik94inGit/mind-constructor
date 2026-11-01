import { describe, beforeEach, it, expect, vi } from "vitest";
import {
  countActiveUsersDao,
  countCreatedDao,
  countReturningUsersDao,
  dailyActivityDao,
  eventTotalsDao,
  featureTotalsDao,
  insertUsageEventsDao,
} from "../src/dao/usageDao.js";
import { getUsageSummaryAbl, MAX_EVENTS_PER_REQUEST, recordUsageAbl } from "../src/abl/usageAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/usageDao.js", () => ({
  insertUsageEventsDao: vi.fn(),
  countActiveUsersDao: vi.fn(),
  countReturningUsersDao: vi.fn(),
  dailyActivityDao: vi.fn(),
  eventTotalsDao: vi.fn(),
  featureTotalsDao: vi.fn(),
  countCreatedDao: vi.fn(),
}));

const now = new Date("2026-11-01T12:00:00.000Z");
const user = { _id: "user1", isDemo: false };
const inserted = () => vi.mocked(insertUsageEventsDao).mock.calls[0]![2];

describe("recordUsageAbl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps known events with their time and UTC day", async () => {
    const res = await recordUsageAbl(
      user,
      { events: [{ name: "quick_note_added", at: "2026-10-31T23:30:00.000Z" }, { name: "think_started" }] },
      now,
    );
    expect(res).toEqual({ recorded: 2 });
    expect(insertUsageEventsDao).toHaveBeenCalledWith("user1", false, expect.any(Array));
    expect(inserted()).toEqual([
      { name: "quick_note_added", props: undefined, at: new Date("2026-10-31T23:30:00.000Z"), day: "2026-10-31" },
      { name: "think_started", props: undefined, at: now, day: "2026-11-01" },
    ]);
  });

  it("drops unknown events, unknown labels and anything that isn't a short word", async () => {
    await recordUsageAbl(
      user,
      {
        events: [
          { name: "made_up_event" },
          { name: "node_created", props: { type: "Problem", text: "my secret thought" } },
          { name: "view_changed", props: { view: "my secret thought" } },
          { name: "feature_used", props: { feature: "pack" } },
        ],
      },
      now,
    );
    expect(inserted()).toEqual([
      { name: "node_created", props: { type: "Problem" }, at: now, day: "2026-11-01" },
      { name: "view_changed", props: undefined, at: now, day: "2026-11-01" },
      { name: "feature_used", props: { feature: "pack" }, at: now, day: "2026-11-01" },
    ]);
  });

  it("moves events onto the server's clock when the browser's clock is off", async () => {
    // The browser's clock is an hour ahead: its "now" is 13:00.
    await recordUsageAbl(
      user,
      { sentAt: "2026-11-01T13:00:00.000Z", events: [{ name: "think_started", at: "2026-11-01T12:59:00.000Z" }] },
      now,
    );
    expect(inserted()).toEqual([
      { name: "think_started", props: undefined, at: new Date("2026-11-01T11:59:00.000Z"), day: "2026-11-01" },
    ]);
  });

  it("drops events too old or unreadable, counts future ones as now, and marks a demo account", async () => {
    await recordUsageAbl(
      { _id: "demo1", isDemo: true },
      {
        events: [
          { name: "app_opened", at: "2026-10-01T00:00:00.000Z" },
          { name: "app_opened", at: "2026-11-02T00:00:00.000Z" },
          { name: "app_opened", at: "not a date" },
          { name: "app_opened", at: now.getTime() + 60_000 },
        ],
      },
      now,
    );
    expect(insertUsageEventsDao).toHaveBeenCalledWith("demo1", true, [
      { name: "app_opened", props: undefined, at: now, day: "2026-11-01" },
      { name: "app_opened", props: undefined, at: now, day: "2026-11-01" },
    ]);
  });

  it("rejects an empty or oversized batch", async () => {
    await expect(recordUsageAbl(user, { events: [] }, now)).rejects.toThrow(ValidationError);
    await expect(recordUsageAbl(user, {}, now)).rejects.toThrow(ValidationError);
    const many = Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, () => ({ name: "app_opened" }));
    await expect(recordUsageAbl(user, { events: many }, now)).rejects.toThrow(ValidationError);
    expect(insertUsageEventsDao).not.toHaveBeenCalled();
  });
});

describe("getUsageSummaryAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countActiveUsersDao).mockResolvedValue(3);
    vi.mocked(countReturningUsersDao).mockResolvedValue(2);
    vi.mocked(dailyActivityDao).mockResolvedValue([{ day: "2026-10-31", users: 2, events: 9 }]);
    vi.mocked(eventTotalsDao).mockResolvedValue([
      { name: "app_opened", count: 9, users: 2 },
      { name: "feature_used", count: 4, users: 1 },
    ]);
    vi.mocked(featureTotalsDao).mockResolvedValue([{ name: "pack", count: 4, users: 1 }]);
    vi.mocked(countCreatedDao).mockResolvedValue({ users: 10, newUsers: 1, maps: 4, nodes: 20 });
  });

  it("fills every day of the window, quiet days as zero", async () => {
    const s = await getUsageSummaryAbl({ days: "3" }, now);
    expect(s.since).toBe("2026-10-30T00:00:00.000Z");
    expect(s.daily).toEqual([
      { day: "2026-10-30", users: 0, events: 0 },
      { day: "2026-10-31", users: 2, events: 9 },
      { day: "2026-11-01", users: 0, events: 0 },
    ]);
    expect(s.active).toEqual({ today: 3, week: 3, month: 3, returning: 2 });
    expect(s.created.maps).toBe(4);
    expect(s.events).toEqual([{ name: "app_opened", count: 9, users: 2 }]);
    expect(s.features).toEqual([{ name: "pack", count: 4, users: 1 }]);
    expect(s.includeDemo).toBe(false);
    expect(countActiveUsersDao).toHaveBeenCalledWith(new Date("2026-11-01T00:00:00.000Z"), false);
  });

  it("defaults to 30 days, can include demo accounts, and rejects a bad window", async () => {
    const s = await getUsageSummaryAbl({ includeDemo: "true" }, now);
    expect(s.days).toBe(30);
    expect(s.daily).toHaveLength(30);
    expect(dailyActivityDao).toHaveBeenCalledWith(expect.any(Date), true);
    await expect(getUsageSummaryAbl({ days: "0" }, now)).rejects.toThrow(ValidationError);
    await expect(getUsageSummaryAbl({ days: "999" }, now)).rejects.toThrow(ValidationError);
  });
});

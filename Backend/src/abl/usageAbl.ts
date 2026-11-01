import { z } from "zod";
import {
  countActiveUsersDao,
  countCreatedDao,
  countReturningUsersDao,
  dailyActivityDao,
  eventTotalsDao,
  insertUsageEventsDao,
} from "../dao/usageDao.js";
import { parseOrThrow } from "./errors.js";

// Every event the app may record, and the labels each may carry. Anything
// else is dropped, so a thought's own text can never end up here: a label is
// a short word from a fixed vocabulary (a node type, a view name), never
// free text. Keep in step with Frontend/web/src/utils/usage.ts.
export const EVENT_PROPS = {
  app_opened: ["page"],
  page_viewed: ["page"],
  signed_up: ["method"],
  signed_in: ["method"],
  demo_started: [],
  quick_note_added: [],
  map_created: ["template", "shape"],
  node_created: ["type"],
  search_used: ["found"],
  think_started: [],
  think_finished: [],
  feeling_set: [],
  checked_in: ["moment"],
  text_split: [],
  picture_drawn: [],
  view_changed: ["view"],
  map_shared: [],
  node_attacked: ["weapon"],
  node_protected: [],
  map_finished: [],
  replay_played: [],
} as const satisfies Record<string, readonly string[]>;

export type UsageEventName = keyof typeof EVENT_PROPS;
export const USAGE_EVENTS = Object.keys(EVENT_PROPS) as UsageEventName[];

export const MAX_EVENTS_PER_REQUEST = 50;
// A browser may send events it kept while offline, but nothing older than a
// week, nor from the future (allowing for a slightly fast clock).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 5 * 60 * 1000;

const LABEL = /^[A-Za-z0-9_-]{1,32}$/;

const eventSchema = z.object({
  name: z.string().max(40),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  at: z.union([z.string(), z.number()]).optional(),
});
const recordSchema = z.object({
  events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_REQUEST),
});

const isKnown = (name: string): name is UsageEventName => Object.hasOwn(EVENT_PROPS, name);

const cleanProps = (name: UsageEventName, props: Record<string, unknown> | undefined) => {
  if (!props) return undefined;
  const out: Record<string, string> = {};
  for (const key of EVENT_PROPS[name] as readonly string[]) {
    const value = props[key];
    if (value === undefined) continue;
    const text = String(value);
    if (LABEL.test(text)) out[key] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const eventTime = (at: string | number | undefined, now: Date) => {
  if (at === undefined) return now;
  const time = new Date(at);
  const t = time.getTime();
  if (Number.isNaN(t) || t > now.getTime() + MAX_AHEAD_MS || t < now.getTime() - MAX_AGE_MS) return null;
  return t > now.getTime() ? now : time;
};

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

// Keeps what the signed-in user did. Unknown events, unknown labels and
// out-of-range times are dropped quietly rather than failing the batch: an
// older or newer frontend shouldn't lose the rest of what it sent.
export const recordUsageAbl = async (
  user: { _id: string; isDemo?: boolean },
  input: unknown,
  now: Date = new Date(),
) => {
  const { events } = parseOrThrow(recordSchema, input);
  const rows = [];
  for (const e of events) {
    if (!isKnown(e.name)) continue;
    const at = eventTime(e.at, now);
    if (!at) continue;
    rows.push({ name: e.name, props: cleanProps(e.name, e.props), at, day: utcDay(at) });
  }
  await insertUsageEventsDao(user._id, !!user.isDemo, rows);
  return { recorded: rows.length };
};

const summarySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  includeDemo: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
});

const DAY_MS = 24 * 60 * 60 * 1000;

// The admin page's picture of how the app is used over the last `days` days.
export const getUsageSummaryAbl = async (query: unknown, now: Date = new Date()) => {
  const { days, includeDemo } = parseOrThrow(summarySchema, query ?? {});
  // Whole UTC days: today counts as one of them.
  const todayStart = new Date(`${utcDay(now)}T00:00:00.000Z`);
  const since = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
  const ago = (n: number) => new Date(now.getTime() - n * DAY_MS);

  const [today, week, month, returning, daily, events, created] = await Promise.all([
    countActiveUsersDao(todayStart, includeDemo),
    countActiveUsersDao(ago(7), includeDemo),
    countActiveUsersDao(ago(30), includeDemo),
    countReturningUsersDao(since, includeDemo),
    dailyActivityDao(since, includeDemo),
    eventTotalsDao(since, includeDemo),
    countCreatedDao(since, includeDemo),
  ]);

  // Every day in the window, with zeros for quiet days, so a chart has no gaps.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const day = utcDay(new Date(since.getTime() + i * DAY_MS));
    series.push({ day, users: byDay.get(day)?.users ?? 0, events: byDay.get(day)?.events ?? 0 });
  }

  return {
    days,
    includeDemo,
    since: since.toISOString(),
    active: { today, week, month, returning },
    created,
    daily: series,
    events,
  };
};

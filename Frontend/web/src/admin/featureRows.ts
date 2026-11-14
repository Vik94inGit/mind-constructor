import type { UsageSummary } from "../api/usage";
import { FEATURES } from "../utils/usage";

// Named events that are features in their own right (not sign-ins or page views).
export const FEATURE_EVENTS = [
  "quick_note_added",
  "map_created",
  "node_created",
  "search_used",
  "think_started",
  "think_finished",
  "feeling_set",
  "checked_in",
  "text_split",
  "picture_drawn",
  "view_changed",
  "map_shared",
  "node_attacked",
  "node_protected",
  "map_finished",
  "replay_played",
  "template_level_opened",
  "template_finished",
] as const;

export interface FeatureRow {
  /** "event:<name>" or "feature:<name>", so the two lists can't collide. */
  key: string;
  kind: "event" | "feature";
  name: string;
  count: number;
  users: number;
}

/**
 * Every feature the app has, with how often and by how many people it was
 * used, unused ones included, least used first (fewest people, then fewest uses).
 */
export function featureRows(summary: Pick<UsageSummary, "events" | "features">): FeatureRow[] {
  const events = new Map(summary.events.map((e) => [e.name, e]));
  const features = new Map((summary.features ?? []).map((f) => [f.name, f]));
  const rows: FeatureRow[] = [
    ...FEATURE_EVENTS.map((name) => ({ key: `event:${name}`, kind: "event" as const, name, count: events.get(name)?.count ?? 0, users: events.get(name)?.users ?? 0 })),
    ...FEATURES.map((name) => ({ key: `feature:${name}`, kind: "feature" as const, name, count: features.get(name)?.count ?? 0, users: features.get(name)?.users ?? 0 })),
  ];
  return rows.sort((a, b) => a.users - b.users || a.count - b.count);
}

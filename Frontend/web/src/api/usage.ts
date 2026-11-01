import { apiRequest } from "./client";

/** What Backend's GET /api/usage/summary answers (abl/usageAbl.ts getUsageSummaryAbl). */
export interface UsageSummary {
  days: number;
  includeDemo: boolean;
  since: string;
  active: { today: number; week: number; month: number; returning: number };
  created: { users: number; newUsers: number; maps: number; nodes: number };
  daily: { day: string; users: number; events: number }[];
  events: { name: string; count: number; users: number }[];
  /** Per feature in utils/usage.ts FEATURES (only the ones used at all). */
  features?: { name: string; count: number; users: number }[];
}

/** Admin only: how the app was used over the last `days` days. Always fresh, never the offline copy. */
export async function getUsageSummary(days: number, includeDemo: boolean): Promise<UsageSummary> {
  const res = await apiRequest<{ success: boolean; summary: UsageSummary }>(
    `/api/usage/summary?days=${days}&includeDemo=${includeDemo}`,
    { cache: false },
  );
  return res.summary;
}

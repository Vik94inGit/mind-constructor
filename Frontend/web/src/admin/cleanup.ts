import type { AdminMap, AdminUser } from "../api/admin";

/** How long an account must sit idle to count as unused; mirrors Backend's adminAbl.ts. */
export const UNUSED_IDLE_DAYS = 30;

/** The accounts the "Delete unused profiles" button would remove, never the viewer's own. */
export function unusedProfiles(users: AdminUser[], meId: string | undefined): AdminUser[] {
  return users.filter((u) => u.unused && u.role !== "admin" && u._id !== meId);
}

/** The names a confirmation shows: the first few, then how many more. */
export function namesPreview(names: string[], shown = 8): { names: string; more: number } {
  return { names: names.slice(0, shown).join(", "), more: Math.max(0, names.length - shown) };
}

/** Maps whose name or owner contains the query, ignoring case. */
export function filterMaps(maps: AdminMap[], query: string): AdminMap[] {
  const q = query.trim().toLowerCase();
  if (!q) return maps;
  return maps.filter((m) => m.name.toLowerCase().includes(q) || (m.ownerName ?? "").toLowerCase().includes(q));
}

/** A date as the admin page shows it, or null when there is none. */
export function shortDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

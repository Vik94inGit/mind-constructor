// Several node panels open at once (docs/gestures/several-panels.md).
//
// The active panel is MapPage's selectedId; `others` are the panels kept
// open beside it, oldest first. A tap on another node keeps the active one
// open among the others and opens the new one; past the device's limit the
// oldest closes. The panels tile the bottom half of the screen, never
// overlapping.

export type PanelDevice = "phone" | "tablet" | "desktop";

// How many panels may be open at once, and how many fit in one row.
export const PANEL_LIMIT: Record<PanelDevice, number> = { phone: 2, tablet: 6, desktop: 8 };
export const PANEL_COLUMNS: Record<PanelDevice, number> = { phone: 1, tablet: 3, desktop: 4 };

// A desktop in the desktop layout (hooks/useDesktopLayout.ts), a phone below
// 640px wide, a tablet in between.
export function panelDevice(widerThanPhone: boolean, desktopLayout: boolean): PanelDevice {
  if (desktopLayout) return "desktop";
  return widerThanPhone ? "tablet" : "phone";
}

// Opening `nextId` while `activeId` is open: the active one joins the others
// (newest last) and the oldest are dropped so that, with the new active panel,
// no more than `limit` are open.
export function keepOpen(others: string[], activeId: string | null, nextId: string, limit: number): string[] {
  if (!activeId || activeId === nextId) return others.filter((id) => id !== nextId);
  const kept = [...others.filter((id) => id !== activeId && id !== nextId), activeId];
  const room = Math.max(0, limit - 1);
  return kept.slice(Math.max(0, kept.length - room));
}

// Closing one panel. Closing an "other" just drops it; closing the active one
// makes the most recent other active.
export function closeOne(
  others: string[],
  activeId: string | null,
  id: string,
): { others: string[]; active: string | null } {
  if (id !== activeId) return { others: others.filter((o) => o !== id), active: activeId };
  const next = others[others.length - 1] ?? null;
  return { others: others.slice(0, -1), active: next };
}

// Where the open panels sit: the order shown (oldest first, the active one
// where it was opened, i.e. last) and the grid that tiles them.
export function panelGrid(count: number, device: PanelDevice): { columns: number; rows: number } {
  if (count <= 0) return { columns: 0, rows: 0 };
  const columns = Math.min(count, PANEL_COLUMNS[device]);
  return { columns, rows: Math.ceil(count / columns) };
}

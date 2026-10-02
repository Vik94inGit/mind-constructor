import type { NodeGroup } from "./canvasLayout";

// Which zones (circles — see canvasLayout's computeNodeGroups) are "in view":
// the ones whose own reach comes within `reach` canvas units of the middle of
// the screen. When none do, the nearest one still counts, so panning across
// empty canvas never leaves the whole map muted. Everything else is drawn
// muted, so the zones being looked at read first. null when there's nothing
// to choose between (fewer than two zones).
export function focusedZoneIds(
  groups: NodeGroup[],
  center: { x: number; y: number },
  reach: number,
): Set<string> | null {
  if (groups.length < 2) return null;
  const out = new Set<string>();
  let nearest: string | null = null;
  let nearestGap = Infinity;
  for (const g of groups) {
    const gap = Math.hypot(g.cx - center.x, g.cy - center.y) - g.r;
    if (gap <= reach) out.add(g.rootId);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = g.rootId;
    }
  }
  if (out.size === 0 && nearest) out.add(nearest);
  return out;
}

export function sameIds(a: Set<string> | null, b: Set<string> | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

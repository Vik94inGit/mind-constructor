import { memo, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { useDismiss } from "../hooks/useDismiss";
import { CANVAS_H, CANVAS_W } from "../utils/canvasLayout";
import { areaOf, miniViews } from "../utils/mapAreas";
import { sentimentOf, ZONE_COLORS } from "../utils/nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

/** The strip's height in px, for what sits above the minimap to move up by. */
export const AREA_STRIP_H = 26;

// A tiny drawing of one area: a dot per node, coloured by side like the
// minimap's own dots.
function AreaThumb({ nodes, positions, w, h }: { nodes: NodeDoc[]; positions: Map<string, Pt>; w: number; h: number }) {
  const sx = w / CANVAS_W;
  const sy = h / CANVAS_H;
  const r = Math.max(0.7, w / 70);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
      <rect width={w} height={h} fill="var(--surface-2)" />
      {nodes.map((n) => {
        const p = positions.get(n.nodeId) ?? (n.x !== undefined && n.y !== undefined ? { x: n.x, y: n.y } : null);
        if (!p) return null;
        const s = sentimentOf(n.type);
        const fill = s === "positive" ? ZONE_COLORS.positive : s === "negative" ? ZONE_COLORS.negative : "var(--ink-soft)";
        return <circle key={n.nodeId} cx={p.x * sx} cy={p.y * sy} r={r} fill={fill} />;
      })}
    </svg>
  );
}

interface StripProps {
  nodes: NodeDoc[];
  positions: Map<string, Pt>;
  count: number;
  area: number;
  perArea: number[];
  onSwitch: (area: number) => void;
  /** Gives back the last area; undefined when it can't go (not empty, or not the owner). */
  onRemoveLast?: () => void;
}

// The mini-views over the minimap (docs/gestures/map-areas.md): "All", then
// one per area, six at most. A tap on an area shows it; "All" opens every
// area side by side to pick from.
export const AreaStrip = memo(function AreaStrip({ nodes, positions, count, area, perArea, onSwitch, onRemoveLast }: StripProps) {
  const { t } = useI18n();
  // Each area's nodes, sorted once for every thumbnail.
  const byArea = useMemo(() => {
    const out: NodeDoc[][] = Array.from({ length: count }, () => []);
    for (const n of nodes) if (!n.packedIntoNodeId) out[areaOf(n)]?.push(n);
    return out;
  }, [nodes, count]);
  const a = t.ui.mapAreas;
  const [allOpen, setAllOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useDismiss(ref, () => setAllOpen(false), { enabled: allOpen });
  const views = miniViews(count);
  if (views.length === 0) return null;

  const btn = "flex h-[20px] cursor-pointer items-center justify-center overflow-hidden rounded-[4px] border p-0";
  return (
    <div ref={ref} className="relative" data-testid="area-strip">
      <div role="group" aria-label={a.stripLabel} className="flex items-center gap-1 border-b border-line px-1" style={{ height: AREA_STRIP_H }}>
        {views.map((v) =>
          v === "all" ? (
            <button
              key="all"
              type="button"
              aria-expanded={allOpen}
              title={a.allTitle}
              className={`${btn} min-w-[30px] px-1 text-[0.68rem] font-semibold ${allOpen ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-surface-2"}`}
              onClick={() => setAllOpen((o) => !o)}
            >
              {a.all}
            </button>
          ) : (
            <button
              key={v}
              type="button"
              data-area={v}
              aria-pressed={v === area}
              aria-label={a.areaThoughts(v + 1, perArea[v] ?? 0)}
              title={a.areaThoughts(v + 1, perArea[v] ?? 0)}
              className={`${btn} relative w-[26px] ${v === area ? "border-accent ring-1 ring-accent" : "border-line hover:border-ink-soft"}`}
              onClick={() => {
                setAllOpen(false);
                onSwitch(v);
              }}
            >
              <AreaThumb nodes={byArea[v]} positions={positions} w={26} h={18} />
              <span className="pointer-events-none absolute right-0 bottom-0 rounded-tl-[4px] bg-surface/90 px-[3px] text-[0.6rem] font-bold leading-[1.1] text-ink">{v + 1}</span>
            </button>
          ),
        )}
      </div>
      {allOpen && (
        <div
          data-testid="area-all"
          data-area-all-open
          className="absolute bottom-[calc(100%+0.4rem)] right-0 z-[60] w-[226px] rounded-card border border-line bg-surface p-2 shadow-card"
        >
          <div className="mb-1 px-0.5 text-[0.72rem] font-semibold text-ink-soft">{a.allTitle}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                data-area-all={i}
                aria-pressed={i === area}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-md border bg-surface p-1 text-left ${i === area ? "border-accent ring-1 ring-accent" : "border-line hover:bg-surface-2"}`}
                onClick={() => {
                  setAllOpen(false);
                  onSwitch(i);
                }}
              >
                <span className="overflow-hidden rounded-[4px]">
                  <AreaThumb nodes={byArea[i]} positions={positions} w={96} h={64} />
                </span>
                <span className="text-[0.66rem] font-semibold text-ink">{a.areaThoughts(i + 1, perArea[i] ?? 0)}</span>
              </button>
            ))}
          </div>
          {onRemoveLast && (
            <button
              type="button"
              data-remove-area
              className="mt-1.5 w-full cursor-pointer rounded-md border border-line bg-surface px-2 py-[0.3rem] text-left text-[0.72rem] font-semibold text-ink hover:bg-surface-2"
              onClick={() => {
                setAllOpen(false);
                onRemoveLast();
              }}
            >
              − {a.removeLast}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// The minimap's own + (docs/gestures/map-areas.md): one more area, shown at once.
export function AreaAddButton({ onAdd, busy }: { onAdd: () => void; busy?: boolean }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      data-add-area
      disabled={busy}
      title={t.ui.mapAreas.add}
      aria-label={t.ui.mapAreas.add}
      className="absolute right-1 bottom-1 z-[1] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border border-line bg-surface/95 p-0 text-[0.95rem] font-bold leading-none text-accent-ink shadow-card hover:bg-surface-2 disabled:opacity-50"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onAdd}
    >
      +
    </button>
  );
}

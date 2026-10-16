import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { ZONE_PALETTE, ZONE_PATTERNS } from "../types";
import type { ZonePaletteColor, ZonePattern } from "../types";
import { ZONE_EDGE_DEFAULT, ZONE_PALETTE_HEX } from "../utils/zoneStyle";
import { ZonePatternDef } from "./ZonePattern";

interface Props {
  /** Keeps the swatches' pattern ids apart when two pickers are on screen. */
  idPrefix: string;
  pattern: ZonePattern | null;
  color: ZonePaletteColor | null;
  /** The colour the zone shows with no palette pick (its sentiment colour), for the swatches' previews. */
  autoColor: string;
  onPattern: (pattern: ZonePattern | null) => void;
  onColor: (color: ZonePaletteColor | null) => void;
  /** How bright the zone's outline is (Node.zoneEdge, 0..1) — null: the default. Left out: no slider. */
  edge?: number | null;
  onEdge?: (edge: number) => void;
}

/** A drag of the edge slider saves once it rests this long, not on every step. */
export const EDGE_SAVE_DELAY_MS = 300;

const swatch =
  "flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 p-0 text-[0.62rem] font-semibold text-ink-soft";

// A zone's own look (Node.zonePattern / zoneColor on its parent): a row of
// pattern swatches and a row of calm-palette colours, each with a "none" /
// "auto" swatch that goes back to the default. Used in the zone's ⋯ menu and
// the parent node's right-click Zones submenu.
export function ZoneStylePicker({ idPrefix, pattern, color, autoColor, onPattern, onColor, edge, onEdge }: Props) {
  const { t } = useI18n();
  const s = t.ui.zoneStyle;
  // The slider moves at once; the save waits for the drag to settle.
  const [edgeValue, setEdgeValue] = useState(edge ?? ZONE_EDGE_DEFAULT);
  useEffect(() => setEdgeValue(edge ?? ZONE_EDGE_DEFAULT), [edge]);
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (edgeTimer.current) clearTimeout(edgeTimer.current);
  }, []);
  const shown = color ? ZONE_PALETTE_HEX[color] : autoColor;
  const ring = (active: boolean) => (active ? "border-accent" : "border-line");
  return (
    <div className="flex flex-col gap-2 px-[0.6rem] py-[0.3rem]">
      <div className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-semibold tracking-wide text-ink-soft uppercase">{s.pattern}</span>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={s.pattern}>
          <button type="button" role="radio" aria-checked={!pattern} title={s.none} aria-label={s.none} className={`${swatch} ${ring(!pattern)}`} onClick={() => onPattern(null)}>
            ∅
          </button>
          {ZONE_PATTERNS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pattern === p}
              title={s.patterns[p]}
              aria-label={s.patterns[p]}
              className={`${swatch} ${ring(pattern === p)}`}
              onClick={() => onPattern(p)}
            >
              <svg width="100%" height="100%" aria-hidden>
                <defs>
                  <ZonePatternDef id={`${idPrefix}-${p}`} pattern={p} color={shown} scale={0.6} strength={2.2} />
                </defs>
                <rect width="100%" height="100%" style={{ fill: shown, fillOpacity: 0.14 }} />
                <rect width="100%" height="100%" fill={`url(#${idPrefix}-${p})`} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-semibold tracking-wide text-ink-soft uppercase">{s.color}</span>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={s.color}>
          <button
            type="button"
            role="radio"
            aria-checked={!color}
            title={s.autoHint}
            aria-label={s.autoHint}
            className={`${swatch} ${ring(!color)}`}
            style={{ background: `color-mix(in srgb, ${autoColor} 25%, transparent)` }}
            onClick={() => onColor(null)}
          >
            {s.auto}
          </button>
          {ZONE_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              title={s.colors[c]}
              aria-label={s.colors[c]}
              className={`${swatch} ${ring(color === c)}`}
              style={{ background: ZONE_PALETTE_HEX[c] }}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
      </div>
      {onEdge && (
        <label className="flex flex-col gap-1">
          <span className="flex items-center text-[0.7rem] font-semibold tracking-wide text-ink-soft uppercase">
            <span className="flex-1">{s.edge}</span>
            <span className="tabular-nums normal-case">{Math.round(edgeValue * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(edgeValue * 100)}
            aria-label={s.edge}
            className="w-full cursor-pointer accent-[var(--accent)]"
            onChange={(e) => {
              const next = Number(e.target.value) / 100;
              setEdgeValue(next);
              if (edgeTimer.current) clearTimeout(edgeTimer.current);
              edgeTimer.current = setTimeout(() => onEdge(next), EDGE_SAVE_DELAY_MS);
            }}
          />
        </label>
      )}
    </div>
  );
}

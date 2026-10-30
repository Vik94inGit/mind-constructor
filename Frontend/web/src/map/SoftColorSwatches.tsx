import { useI18n } from "../i18n/I18nContext";
import { ZONE_PALETTE } from "../types";
import type { ZonePaletteColor } from "../types";
import { softTint, ZONE_PALETTE_HEX } from "../utils/zoneStyle";

interface Props {
  /** What the colours are for, read out to screen readers. */
  label: string;
  value: ZonePaletteColor | null;
  onPick: (color: ZonePaletteColor | null) => void;
}

const swatch = "h-7 w-7 shrink-0 cursor-pointer rounded-full border-2 p-0";

// A background colour to pick from the zones' calm palette, with "none"
// first. Each swatch shows the colour as a soft tint mixed into the paper
// (utils/zoneStyle.ts softTint) inside a ring of the full colour, so it reads
// as the muted background it becomes. Used for the map's background and a drawn picture's fill.
export function SoftColorSwatches({ label, value, onPick }: Props) {
  const { t } = useI18n();
  const s = t.ui.zoneStyle;
  const ring = (active: boolean) => (active ? "border-accent" : "border-line");
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        title={s.none}
        aria-label={s.none}
        className={`${swatch} ${ring(!value)} flex items-center justify-center bg-paper text-[0.62rem] font-semibold text-ink-soft`}
        onClick={() => onPick(null)}
      >
        ∅
      </button>
      {ZONE_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          title={s.colors[c]}
          aria-label={s.colors[c]}
          className={`${swatch} ${ring(value === c)}`}
          style={{ background: softTint(c, 30), boxShadow: `inset 0 0 0 2px ${ZONE_PALETTE_HEX[c]}` }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

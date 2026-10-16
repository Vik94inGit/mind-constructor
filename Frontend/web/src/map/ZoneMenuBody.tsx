import { useI18n } from "../i18n/I18nContext";
import { ZONE_MODES } from "../utils/zoneDisplay";
import type { ZoneMode } from "../utils/zoneDisplay";
import { ZONE_LAYOUTS, zoneLayoutLabel } from "../utils/zoneLayout";
import type { ZoneLayout } from "../utils/zoneLayout";
import type { ZonePaletteColor, ZonePattern } from "../types";
import { ZoneStylePicker } from "./ZoneStylePicker";

export type ZoneStylePatch = { zonePattern?: ZonePattern | null; zoneColor?: ZonePaletteColor | null; zoneEdge?: number | null };

// A glyph per view — also on a zone's name chip (ZoneNames), short enough to
// sit beside the name, distinct enough to tell the zones' views apart.
export const MODE_GLYPH: Record<ZoneMode, string> = {
  puzzle: "🧩",
  mixed: "◐",
  iconText: "Aa",
  actual: "○",
  dots: "•••",
};

interface Props {
  /** Keeps the style swatches' pattern ids apart when two menus are on screen. */
  idPrefix: string;
  /** How this viewer reads the zone (utils/zoneDisplay.ts) — null follows the map. */
  view?: { value: ZoneMode | null; onPick: (mode: ZoneMode | null) => void };
  /** How the parent's branch draws zones (utils/zoneLayout.ts) — null follows its parents / the map. */
  layout?: { value: ZoneLayout | null; onPick: (layout: ZoneLayout | null) => void };
  /** The zone's own look, saved on its parent — only for the parent's owner. */
  style?: {
    pattern: ZonePattern | null;
    color: ZonePaletteColor | null;
    edge: number | null;
    autoColor: string;
    onChange: (patch: ZoneStylePatch) => void;
  };
  /** A view or layout was picked — the menu around it usually closes. */
  onPicked?: () => void;
}

// Everything about one zone in one place — its view, its layout, and (for
// the parent's owner) its pattern, colour and edge brightness. The same body
// opens from right-clicking or holding the zone itself (ZoneMenu), from the
// zone's name chip (ZoneNames) and from its parent's right-click Zones
// submenu (NodeContextMenu).
export function ZoneMenuBody({ idPrefix, view, layout, style, onPicked }: Props) {
  const { t } = useI18n();
  const modeLabel: Record<ZoneMode, string> = {
    puzzle: t.map.toolbar.readingPuzzle,
    mixed: t.map.toolbar.readingMixed,
    iconText: t.map.toolbar.readingIconText,
    actual: t.map.toolbar.readingActual,
    dots: t.ui.display.dots,
  };
  const row = (active: boolean) =>
    `flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-[0.6rem] py-[0.4rem] text-left text-[0.82rem] hover:bg-surface-2 ${
      active ? "bg-surface-2 font-semibold text-accent" : "text-ink"
    }`;
  const heading = "px-[0.6rem] pt-[0.2rem] text-[0.7rem] font-semibold tracking-wide text-ink-soft uppercase";
  const divider = <div className="my-[0.15rem] border-t border-line" />;

  return (
    <>
      {view && (
        <>
          <div className={heading}>{t.ui.zoneStyle.view}</div>
          {[null, ...ZONE_MODES].map((m) => (
            <button
              key={m ?? "map"}
              type="button"
              role="menuitemradio"
              aria-checked={view.value === m}
              className={row(view.value === m)}
              onClick={() => {
                view.onPick(m);
                onPicked?.();
              }}
            >
              <span className="w-6 text-center text-[0.72rem]" aria-hidden>
                {m ? MODE_GLYPH[m] : "⋯"}
              </span>
              {m ? modeLabel[m] : t.ui.display.followMap}
            </button>
          ))}
        </>
      )}
      {layout && (
        <>
          {view && divider}
          <div className={heading}>{t.ui.contextMenu.zones}</div>
          {[null, ...ZONE_LAYOUTS].map((l) => (
            <button
              key={l ?? "follow"}
              type="button"
              role="menuitemradio"
              aria-checked={layout.value === l}
              className={row(layout.value === l)}
              onClick={() => {
                layout.onPick(l);
                onPicked?.();
              }}
            >
              {l ? zoneLayoutLabel(t.ui.display, l) : t.ui.display.followMap}
            </button>
          ))}
        </>
      )}
      {style && (
        <>
          {(view || layout) && divider}
          <ZoneStylePicker
            idPrefix={idPrefix}
            pattern={style.pattern}
            color={style.color}
            autoColor={style.autoColor}
            onPattern={(p) => style.onChange({ zonePattern: p })}
            onColor={(c) => style.onChange({ zoneColor: c })}
            edge={style.edge}
            onEdge={(e) => style.onChange({ zoneEdge: e })}
          />
        </>
      )}
    </>
  );
}

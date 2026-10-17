import { useI18n } from "../i18n/I18nContext";
import { ZONE_MODES } from "../utils/zoneDisplay";
import type { ZoneMode } from "../utils/zoneDisplay";
import { ZONE_LAYOUTS, zoneLayoutLabel } from "../utils/zoneLayout";
import type { ZoneLayout } from "../utils/zoneLayout";
import { NODE_SHAPES } from "../types";
import type { NodeShape, ZonePaletteColor, ZonePattern } from "../types";
import { ZoneStylePicker } from "./ZoneStylePicker";

export type ZoneStylePatch = { zonePattern?: ZonePattern | null; zoneColor?: ZonePaletteColor | null; zoneEdge?: number | null };

const SHAPE_GLYPH: Record<NodeShape, string> = { circle: "●", square: "■", triangle: "▲" };

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
    /** Palette colours other members' zones already wear, each with who has it — one person, one colour. */
    taken?: Partial<Record<ZonePaletteColor, string>>;
    onChange: (patch: ZoneStylePatch) => void;
  };
  /** What can be done with the zone's nodes as a whole. */
  actions?: {
    /** Copies every node's text in the zone, in map order. */
    onCopyText: () => void;
    /** One outline for every node of yours in the zone — undefined when they differ, null the usual circle. */
    shape?: { value: NodeShape | null | undefined; onPick: (shape: NodeShape | null) => void };
    /** Deletes the zone's nodes that are yours. */
    onDelete?: () => void;
    /** How many nodes onDelete would remove. */
    deleteCount?: number;
  };
  /** A view or layout was picked — the menu around it usually closes. */
  onPicked?: () => void;
}

// Everything about one zone in one place — copying its text, its nodes'
// shape and deleting them, its view, its layout, and (for the parent's
// owner) its pattern, colour and edge brightness. The same body
// opens from right-clicking or holding the zone itself (ZoneMenu), from the
// zone's name chip (ZoneNames) and from its parent's right-click Zones
// submenu (NodeContextMenu).
export function ZoneMenuBody({ idPrefix, view, layout, style, actions, onPicked }: Props) {
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
      {actions && (
        <>
          <button
            type="button"
            role="menuitem"
            className={row(false)}
            onClick={() => {
              actions.onCopyText();
              onPicked?.();
            }}
          >
            <span className="w-6 text-center text-[0.72rem]" aria-hidden>
              ⧉
            </span>
            {t.ui.selection.copyText}
          </button>
          {actions.shape && (
            <div className="flex items-center gap-[0.35rem] px-[0.6rem] py-[0.3rem] text-[0.82rem] text-ink">
              <span className="flex-1">{t.ui.node.shape}</span>
              {NODE_SHAPES.map((shape) => {
                const v = actions.shape!.value;
                const on = v !== undefined && (v ?? "circle") === shape;
                return (
                  <button
                    key={shape}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    aria-label={t.ui.node.shapes[shape]}
                    title={t.ui.node.shapes[shape]}
                    className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border text-[0.8rem] ${
                      on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface hover:bg-surface-2"
                    }`}
                    onClick={() => actions.shape!.onPick(shape === "circle" ? null : shape)}
                  >
                    {SHAPE_GLYPH[shape]}
                  </button>
                );
              })}
            </div>
          )}
          {actions.onDelete && (
            <button
              type="button"
              role="menuitem"
              className={row(false).replace("text-ink", "text-danger")}
              onClick={() => {
                actions.onDelete!();
                onPicked?.();
              }}
            >
              <span className="w-6 text-center text-[0.72rem]" aria-hidden>
                ✕
              </span>
              {t.ui.selection.deleteN(actions.deleteCount ?? 0)}
            </button>
          )}
          {(view || layout || style) && divider}
        </>
      )}
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
            taken={style.taken}
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

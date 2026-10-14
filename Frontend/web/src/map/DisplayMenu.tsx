import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";
import { ZONE_LAYOUTS, zoneLayoutLabel } from "../utils/zoneLayout";
import type { ZoneLayout } from "../utils/zoneLayout";
import { MAP_BACKGROUNDS } from "../types";
import type { MapBackground } from "../types";
import { mapBackgroundStyle } from "../utils/mapBackground";

interface Props {
  compact: boolean;
  onToggleCompact: () => void;
  /** "Emoji first": a node with an emoji shows it face up, its type on the back. */
  emojiFirst: boolean;
  onToggleEmojiFirst: () => void;
  /** How the whole map draws its zones (utils/zoneLayout.ts); a parent's own choice still wins for its branch. */
  zoneLayout?: ZoneLayout;
  onPickZoneLayout?: (layout: ZoneLayout) => void;
  /** The map's canvas (Map.background) — only passed to the map's owner, the one who may change it. */
  background?: MapBackground | null;
  onPickBackground?: (background: MapBackground) => void;
  /** Enters presentation mode — folded into this same dropdown rather than
   *  its own toolbar button (see MapToolbar's own comment). */
  onPresent: () => void;
  /** Starts the time-lapse — the map replayed node by node, oldest first. */
  onTimeLapse?: () => void;
  onClose: () => void;
  /** Where it opens from its button: below (top toolbar) or to the right (desktop side panel). */
  side?: "below" | "right";
}

// The toolbar's display (layers icon) dropdown — compact view, emoji first,
// how the map draws its zones, the map's background (owner only), and the
// entry point into presentation mode.
// How much detail the map shows (reading mode, level) lives in the
// bottom-right eye menu (ViewCorner) instead, so it isn't repeated here. Same
// open-downward, dismiss-on-outside-click/Escape pattern as AddMenu,
// positioned by a `relative` wrapper around its trigger.
export function DisplayMenu({
  compact,
  onToggleCompact,
  emojiFirst,
  onToggleEmojiFirst,
  zoneLayout,
  onPickZoneLayout,
  background,
  onPickBackground,
  onPresent,
  onTimeLapse,
  onClose,
  side = "below",
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute ${side === "right" ? "left-[calc(100%+0.5rem)] top-0" : "left-0 top-[calc(100%+0.4rem)]"} z-[60] flex min-w-[210px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={compact}
        title={t.ui.compact.hint}
        className={`flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] hover:bg-surface-2 ${
          compact ? "font-semibold text-accent-ink" : "text-ink"
        }`}
        onClick={onToggleCompact}
      >
        <span className="flex-1">{t.ui.compact.label}</span>
        {compact && <span aria-hidden>✓</span>}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={emojiFirst}
        title={t.ui.emoji.firstHint}
        className={`flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] hover:bg-surface-2 ${
          emojiFirst ? "font-semibold text-accent-ink" : "text-ink"
        }`}
        onClick={onToggleEmojiFirst}
      >
        <span className="flex-1">{t.ui.emoji.first}</span>
        {emojiFirst && <span aria-hidden>✓</span>}
      </button>
      {zoneLayout && onPickZoneLayout && (
        <>
          <div className="my-[0.15rem] border-t border-line" />
          <div className="px-[0.7rem] pt-[0.3rem] pb-[0.1rem] text-[0.72rem] font-semibold tracking-wide text-ink-soft uppercase">
            {t.ui.display.mapZones}
          </div>
          {ZONE_LAYOUTS.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={l === zoneLayout}
              className={`flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] hover:bg-surface-2 ${
                l === zoneLayout ? "font-semibold text-accent-ink" : "text-ink"
              }`}
              onClick={() => onPickZoneLayout(l)}
            >
              <span className="flex-1">{zoneLayoutLabel(t.ui.display, l)}</span>
              {l === zoneLayout && <span aria-hidden>✓</span>}
            </button>
          ))}
        </>
      )}
      {onPickBackground && (
        <>
          <div className="my-[0.15rem] border-t border-line" />
          <div className="px-[0.7rem] pt-[0.3rem] pb-[0.1rem] text-[0.72rem] font-semibold tracking-wide text-ink-soft uppercase">
            {t.ui.mapBackground.title}
          </div>
          {MAP_BACKGROUNDS.map((b) => {
            const active = (background ?? "dots") === b;
            const preview = mapBackgroundStyle(b);
            return (
              <button
                key={b}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.4rem] text-left text-[0.85rem] hover:bg-surface-2 ${
                  active ? "font-semibold text-accent-ink" : "text-ink"
                }`}
                onClick={() => onPickBackground(b)}
              >
                <span
                  aria-hidden
                  className={`h-5 w-7 shrink-0 rounded-[4px] border border-line ${preview.className}`}
                  style={{ ...preview.style, backgroundSize: b === "lined" ? "100% 6px" : b === "plain" ? undefined : "5px 5px" }}
                />
                <span className="flex-1">{t.ui.mapBackground.options[b]}</span>
                {active && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </>
      )}
      <div className="my-[0.15rem] border-t border-line" />
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] text-ink hover:bg-surface-2"
        onClick={onPresent}
      >
        <span aria-hidden>▶</span>
        <span className="flex-1">{t.map.toolbar.presentation}</span>
      </button>
      {onTimeLapse && (
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] text-ink hover:bg-surface-2"
          onClick={onTimeLapse}
        >
          <span aria-hidden>⏱</span>
          <span className="flex-1">{t.map.toolbar.timeLapse}</span>
        </button>
      )}
    </div>
  );
}

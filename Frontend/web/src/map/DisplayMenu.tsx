import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";
import { useKeepOnScreen } from "../hooks/useKeepOnScreen";
import { ZONE_LAYOUTS, zoneLayoutLabel } from "../utils/zoneLayout";
import type { ZoneLayout } from "../utils/zoneLayout";
import { MAP_BACKGROUNDS } from "../types";
import type { MapBackground, ZonePaletteColor } from "../types";
import { mapBackgroundStyle } from "../utils/mapBackground";
import { SoftColorSwatches } from "./SoftColorSwatches";
import { imageSrc } from "../utils/images";
import type { NodeType } from "../types";
import type { TypeEmoji } from "../utils/emojiFace";
import { TypeEmojiPicker } from "./TypeEmojiPicker";

interface Props {
  compact: boolean;
  onToggleCompact: () => void;
  /** "Emoji first": every node shows an emoji face up (its own, or its type's), its type on the back. Off: symbols first. */
  emojiFirst: boolean;
  /** How strongly quiet nodes fade, 0..100 (utils/nodeFade.ts); save is false while the slider still moves. */
  nodeFade?: number;
  onNodeFade?: (fade: number, save: boolean) => void;
  onToggleEmojiFirst: () => void;
  /** The viewer's own emoji per type (utils/emojiFace.ts), offered while emoji first is on. */
  typeEmoji?: TypeEmoji;
  onTypeEmoji?: (type: NodeType, emoji: string | null) => void;
  /** How the whole map draws its zones (utils/zoneLayout.ts); a parent's own choice still wins for its branch. */
  zoneLayout?: ZoneLayout;
  onPickZoneLayout?: (layout: ZoneLayout) => void;
  /** The map's canvas (Map.background) — only passed to the map's owner, the one who may change it. */
  background?: MapBackground | null;
  onPickBackground?: (background: MapBackground) => void;
  /** The soft tint over the background (Map.backgroundColor), picked with it. */
  backgroundColor?: ZonePaletteColor | null;
  onPickBackgroundColor?: (color: ZonePaletteColor | null) => void;
  /** The owner's own wallpaper (Map.backgroundImage) — a file to upload, or null to remove it. */
  backgroundImage?: string;
  onPickBackgroundImage?: (file: Blob | null) => void;
  /** Choose again which part of the picture already set is shown (map/PictureCropDialog.tsx). */
  onChoosePicturePart?: () => void;
  /** How much darker (below 0) or lighter (above 0) the wallpaper is (Map.backgroundShade); save is false while the slider still moves. */
  backgroundShade?: number;
  onPickBackgroundShade?: (shade: number, save: boolean) => void;
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
  nodeFade,
  onNodeFade,
  onToggleEmojiFirst,
  typeEmoji,
  onTypeEmoji,
  zoneLayout,
  onPickZoneLayout,
  background,
  onPickBackground,
  backgroundColor,
  onPickBackgroundColor,
  backgroundImage,
  onPickBackgroundImage,
  onChoosePicturePart,
  backgroundShade,
  onPickBackgroundShade,
  onPresent,
  onTimeLapse,
  onClose,
  side = "below",
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const onScreen = useKeepOnScreen(ref);

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
      style={onScreen}
      className={`absolute ${side === "right" ? "left-[calc(100%+0.5rem)] top-0" : "left-0 top-[calc(100%+0.4rem)]"} z-[60] flex max-h-[calc(100dvh-6rem)] min-w-[210px] flex-col gap-[0.15rem] overflow-y-auto rounded-card border border-line bg-surface p-[0.35rem] shadow-card`}
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
      {onNodeFade && nodeFade !== undefined && (
        // How much the nodes no one is looking at fade: none at the left, the
        // full fade at the right. Followed while sliding, saved on release.
        <div className="px-[0.7rem] py-[0.35rem] text-[0.85rem] text-ink">
          <div>{t.ui.nodeFade.label}</div>
          <label className="mt-[0.2rem] flex items-center gap-[0.4rem] text-[0.75rem] text-ink-soft">
            <span aria-hidden>{t.ui.nodeFade.off}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={nodeFade}
              aria-label={t.ui.nodeFade.label}
              className="min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
              onChange={(e) => onNodeFade(Number(e.target.value), false)}
              onPointerUp={(e) => onNodeFade(Number(e.currentTarget.value), true)}
              onKeyUp={(e) => onNodeFade(Number(e.currentTarget.value), true)}
            />
            <span aria-hidden>{t.ui.nodeFade.full}</span>
          </label>
        </div>
      )}
      {emojiFirst && typeEmoji && onTypeEmoji && (
        <>
          <div className="px-[0.7rem] pt-[0.2rem] text-[0.72rem] font-semibold tracking-wide text-ink-soft uppercase">
            {t.ui.emoji.typeEmoji}
          </div>
          <TypeEmojiPicker typeEmoji={typeEmoji} onChange={onTypeEmoji} />
        </>
      )}
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
            const preview = mapBackgroundStyle(b, backgroundColor);
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
          {onPickBackgroundColor && (
            <div className="px-[0.7rem] py-[0.4rem]">
              <SoftColorSwatches label={t.ui.zoneStyle.color} value={backgroundColor ?? null} onPick={onPickBackgroundColor} />
            </div>
          )}
          {onPickBackgroundImage && (
            <div className="flex items-center gap-1 px-[0.35rem] pb-[0.2rem]">
              <label className="flex flex-1 cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.35rem] py-[0.4rem] text-[0.85rem] text-ink hover:bg-surface-2">
                {backgroundImage ? (
                  <span
                    aria-hidden
                    className="h-5 w-7 shrink-0 rounded-[4px] border border-line bg-cover bg-center"
                    style={{ backgroundImage: `url("${imageSrc(backgroundImage)}")` }}
                  />
                ) : (
                  <span aria-hidden className="flex h-5 w-7 shrink-0 items-center justify-center rounded-[4px] border border-dashed border-line text-ink-soft">
                    +
                  </span>
                )}
                <span className="flex-1">{backgroundImage ? t.ui.mapBackground.changePicture : t.ui.mapBackground.picture}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={backgroundImage ? t.ui.mapBackground.changePicture : t.ui.mapBackground.picture}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onPickBackgroundImage(file);
                  }}
                />
              </label>
              {backgroundImage && (
                <button
                  type="button"
                  className="cursor-pointer rounded-[6px] px-[0.5rem] py-[0.4rem] text-[0.8rem] text-ink-soft hover:bg-surface-2"
                  title={t.ui.mapBackground.removePicture}
                  aria-label={t.ui.mapBackground.removePicture}
                  onClick={() => onPickBackgroundImage(null)}
                >
                  ✕
                </button>
              )}
            </div>
          )}
          {onChoosePicturePart && backgroundImage && (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.4rem] text-left text-[0.85rem] text-ink hover:bg-surface-2"
              onClick={onChoosePicturePart}
            >
              <span aria-hidden className="flex h-5 w-7 shrink-0 items-center justify-center text-ink-soft">
                ⛶
              </span>
              <span className="flex-1">{t.ui.mapBackground.choosePart}</span>
            </button>
          )}
          {onPickBackgroundShade && backgroundImage && (
            // Darker to the left, lighter to the right; the map follows the
            // slider, and the shade is saved once it's let go.
            <label className="flex items-center gap-[0.4rem] px-[0.7rem] pb-[0.4rem] text-[0.75rem] text-ink-soft">
              <span aria-hidden>{t.ui.mapBackground.darker}</span>
              <input
                type="range"
                min={-100}
                max={100}
                step={10}
                value={backgroundShade ?? 0}
                aria-label={t.ui.mapBackground.shade}
                className="min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
                onChange={(e) => onPickBackgroundShade(Number(e.target.value), false)}
                onPointerUp={(e) => onPickBackgroundShade(Number(e.currentTarget.value), true)}
                onKeyUp={(e) => onPickBackgroundShade(Number(e.currentTarget.value), true)}
              />
              <span aria-hidden>{t.ui.mapBackground.lighter}</span>
            </label>
          )}
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

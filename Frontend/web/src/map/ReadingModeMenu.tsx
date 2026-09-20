import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";
import { READING_MODES } from "../utils/readingMode";
import type { ReadingMode } from "../utils/readingMode";

interface Props {
  mode: ReadingMode;
  onPick: (mode: ReadingMode) => void;
  onClose: () => void;
}

// The toolbar's "Aa" dropdown — which way the map reads (see
// utils/readingMode.ts). Same open-downward, dismiss-on-outside-click/Escape
// pattern as AddMenu, positioned by a `relative` wrapper around its trigger.
export function ReadingModeMenu({ mode, onPick, onClose }: Props) {
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

  const label: Record<ReadingMode, string> = {
    classic: t.map.toolbar.readingClassic,
    iconText: t.map.toolbar.readingIconText,
    actual: t.map.toolbar.readingActual,
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-[calc(100%+0.4rem)] z-[60] flex min-w-[210px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
    >
      {READING_MODES.map((m, i) => (
        <button
          key={m}
          type="button"
          className={`flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] hover:bg-surface-2 ${
            m === mode ? "font-semibold text-accent-ink" : "text-ink"
          }`}
          onClick={() => onPick(m)}
        >
          <span className="w-[1ch] text-ink-soft">{i + 1}</span>
          <span className="flex-1">{label[m]}</span>
          {m === mode && <span aria-hidden>✓</span>}
        </button>
      ))}
    </div>
  );
}

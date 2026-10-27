import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { MapView } from "../utils/viewPrompt";
import { ViewSwitch } from "./ViewCorner";

interface Props {
  view: MapView;
  onChoose: (view: MapView) => void;
  /** Closed without choosing (× or after a while): the view stays as it is. */
  onClose: () => void;
}

/** How long the prompt waits before it leaves on its own. */
export const VIEW_PROMPT_MS = 15000;

// Shown once a map has built itself up (MapPage): look at the whole map, an
// overview with each parent packed, or the cards. A small card over the
// bottom of the canvas, asked only once (utils/viewPrompt.ts); it goes on its
// own after a while.
export function ViewPrompt({ view, onChoose, onClose }: Props) {
  const { t } = useI18n();
  const a = t.ui.autoPack;
  useEffect(() => {
    const timer = setTimeout(onClose, VIEW_PROMPT_MS);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-label={a.promptTitle}
      data-testid="view-prompt"
      className="absolute bottom-16 left-1/2 z-[46] flex w-[min(340px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[0.85rem] font-semibold text-ink">{a.promptTitle}</div>
        <button
          type="button"
          aria-label={a.promptClose}
          title={a.promptClose}
          className="-mt-1 -mr-1 cursor-pointer rounded-md border-0 bg-transparent px-1 text-[1rem] leading-none text-ink-soft hover:bg-surface-2"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <ViewSwitch view={view} onChange={onChoose} />
    </div>
  );
}

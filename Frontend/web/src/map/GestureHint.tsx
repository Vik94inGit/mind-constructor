import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";

const SEEN_KEY = "mc_gesture_hint_seen";

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Holding, right-clicking and dragging out of rings aren't visible on the
// map until someone tells you. The first map a browser opens shows the main
// gestures once — touch or mouse ones, by the screen's pointer — until
// "Got it". Remembered per browser.
export function GestureHint() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;
  const s = t.ui.gestureHint;
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked: it shows again next time, nothing worse
    }
  }

  return (
    <div
      role="dialog"
      aria-label={s.title}
      className="absolute bottom-16 left-1/2 z-[46] w-[min(92vw,360px)] -translate-x-1/2 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <div className="mb-2 text-[0.9rem] font-bold text-ink">{s.title}</div>
      <ul className="mb-3 flex list-disc flex-col gap-1 pl-5 text-[0.82rem] text-ink">
        {(touch ? s.touch : s.mouse).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          className="cursor-pointer rounded-lg border-0 bg-accent px-4 py-[0.4rem] text-[0.82rem] font-semibold text-white hover:opacity-90"
          onClick={dismiss}
        >
          {s.gotIt}
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { CheckInForm, EMPTY_CHECK_IN } from "../components/CheckInForm";
import type { CheckInValue } from "../components/CheckInForm";
import { FEELING_EMOJI, checkInEntry, checkInShift, loadAfterSkipped, saveAfterSkipped, shouldAskAfter } from "../utils/feeling";
import type { CheckIn } from "../utils/feeling";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-[0.35rem] text-[0.8rem] font-semibold transition-[background-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50";

// "And now?" — the after of the check-in the viewer started in Think it
// through (utils/feeling.ts). Asked once the map is finished, or the next time
// it's opened; "Not now" stops asking on this device (the dashboard's map menu
// still offers it). Saving shows the shift, e.g. "😟 4 → 😌 2".
export function CheckInPrompt({
  mapId,
  checkIn,
  finished = false,
  onSave,
}: {
  mapId: string;
  /** undefined while the viewer's view of the map is still loading. */
  checkIn: CheckIn | null | undefined;
  finished?: boolean;
  onSave: (checkIn: CheckIn) => void;
}) {
  const { t } = useI18n();
  const tf = t.ui.feelings;
  // Decided once, when the check-in arrives, so it doesn't pop up mid-session on a clock tick.
  const [openedAt] = useState(() => Date.now());
  const [skipped, setSkipped] = useState(() => loadAfterSkipped(mapId));
  const [value, setValue] = useState<CheckInValue>(EMPTY_CHECK_IN);
  const [saved, setSaved] = useState<CheckIn | null>(null);

  if (saved) {
    return (
      <div
        className="mx-4 mt-[0.6rem] flex items-center justify-between gap-3 rounded-lg bg-success-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-success"
        role="status"
      >
        <span>
          {tf.shift(checkInShift(saved) ?? "")} {tf.calmer}
        </span>
        <button className={`${btn} border-transparent bg-transparent text-ink`} onClick={() => setSaved(null)} aria-label={tf.close}>
          ✕
        </button>
      </div>
    );
  }

  const before = checkIn?.before;
  const ask = !!before && !checkIn?.after && !skipped && (finished || shouldAskAfter(checkIn, openedAt, false));
  if (!ask) return null;

  return (
    <div className="mx-4 mt-[0.6rem] rounded-lg border border-line bg-surface px-[0.9rem] py-[0.7rem] shadow-card" data-testid="check-in-prompt">
      <CheckInForm
        question={tf.after}
        hint={`${tf.beforeWas(`${FEELING_EMOJI[before.feeling]} ${before.strength}`)} · ${tf.afterHint}`}
        value={value}
        onChange={setValue}
        actions={
          <>
            <button
              type="button"
              className={`${btn} border-accent bg-accent text-white enabled:hover:opacity-90`}
              disabled={!value.feeling}
              onClick={() => {
                if (!value.feeling) return;
                const next = { before, after: checkInEntry(value.feeling, value.strength) };
                onSave(next);
                setSaved(next);
              }}
            >
              {tf.save}
            </button>
            <button
              type="button"
              className={`${btn} border-line bg-surface text-ink enabled:hover:bg-surface-2`}
              onClick={() => {
                saveAfterSkipped(mapId, true);
                setSkipped(true);
              }}
            >
              {tf.notNow}
            </button>
          </>
        }
      />
    </div>
  );
}

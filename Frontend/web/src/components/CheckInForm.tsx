import { useId } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext";
import { STRENGTH_DEFAULT, STRENGTH_MAX, STRENGTH_MIN } from "../utils/feeling";
import type { Feeling } from "../utils/feeling";
import { FeelingPicker } from "./FeelingPicker";

export interface CheckInValue {
  feeling: Feeling | null;
  strength: number;
}

export const EMPTY_CHECK_IN: CheckInValue = { feeling: null, strength: STRENGTH_DEFAULT };

// The before/after check-in (utils/feeling.ts): one feeling, then a 1–5
// slider for how strong. The slider only shows once a feeling is picked, so
// it stays one tap for anyone who only wants that.
export function CheckInForm({
  question,
  hint,
  value,
  onChange,
  actions,
}: {
  question: string;
  hint?: string;
  value: CheckInValue;
  onChange: (value: CheckInValue) => void;
  /** Buttons under the form (Save / Not now); none in the Think flow, where it saves with the draft. */
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const tf = t.ui.feelings;
  const id = useId();
  return (
    <fieldset className="m-0 border-0 p-0" data-testid="check-in">
      <legend className="mb-1 p-0 text-[0.9rem] font-semibold text-ink">{question}</legend>
      {hint && <p className="mt-0 mb-2 text-[0.78rem] text-ink-soft">{hint}</p>}
      <FeelingPicker value={value.feeling} onChange={(feeling) => onChange({ ...value, feeling })} label={question} />
      {value.feeling && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.78rem] text-ink-soft">
          <label htmlFor={id} className="font-semibold">
            {tf.strength}
          </label>
          <span>{tf.strengthLow}</span>
          <input
            id={id}
            type="range"
            min={STRENGTH_MIN}
            max={STRENGTH_MAX}
            step={1}
            value={value.strength}
            aria-valuetext={tf.strengthValue(value.strength)}
            onChange={(e) => onChange({ ...value, strength: Number(e.target.value) })}
            className="w-32 accent-[var(--accent)]"
          />
          <span>{tf.strengthHigh}</span>
          <span className="font-semibold text-ink tabular-nums">{value.strength}</span>
        </div>
      )}
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </fieldset>
  );
}

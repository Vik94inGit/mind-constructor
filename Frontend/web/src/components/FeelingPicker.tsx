import { useI18n } from "../i18n/I18nContext";
import { FEELINGS, FEELING_COLOR, FEELING_EMOJI } from "../utils/feeling";
import type { Feeling } from "../utils/feeling";

// One tap picks a feeling (utils/feeling.ts): a row of the eight emoji, the
// chosen one ringed in its own color. Tapping the chosen one again clears it
// when `clearable`; so does the "None" button, when `noneLabel` is given.
export function FeelingPicker({
  value,
  onChange,
  clearable = true,
  size = "md",
  noneLabel,
  label,
}: {
  value: Feeling | null | undefined;
  onChange: (feeling: Feeling | null) => void;
  clearable?: boolean;
  size?: "sm" | "md";
  noneLabel?: string;
  /** The group's accessible name. */
  label?: string;
}) {
  const { t } = useI18n();
  const names = t.ui.feelings.names;
  const box = size === "sm" ? "h-7 w-7 text-[1rem]" : "h-9 w-9 text-[1.25rem]";
  return (
    <div role="group" aria-label={label ?? t.ui.feelings.label} className="flex flex-wrap items-center gap-[0.3rem]">
      {FEELINGS.map((f) => {
        const selected = value === f;
        return (
          <button
            key={f}
            type="button"
            title={names[f]}
            aria-label={names[f]}
            aria-pressed={selected}
            onClick={() => onChange(selected && clearable ? null : f)}
            className={`flex ${box} cursor-pointer items-center justify-center rounded-full border-2 leading-none transition-[transform,background-color] duration-[120ms] hover:scale-110 ${
              selected ? "" : "border-transparent bg-surface-2"
            }`}
            style={selected ? { borderColor: FEELING_COLOR[f], background: `${FEELING_COLOR[f]}33` } : undefined}
          >
            <span aria-hidden="true">{FEELING_EMOJI[f]}</span>
          </button>
        );
      })}
      {noneLabel && (
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange(null)}
          className={`cursor-pointer rounded-md border border-line px-2 py-[0.1rem] text-[0.72rem] hover:bg-surface-2 ${
            value ? "text-ink" : "font-semibold text-accent"
          }`}
        >
          {noneLabel}
        </button>
      )}
    </div>
  );
}

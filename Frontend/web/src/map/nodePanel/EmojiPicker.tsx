import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { EMOJI_CHOICES, isValidEmoji } from "../../utils/emojiFace";

interface Props {
  value: string;
  busy: boolean;
  /** "" removes it. */
  onPick: (emoji: string) => void;
}

// NodePanel's emoji choice (owner only): the current one, quick picks, a
// field for any other emoji (the system emoji keyboard works there), and
// Remove. The node's icon then flips between it and the type's own symbol.
export function EmojiPicker({ value, busy, onPick }: Props) {
  const { t } = useI18n();
  const s = t.ui.emoji;
  const [custom, setCustom] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setInvalid(false), [value]);

  function submitCustom() {
    const v = custom.trim();
    if (!v) return;
    if (!isValidEmoji(v)) {
      setInvalid(true);
      return;
    }
    setCustom("");
    onPick(v);
  }

  return (
    <div className="mt-[0.6rem]">
      <div className="mb-[0.35rem] flex flex-wrap items-center gap-2">
        <span className="text-[0.78rem] text-ink-soft">{s.label}</span>
        <span className="text-[1.3rem] leading-none" aria-label={s.current}>
          {value || "—"}
        </span>
        {value && (
          <button
            type="button"
            className="cursor-pointer rounded-md border border-line bg-surface px-2 py-[0.1rem] text-[0.72rem] text-ink hover:bg-surface-2 disabled:opacity-50"
            disabled={busy}
            onClick={() => onPick("")}
          >
            {s.remove}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-[0.2rem]">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={value === e}
            disabled={busy}
            className={`h-[2rem] w-[2rem] cursor-pointer rounded-md border p-0 text-[1.15rem] leading-none hover:bg-surface-2 disabled:opacity-50 ${
              value === e ? "border-accent bg-accent-soft" : "border-transparent bg-transparent"
            }`}
            onClick={() => onPick(value === e ? "" : e)}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-[0.35rem] flex items-center gap-2">
        <input
          type="text"
          maxLength={32}
          value={custom}
          disabled={busy}
          placeholder={s.customPlaceholder}
          onChange={(e) => {
            setCustom(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitCustom();
            }
          }}
          className="w-[9rem] rounded-lg border border-line bg-surface px-[0.6rem] py-[0.25rem] text-[0.85rem] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
        />
        <button
          type="button"
          className="cursor-pointer rounded-md border border-line bg-surface px-2 py-[0.2rem] text-[0.75rem] font-semibold text-ink hover:bg-surface-2 disabled:opacity-50"
          disabled={busy || !custom.trim()}
          onClick={submitCustom}
        >
          {s.use}
        </button>
        {invalid && <span className="text-[0.75rem] text-danger">{s.invalid}</span>}
      </div>
    </div>
  );
}

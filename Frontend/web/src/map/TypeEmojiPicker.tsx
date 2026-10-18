import { useState } from "react";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { DEFAULT_TYPE_EMOJI, EMOJI_CHOICES, isValidEmoji, typeEmojiFor } from "../utils/emojiFace";
import type { TypeEmoji } from "../utils/emojiFace";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { TypeFace } from "./TypeFace";

interface Props {
  typeEmoji: TypeEmoji;
  /** null goes back to the type's symbol, the default. */
  onChange: (type: NodeType, emoji: string | null) => void;
}

// The eye menu's "Emoji for each type": every node type with the face its
// nodes wear in emoji first (utils/emojiFace.ts) — its own symbol unless the
// viewer picked an emoji. Tapping one opens the quick picks under it — the
// type's own symbol first, then emoji, its usual one first — plus a field for
// any other emoji.
export function TypeEmojiPicker({ typeEmoji, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState<NodeType | null>(null);
  const [custom, setCustom] = useState("");
  const valid = custom.trim() !== "" && isValidEmoji(custom);
  return (
    <div className="flex flex-col gap-[0.2rem] px-[0.7rem] pb-[0.3rem]" data-testid="type-emoji-picker">
      <div className="text-[0.72rem] text-ink-soft">{t.ui.emoji.typeEmojiHint}</div>
      <div className="flex flex-wrap gap-[0.3rem]">
        {NODE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-label={`${t.ui.types[type]}: ${typeEmojiFor(type, typeEmoji) ?? t.ui.emoji.typeSymbol}`}
            aria-expanded={open === type}
            title={t.ui.types[type]}
            className={`flex cursor-pointer items-center gap-[0.2rem] rounded-md border px-[0.35rem] py-[0.15rem] hover:bg-surface-2 ${
              open === type ? "border-accent" : "border-line"
            }`}
            onClick={() => {
              setOpen((cur) => (cur === type ? null : type));
              setCustom("");
            }}
          >
            <NodeTypeSymbol type={type} size={13} />
            <TypeFace type={type} size={16} emojiFirst typeEmoji={typeEmoji} />
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-[0.2rem] flex flex-col gap-[0.3rem] rounded-md border border-line p-[0.35rem]">
          <div className="grid grid-cols-8 gap-[0.15rem]">
            <button
              type="button"
              aria-label={t.ui.emoji.typeSymbol}
              title={t.ui.emoji.typeSymbol}
              aria-pressed={typeEmojiFor(open, typeEmoji) === null}
              className="flex cursor-pointer items-center justify-center rounded-[4px] p-[0.1rem] hover:bg-surface-2"
              onClick={() => {
                onChange(open, null);
                setOpen(null);
              }}
            >
              <NodeTypeSymbol type={open} size={17} />
            </button>
            {[DEFAULT_TYPE_EMOJI[open], ...EMOJI_CHOICES.filter((c) => c !== DEFAULT_TYPE_EMOJI[open])].map((e) => (
              <button
                key={e}
                type="button"
                aria-label={e}
                aria-pressed={typeEmojiFor(open, typeEmoji) === e}
                className="cursor-pointer rounded-[4px] p-[0.1rem] text-[1.05rem] leading-none hover:bg-surface-2"
                onClick={() => {
                  onChange(open, e);
                  setOpen(null);
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-[0.3rem]">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={t.ui.emoji.customPlaceholder}
              maxLength={32}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-[0.4rem] py-[0.15rem] text-[0.8rem] text-ink"
            />
            <button
              type="button"
              disabled={!valid}
              className="cursor-pointer rounded-md border border-line px-2 py-[0.1rem] text-[0.75rem] text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                onChange(open, custom.trim());
                setOpen(null);
              }}
            >
              {t.ui.emoji.use}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

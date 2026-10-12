import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { overlapsPiece, spanBetween, textSegments, wordRanges } from "../utils/textSplit";
import type { TextPiece } from "../utils/textSplit";

// The pieces of "Text → map" shared by its own page (pages/SplitTextPage.tsx)
// and the in-map version (map/TextToNodesModal.tsx): marking a piece by
// tapping the word it starts on and the word it ends on, the text shown as a
// run of chat bubbles (each marked piece split off as its own), and the type
// buttons.

type Range = { start: number; end: number };

/**
 * Marking a piece with two taps: the first word tapped is where it starts,
 * the second where it ends (either order, the same word twice for a one-word
 * piece). `selection` is the finished range, kept until it's given a type or
 * cleared; `notice` says when it would overlap a piece already marked.
 */
export function useTapMarking(pieces: TextPiece[]) {
  const { t } = useI18n();
  const [start, setStart] = useState<Range | null>(null);
  const [selection, setSelection] = useState<Range | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function tapWord(word: Range) {
    // A tap after a finished range starts the next one over.
    if (!start || selection) {
      setStart(word);
      setSelection(null);
      setNotice(null);
      return;
    }
    const range = spanBetween(start, word);
    setSelection(range);
    setNotice(overlapsPiece(pieces, range.start, range.end) ? t.split.overlap : null);
  }

  function clearSelection() {
    setStart(null);
    setSelection(null);
    setNotice(null);
  }

  return { start, selection, notice, setNotice, tapWord, clearSelection };
}

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/**
 * The text as a column of chat bubbles: every marked piece is its own bubble
 * in its type's color (with its type and a remove button), and the text
 * between pieces sits in plain bubbles whose words are tapped to mark the
 * next piece.
 */
export function MessageText({
  text,
  pieces,
  start,
  selection,
  onTapWord,
  onChange,
  className = "",
}: {
  text: string;
  pieces: TextPiece[];
  start: Range | null;
  selection: Range | null;
  onTapWord: (word: Range) => void;
  onChange: (pieces: TextPiece[]) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const ts = t.split;
  // Where the pointer is while a start is set — previews the piece on desktop.
  const [hover, setHover] = useState<Range | null>(null);
  const words = wordRanges(text);
  const preview = selection ?? (start && hover ? spanBetween(start, hover) : start);

  const wordAt = (e: MouseEvent): Range | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-word]");
    if (!el) return null;
    return { start: Number(el.dataset.start), end: Number(el.dataset.end) };
  };

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      {textSegments(text, pieces).map((seg) => {
        if (seg.piece) {
          const p = seg.piece;
          const color = NODE_TYPE_COLORS[p.type];
          return (
            <div
              key={p.id}
              data-testid="piece-bubble"
              className="max-w-[92%] rounded-2xl rounded-bl-md border px-3 py-2"
              style={{ background: tint(color, 14), borderColor: tint(color, 55) }}
            >
              <div className="mb-1 flex items-center gap-[0.35rem]">
                <NodeTypeIcon type={p.type} size={15} />
                <select
                  className="min-w-0 rounded-md border-0 bg-transparent py-0 pr-1 text-[0.75rem] font-semibold text-ink-soft"
                  value={p.type}
                  aria-label={ts.rootType}
                  onChange={(e) => onChange(pieces.map((x) => (x.id === p.id ? { ...x, type: e.target.value as NodeType } : x)))}
                >
                  {NODE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t.ui.types[type]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ml-auto cursor-pointer rounded-md border-0 bg-transparent px-[0.35rem] text-[0.95rem] leading-none text-ink-soft hover:text-danger"
                  aria-label={ts.remove}
                  title={ts.remove}
                  onClick={() => onChange(pieces.filter((x) => x.id !== p.id))}
                >
                  ×
                </button>
              </div>
              <div className="text-[0.95rem] leading-[1.6] break-words whitespace-pre-wrap text-ink">{text.slice(p.start, p.end)}</div>
            </div>
          );
        }
        const inRun = words.filter((w) => w.start >= seg.start && w.end <= seg.end);
        if (inRun.length === 0) return null;
        // The run's words, and the spacing between them as it was written.
        const parts: ReactNode[] = [];
        inRun.forEach((w, i) => {
          if (i > 0) {
            const gap = { start: inRun[i - 1].end, end: w.start };
            const gapIn = !!preview && gap.start >= preview.start && gap.end <= preview.end;
            parts.push(
              <span key={`g${gap.start}`} className={gapIn ? "bg-accent-soft" : undefined}>
                {text.slice(gap.start, gap.end)}
              </span>,
            );
          }
          const isStart = !!start && w.start === start.start;
          const inPreview = !!preview && w.start >= preview.start && w.end <= preview.end;
          parts.push(
            <span
              key={w.start}
              data-word=""
              data-start={w.start}
              data-end={w.end}
              className={`cursor-pointer rounded-[4px] ${isStart ? "bg-accent text-white" : inPreview ? "bg-accent-soft text-accent-ink" : "hover:bg-surface-2"}`}
            >
              {text.slice(w.start, w.end)}
            </span>,
          );
        });
        return (
          <div
            key={seg.start}
            className="max-w-[92%] rounded-2xl rounded-bl-md border border-dashed border-line bg-surface px-3 py-2 text-[1rem] leading-[1.9] break-words whitespace-pre-wrap text-ink select-none"
            onClick={(e) => {
              const w = wordAt(e);
              if (w) onTapWord(w);
            }}
            onMouseOver={(e) => start && !selection && setHover(wordAt(e))}
            onMouseLeave={() => setHover(null)}
          >
            {parts}
          </div>
        );
      })}
    </div>
  );
}

/** One button per node type, its icon and name. */
export function TypePicker({ value, onPick }: { value?: NodeType; onPick: (type: NodeType) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-[0.35rem]">
      {NODE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={`inline-flex cursor-pointer items-center gap-[0.35rem] rounded-[20px] border px-[0.6rem] py-[0.3rem] text-[0.8rem] font-semibold ${
            value === type ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
          }`}
          aria-pressed={value === undefined ? undefined : value === type}
          onClick={() => onPick(type)}
        >
          <NodeTypeIcon type={type} size={15} />
          {t.ui.types[type]}
        </button>
      ))}
    </div>
  );
}

/**
 * The piece being marked: once only its start is tapped, a line asking for
 * its end; once both are, a preview of it and the type buttons. Either way a
 * button to drop it.
 */
export function SelectionPicker({
  text,
  start,
  selection,
  notice,
  onPick,
  onClear,
}: {
  text: string;
  start: Range | null;
  selection: Range | null;
  notice: string | null;
  onPick: (type: NodeType) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const ts = t.split;
  const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const clear = (
    <button
      type="button"
      className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-ink-soft hover:bg-surface-2"
      aria-label={ts.clearSelection}
      title={ts.clearSelection}
      onClick={onClear}
    >
      ×
    </button>
  );
  if (!selection) {
    return (
      <div className="flex items-center gap-2 text-[0.85rem]">
        <span className="min-w-0 flex-1">{ts.startAt(short(start ? text.slice(start.start, start.end) : "", 30))}</span>
        {clear}
      </div>
    );
  }
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-[0.82rem]">
        <span className="font-semibold text-ink-soft">{ts.selected}:</span>
        <span className="min-w-0 flex-1 truncate">“{short(text.slice(selection.start, selection.end), 60)}”</span>
        {clear}
      </div>
      {notice ? <p className="m-0 text-[0.82rem] text-danger">{notice}</p> : <TypePicker onPick={onPick} />}
    </>
  );
}

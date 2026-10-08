import { forwardRef, useEffect, useState } from "react";
import type { RefObject } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { overlapsPiece, textSegments, trimRange } from "../utils/textSplit";
import type { TextPiece } from "../utils/textSplit";

// The pieces of "Text → map" shared by its own page (pages/SplitTextPage.tsx)
// and the in-map version (map/TextToNodesModal.tsx): the text with its marked
// pieces, reading a selection out of it, the type buttons, and the list of
// pieces.

/**
 * The latest selection inside `textRef`'s text, as character offsets — kept
 * until it's turned into a piece or cleared (tapping a type button would
 * otherwise drop it on a phone). `notice` says when it overlaps a piece.
 */
export function useTextPieceSelection(
  textRef: RefObject<HTMLDivElement | null>,
  text: string,
  pieces: TextPiece[],
  enabled: boolean,
) {
  const { t } = useI18n();
  const overlapMsg = t.split.overlap;
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The marked-up text holds nothing but the text itself, so the length of
  // everything before a point is that point's offset.
  useEffect(() => {
    if (!enabled) return;
    function onSelectionChange() {
      const box = textRef.current;
      const sel = window.getSelection();
      if (!box || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (!box.contains(range.startContainer) || !box.contains(range.endContainer)) return;
      const offsetOf = (node: Node, offset: number) => {
        const r = document.createRange();
        r.selectNodeContents(box);
        r.setEnd(node, offset);
        return r.toString().length;
      };
      const trimmed = trimRange(text, offsetOf(range.startContainer, range.startOffset), offsetOf(range.endContainer, range.endOffset));
      if (!trimmed) return;
      setSelection(trimmed);
      setNotice(overlapsPiece(pieces, trimmed.start, trimmed.end) ? overlapMsg : null);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [enabled, text, pieces, overlapMsg, textRef]);

  function clearSelection() {
    setSelection(null);
    setNotice(null);
    window.getSelection()?.removeAllRanges();
  }

  return { selection, notice, setNotice, clearSelection };
}

/** The text, each marked piece highlighted in its type's color. */
export const MarkedText = forwardRef<HTMLDivElement, { text: string; pieces: TextPiece[]; className?: string }>(
  function MarkedText({ text, pieces, className = "" }, ref) {
    const { t } = useI18n();
    return (
      <div ref={ref} className={`text-[1rem] leading-[1.9] break-words whitespace-pre-wrap text-ink select-text ${className}`}>
        {textSegments(text, pieces).map((seg) => {
          const slice = text.slice(seg.start, seg.end);
          if (!seg.piece) return <span key={seg.start}>{slice}</span>;
          const color = NODE_TYPE_COLORS[seg.piece.type];
          return (
            <mark
              key={seg.start}
              title={t.ui.types[seg.piece.type]}
              className="rounded-[3px] px-[1px] text-ink"
              style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, boxShadow: `inset 0 -2px 0 ${color}` }}
            >
              {slice}
            </mark>
          );
        })}
      </div>
    );
  },
);

/** One button per node type, its icon and name. */
export function TypePicker({ value, onPick }: { value?: NodeType; onPick: (type: NodeType) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-[0.35rem]">
      {NODE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          // Keeps the text selection alive on desktop while the button is pressed.
          onMouseDown={(e) => e.preventDefault()}
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

/** What to call the selected piece: a preview of it, a clear button, and the type buttons. */
export function SelectionPicker({
  text,
  selection,
  notice,
  onPick,
  onClear,
}: {
  text: string;
  selection: { start: number; end: number };
  notice: string | null;
  onPick: (type: NodeType) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const ts = t.split;
  const slice = text.slice(selection.start, selection.end);
  const preview = slice.length > 60 ? `${slice.slice(0, 59)}…` : slice;
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-[0.82rem]">
        <span className="font-semibold text-ink-soft">{ts.selected}:</span>
        <span className="min-w-0 flex-1 truncate">“{preview}”</span>
        <button
          type="button"
          className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-ink-soft hover:bg-surface-2"
          aria-label={ts.clearSelection}
          title={ts.clearSelection}
          onClick={onClear}
        >
          ×
        </button>
      </div>
      {notice ? <p className="m-0 text-[0.82rem] text-danger">{notice}</p> : <TypePicker onPick={onPick} />}
    </>
  );
}

/** The marked pieces, in text order: each one's text, a type dropdown, and a remove button. */
export function PieceList({
  text,
  pieces,
  onChange,
}: {
  text: string;
  pieces: TextPiece[];
  onChange: (pieces: TextPiece[]) => void;
}) {
  const { t } = useI18n();
  const ts = t.split;
  if (pieces.length === 0) {
    return <p className="m-0 rounded-card border border-dashed border-line px-4 py-6 text-center text-[0.9rem] text-ink-soft">{ts.noPieces}</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {pieces.map((p) => (
        <li key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <NodeTypeIcon type={p.type} size={18} />
          <span className="min-w-0 flex-1 truncate text-[0.9rem]">{text.slice(p.start, p.end)}</span>
          <select
            className="max-w-[40%] rounded-md border border-line bg-surface px-1 py-[0.2rem] text-[0.8rem] text-ink"
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
            className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-[1rem] text-ink-soft hover:bg-surface-2 hover:text-danger"
            aria-label={ts.remove}
            title={ts.remove}
            onClick={() => onChange(pieces.filter((x) => x.id !== p.id))}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

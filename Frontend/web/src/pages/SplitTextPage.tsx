import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiRequestError } from "../api/client";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { buildMapFromDraft, newThoughtId, suggestMapName } from "../utils/thoughtFlow";
import {
  addPiece,
  clearSplitDraft,
  emptySplitDraft,
  loadSplitDraft,
  overlapsPiece,
  saveSplitDraft,
  splitToThoughtDraft,
  textSegments,
  trimRange,
} from "../utils/textSplit";
import type { SplitDraft } from "../utils/textSplit";
import { btnGhost, btnPrimary, inputCls } from "../think/thinkStyles";
import { StepHeader, StepNav } from "../think/StepChrome";

// "Text → map": the whole text becomes the map's main node; pieces of it,
// picked out with the cursor and given a type, become the nodes hanging from
// it (utils/textSplit.ts).
//   1. Write — paste the text, name the map, choose the main node's type.
//   2. Mark — select a piece, tap its type; repeat. Then create the map.
// The draft is kept in this browser until the map is made.
export function SplitTextPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const ts = t.split;
  const navigate = useNavigate();
  const userId = user?._id ?? "anon";
  const [draft, setDraft] = useState<SplitDraft>(() => loadSplitDraft(userId) ?? emptySplitDraft());
  // The latest selection inside the text, kept until it's turned into a piece
  // or cleared — tapping a type button would otherwise drop it on a phone.
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [building, setBuilding] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!building) saveSplitDraft(userId, draft);
  }, [draft, userId, building]);

  const update = (patch: Partial<SplitDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Reads the selection as character offsets into the text. The marked-up
  // text holds nothing but the text itself, so the length of everything
  // before a point is that point's offset.
  useEffect(() => {
    if (draft.step !== 1) return;
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
      const trimmed = trimRange(draft.text, offsetOf(range.startContainer, range.startOffset), offsetOf(range.endContainer, range.endOffset));
      if (!trimmed) return;
      setSelection(trimmed);
      setNotice(overlapsPiece(draft.pieces, trimmed.start, trimmed.end) ? ts.overlap : null);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [draft.step, draft.text, draft.pieces, ts.overlap]);

  function clearSelection() {
    setSelection(null);
    setNotice(null);
    window.getSelection()?.removeAllRanges();
  }

  function markAs(type: NodeType) {
    if (!selection) return;
    const next = addPiece(draft.pieces, { id: newThoughtId(), ...selection, type });
    if (!next) {
      setNotice(ts.overlap);
      return;
    }
    update({ pieces: next });
    clearSelection();
  }

  function startOver() {
    if (!confirm(ts.startOverConfirm)) return;
    clearSplitDraft(userId);
    setDraft(emptySplitDraft());
    clearSelection();
  }

  async function create() {
    setError(null);
    setBuilding({ done: 0, total: draft.pieces.length + 1 });
    try {
      const map = await buildMapFromDraft(
        splitToThoughtDraft(draft),
        {
          name: draft.name.trim() || suggestMapName(draft.text),
          personal: true,
          ownerColor: "#22c55e",
          color: "#e08a3e",
          rootType: draft.rootType,
          withKind: false,
        },
        (done, total) => setBuilding({ done, total }),
      );
      clearSplitDraft(userId);
      navigate(`/maps/${map.mapId}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${ts.error} (${err.message})` : ts.error);
      setBuilding(null);
    }
  }

  const typeLabel = (type: NodeType) => t.ui.types[type];
  const preview = (text: string) => (text.length > 60 ? `${text.slice(0, 59)}…` : text);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-6 pb-40 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-[0.85rem]">
        <Link to="/" className="font-semibold text-accent-ink">
          {t.map.toolbar.back}
        </Link>
        {(draft.text || draft.pieces.length > 0) && (
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-ink-soft hover:underline" onClick={startOver}>
            {ts.startOver}
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}

      {draft.step === 0 ? (
        <>
          <StepHeader title={ts.title} hint={ts.hint} />
          <label className="mb-1 block text-[0.8rem] font-semibold text-ink-soft" htmlFor="split-name">
            {ts.name}
          </label>
          <input
            id="split-name"
            className={`${inputCls} mb-4`}
            value={draft.name}
            placeholder={ts.namePlaceholder}
            onChange={(e) => update({ name: e.target.value })}
          />
          <div className="mb-1 text-[0.8rem] font-semibold text-ink-soft">{ts.rootType}</div>
          <TypePicker value={draft.rootType} onPick={(type) => update({ rootType: type })} label={typeLabel} />
          <label className="mt-4 mb-1 block text-[0.8rem] font-semibold text-ink-soft" htmlFor="split-text">
            {ts.text}
          </label>
          <textarea
            id="split-text"
            className={`${inputCls} min-h-[240px] resize-y leading-relaxed`}
            value={draft.text}
            placeholder={ts.textPlaceholder}
            // Pieces point into the text by position, so changing it drops them.
            onChange={(e) => update({ text: e.target.value, pieces: [] })}
          />
          <StepNav
            next={
              <button type="button" className={btnPrimary} disabled={!draft.text.trim()} onClick={() => update({ step: 1 })}>
                {ts.next}
              </button>
            }
          />
        </>
      ) : (
        <>
          <StepHeader title={ts.markTitle} hint={ts.markHint} />

          <section className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.8rem] font-semibold text-ink-soft">
              <NodeTypeIcon type={draft.rootType} size={16} />
              {ts.mainNode} · {typeLabel(draft.rootType)}
            </div>
            <div
              ref={textRef}
              className="text-[1rem] leading-[1.9] break-words whitespace-pre-wrap text-ink select-text"
            >
              {textSegments(draft.text, draft.pieces).map((seg) => {
                const text = draft.text.slice(seg.start, seg.end);
                if (!seg.piece) return <span key={seg.start}>{text}</span>;
                const color = NODE_TYPE_COLORS[seg.piece.type];
                return (
                  <mark
                    key={seg.start}
                    title={typeLabel(seg.piece.type)}
                    className="rounded-[3px] px-[1px] text-ink"
                    style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, boxShadow: `inset 0 -2px 0 ${color}` }}
                  >
                    {text}
                  </mark>
                );
              })}
            </div>
          </section>

          <h2 className="mt-6 mb-2 text-[1rem] font-bold">{ts.pieces(draft.pieces.length)}</h2>
          {draft.pieces.length === 0 ? (
            <p className="m-0 rounded-card border border-dashed border-line px-4 py-6 text-center text-[0.9rem] text-ink-soft">{ts.noPieces}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {draft.pieces.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <NodeTypeIcon type={p.type} size={18} />
                  <span className="min-w-0 flex-1 truncate text-[0.9rem]">{draft.text.slice(p.start, p.end)}</span>
                  <select
                    className="max-w-[40%] rounded-md border border-line bg-surface px-1 py-[0.2rem] text-[0.8rem] text-ink"
                    value={p.type}
                    aria-label={ts.rootType}
                    onChange={(e) =>
                      update({ pieces: draft.pieces.map((x) => (x.id === p.id ? { ...x, type: e.target.value as NodeType } : x)) })
                    }
                  >
                    {NODE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {typeLabel(type)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-[1rem] text-ink-soft hover:bg-surface-2 hover:text-danger"
                    aria-label={ts.remove}
                    title={ts.remove}
                    onClick={() => update({ pieces: draft.pieces.filter((x) => x.id !== p.id) })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <StepNav
            back={
              <button type="button" className={btnGhost} disabled={!!building} onClick={() => update({ step: 0 })}>
                {ts.back}
              </button>
            }
            next={
              <button type="button" className={btnPrimary} disabled={!!building} onClick={create}>
                {building ? ts.creating(building.done, building.total) : ts.create}
              </button>
            }
          />

          {/* What to call the selected piece — pinned to the bottom so it's
              in reach on a phone, clear of the browser's own selection menu. */}
          {selection && (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-card">
              <div className="mx-auto max-w-[760px]">
                <div className="mb-2 flex items-center gap-2 text-[0.82rem]">
                  <span className="font-semibold text-ink-soft">{ts.selected}:</span>
                  <span className="min-w-0 flex-1 truncate">“{preview(draft.text.slice(selection.start, selection.end))}”</span>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-ink-soft hover:bg-surface-2"
                    aria-label={ts.clearSelection}
                    title={ts.clearSelection}
                    onClick={clearSelection}
                  >
                    ×
                  </button>
                </div>
                {notice ? (
                  <p className="m-0 text-[0.82rem] text-danger">{notice}</p>
                ) : (
                  <TypePicker onPick={markAs} label={typeLabel} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// One button per node type, its icon and name.
function TypePicker({ value, onPick, label }: { value?: NodeType; onPick: (type: NodeType) => void; label: (type: NodeType) => string }) {
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
          {label(type)}
        </button>
      ))}
    </div>
  );
}

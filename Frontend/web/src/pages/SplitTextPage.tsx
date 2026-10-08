import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiRequestError } from "../api/client";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import type { NodeType } from "../types";
import { buildMapFromDraft, newThoughtId, suggestMapName } from "../utils/thoughtFlow";
import {
  addPiece,
  clearSplitDraft,
  emptySplitDraft,
  loadSplitDraft,
  parseSplitDraft,
  saveSplitDraft,
  splitToThoughtDraft,
} from "../utils/textSplit";
import type { SplitDraft } from "../utils/textSplit";
import { btnGhost, btnPrimary, inputCls } from "../think/thinkStyles";
import { useDraftSync } from "../hooks/useDraftSync";
import { StepHeader, StepNav } from "../think/StepChrome";
import { MarkedText, PieceList, SelectionPicker, TypePicker, useTextPieceSelection } from "../think/TextMarking";

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
  const [building, setBuilding] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!building) saveSplitDraft(userId, draft);
  }, [draft, userId, building]);
  // The same draft on the server, to finish on another device.
  const { discard: discardServerDraft } = useDraftSync({
    kind: "textSplit",
    userId,
    enabled: !!user && !user.isDemo,
    draft,
    isEmpty: (d) => !d.text.trim() && d.pieces.length === 0,
    parse: parseSplitDraft,
    apply: setDraft,
  });

  const update = (patch: Partial<SplitDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const { selection, notice, setNotice, clearSelection } = useTextPieceSelection(textRef, draft.text, draft.pieces, draft.step === 1);

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
    discardServerDraft();
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
      discardServerDraft();
      navigate(`/maps/${map.mapId}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${ts.error} (${err.message})` : ts.error);
      setBuilding(null);
    }
  }

  const typeLabel = (type: NodeType) => t.ui.types[type];

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
          <TypePicker value={draft.rootType} onPick={(type) => update({ rootType: type })} />
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
            <MarkedText ref={textRef} text={draft.text} pieces={draft.pieces} />
          </section>

          <h2 className="mt-6 mb-2 text-[1rem] font-bold">{ts.pieces(draft.pieces.length)}</h2>
          <PieceList text={draft.text} pieces={draft.pieces} onChange={(pieces) => update({ pieces })} />

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
                <SelectionPicker
                  text={draft.text}
                  selection={selection}
                  notice={notice}
                  onPick={markAs}
                  onClear={clearSelection}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { ApiRequestError } from "../api/client";
import { NodeTypeIcon } from "./NodeTypeIcon";
import type { NodeType } from "../types";
import type { TextNodesPlan } from "../hooks/useNodeCreation";
import { addPiece, autoPieces } from "../utils/textSplit";
import type { TextPiece } from "../utils/textSplit";
import { newThoughtId } from "../utils/thoughtFlow";
import { btnGhost, btnPrimary, inputCls } from "../think/thinkStyles";
import { MarkedText, PieceList, SelectionPicker, TypePicker, useTextPieceSelection } from "../think/TextMarking";

type Pt = { x: number; y: number };

interface Props {
  /** Up to `count` free spots around where the user right-clicked — fewer when the map has no room for that many (see utils/freeSpots.ts). */
  findSpots: (count: number) => Pt[];
  onCreate: (plan: TextNodesPlan, onProgress: (done: number, total: number) => void) => Promise<void>;
  onClose: () => void;
}

// "Text → nodes", right on the map (the canvas right-click menu): the same
// write-then-mark flow as the "Text → map" page (pages/SplitTextPage.tsx),
// but the nodes land on the current map, around the point that was clicked,
// instead of making a new map.
//   1. Write — the text, and whether it stays on as a main node.
//   2. Mark — select pieces and give each a type, or cut the text up by
//      lines/sentences in one go.
//   3. Only when the map has no room for every new node: say how many fit,
//      and let the user choose which pieces to pack into the main node.
export function TextToNodesModal({ findSpots, onCreate, onClose }: Props) {
  const { t } = useI18n();
  const s = t.ui.textNodes;
  const [step, setStep] = useState<"write" | "mark" | "pack">("write");
  const [text, setText] = useState("");
  const [withRoot, setWithRoot] = useState(true);
  const [rootType, setRootType] = useState<NodeType>("Problem");
  const [pieces, setPieces] = useState<TextPiece[]>([]);
  // Step 3: the spots the map has room for, and the pieces chosen to pack.
  const [spots, setSpots] = useState<Pt[]>([]);
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const { selection, notice, setNotice, clearSelection } = useTextPieceSelection(textRef, text, pieces, step === "mark");

  const needed = (root: boolean) => (root ? 1 : 0) + pieces.length;

  function markAs(type: NodeType) {
    if (!selection) return;
    const next = addPiece(pieces, { id: newThoughtId(), ...selection, type });
    if (!next) {
      setNotice(t.split.overlap);
      return;
    }
    setPieces(next);
    clearSelection();
  }

  async function submit(root: boolean, at: Pt[], pack: Set<string>) {
    setError(null);
    setProgress({ done: 0, total: needed(root) });
    try {
      await onCreate(
        {
          text: text.trim(),
          rootType,
          withRoot: root,
          pieces: pieces.map((p) => ({ id: p.id, text: text.slice(p.start, p.end), type: p.type })),
          packed: pack,
          spots: at,
        },
        (done, total) => setProgress({ done, total }),
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${s.failed} (${err.message})` : s.failed);
      setProgress(null);
    }
  }

  // Counts the room first: everything fits → straight to creating; nothing
  // fits → say so; some fits → step 3, with the last pieces pre-chosen to pack.
  function check(root: boolean) {
    setError(null);
    const want = needed(root);
    if (want === 0) {
      setError(s.nothing);
      return;
    }
    const found = findSpots(want);
    if (found.length >= want) {
      void submit(root, found, new Set());
      return;
    }
    if (found.length === 0) {
      setError(s.noRoom);
      return;
    }
    setSpots(found);
    const need = want - found.length;
    setPacked(new Set(pieces.slice(pieces.length - need).map((p) => p.id)));
    setStep("pack");
  }

  const fit = spots.length;
  const need = Math.max(0, needed(withRoot) - fit);
  const shownCount = needed(withRoot) - packed.size;
  const canPack = withRoot && packed.size >= need && shownCount <= fit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,12,18,0.45)] p-3"
      onMouseDown={(e) => e.target === e.currentTarget && !progress && onClose()}
    >
      <div
        role="dialog"
        aria-label={s.title}
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="m-0 text-[1.1rem] font-bold">{step === "pack" ? s.overflowTitle : s.title}</h2>
          <button
            type="button"
            className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-ink-soft hover:bg-surface-2"
            aria-label={t.ui.common.close}
            disabled={!!progress}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.6rem] text-[0.85rem] text-danger">{error}</div>}

          {step === "write" && (
            <>
              <p className="mt-0 mb-3 text-[0.88rem] text-ink-soft">{s.hint}</p>
              <textarea
                className={`${inputCls} min-h-[200px] resize-y leading-relaxed`}
                autoFocus
                value={text}
                placeholder={t.split.textPlaceholder}
                // Pieces point into the text by position, so changing it drops them.
                onChange={(e) => {
                  setText(e.target.value);
                  setPieces([]);
                }}
              />
              <label className="mt-3 mb-2 flex cursor-pointer items-center gap-2 text-[0.85rem]">
                <input type="checkbox" checked={withRoot} onChange={(e) => setWithRoot(e.target.checked)} />
                {s.withRoot}
              </label>
              {withRoot && <TypePicker value={rootType} onPick={setRootType} />}
            </>
          )}

          {step === "mark" && (
            <>
              <p className="mt-0 mb-3 text-[0.85rem] text-ink-soft">{s.markHint}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setPieces(autoPieces(text, pieces, "lines", "unknown", newThoughtId))}
                >
                  {s.splitLines}
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setPieces(autoPieces(text, pieces, "sentences", "unknown", newThoughtId))}
                >
                  {s.splitSentences}
                </button>
              </div>
              <section className="rounded-card border border-line bg-surface-2 p-3">
                {withRoot && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.78rem] font-semibold text-ink-soft">
                    <NodeTypeIcon type={rootType} size={15} />
                    {t.split.mainNode} · {t.ui.types[rootType]}
                  </div>
                )}
                <MarkedText ref={textRef} text={text} pieces={pieces} className="max-h-[30dvh] overflow-y-auto text-[0.95rem]" />
              </section>
              {selection && (
                <div className="mt-3 rounded-lg border border-accent bg-surface p-3">
                  <SelectionPicker text={text} selection={selection} notice={notice} onPick={markAs} onClear={clearSelection} />
                </div>
              )}
              <h3 className="mt-4 mb-2 text-[0.95rem] font-bold">{t.split.pieces(pieces.length)}</h3>
              <PieceList text={text} pieces={pieces} onChange={setPieces} />
            </>
          )}

          {step === "pack" && (
            <>
              <p className="mt-0 mb-2 text-[0.9rem] font-semibold">{s.overflow(fit, needed(withRoot))}</p>
              {withRoot ? (
                <>
                  <p className="mt-0 mb-3 text-[0.85rem] text-ink-soft">{s.packHint(need)}</p>
                  <p className="mt-0 mb-2 text-[0.8rem] font-semibold text-ink-soft">{s.picked(packed.size, need)}</p>
                  <ul className="m-0 flex list-none flex-col gap-[0.35rem] p-0">
                    {pieces.map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 hover:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={packed.has(p.id)}
                            onChange={(e) =>
                              setPacked((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              })
                            }
                          />
                          <NodeTypeIcon type={p.type} size={16} />
                          <span className="min-w-0 flex-1 truncate text-[0.88rem]">{text.slice(p.start, p.end)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="m-0 text-[0.85rem] text-ink-soft">{s.packNeedsRoot}</p>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      setWithRoot(true);
                      check(true);
                    }}
                  >
                    {s.useRoot}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <div>
            {step !== "write" && (
              <button
                type="button"
                className={btnGhost}
                disabled={!!progress}
                onClick={() => {
                  setError(null);
                  setStep(step === "pack" ? "mark" : "write");
                }}
              >
                {s.back}
              </button>
            )}
          </div>
          <div>
            {step === "write" && (
              <button type="button" className={btnPrimary} disabled={!text.trim()} onClick={() => setStep("mark")}>
                {s.next}
              </button>
            )}
            {step === "mark" && (
              <button type="button" className={btnPrimary} disabled={!!progress} onClick={() => check(withRoot)}>
                {progress ? s.adding(progress.done, progress.total) : s.add(needed(withRoot))}
              </button>
            )}
            {step === "pack" && (
              <button
                type="button"
                className={btnPrimary}
                disabled={!!progress || !canPack}
                onClick={() => void submit(withRoot, spots, packed)}
              >
                {progress ? s.adding(progress.done, progress.total) : s.addAndPack(shownCount, packed.size)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

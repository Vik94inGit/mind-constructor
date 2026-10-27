import { useState } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { imageFilesFrom } from "../../utils/images";
import { MAX_NODE_TEXT } from "../../utils/nodeText";
import { isMobileViewport } from "../../utils/canvasLayout";
import type { NodeTemplateKind } from "../../utils/templates";
import { CARD_FILL_COLORS } from "../../utils/cardFill";
import { CARD_FONT_DEFAULT } from "../StickerCard";
import { CARD_FONT_MAX, CARD_FONT_MIN, CARD_SHAPES } from "../../types";
import type { CardShape } from "../../types";
import { useI18n } from "../../i18n/I18nContext";
import type { NodeDoc } from "../../types";

export type CardLookPatch = Pick<Partial<NodeDoc>, "cardW" | "cardH" | "cardFont" | "cardShape">;
/** A card's own look, for its owner to change (Node.cardFont/cardShape/cardW/cardH). */
export type CardLook = { font: number | null; shape: CardShape | null; sized: boolean; onChange: (patch: CardLookPatch) => void } | null;

interface Props {
  node: NodeDoc;
  isCreator: boolean;
  busy: boolean;
  /** Set while this node is drawn as a puzzle card — see NodePanel's own prop. */
  cardFill?: { value: string | undefined; onChange: (color: string | null) => void } | null;
  /** The card's own look, for its owner — see NodePanel's own prop. */
  cardLook?: CardLook;
  textLocked: boolean;
  onToggleLock?: () => void;
  /** Calls this parent's far nodes back in — see NodePanel's own prop. */
  onMagnet?: () => Promise<number>;
  /** Change parent: pick another node to hang this one from. */
  onChangeParent?: () => void;
  /** Auto-pack (utils/autoPack.ts): set on a parent — tucks its branch in, or opens it again when `autoPacked`. */
  onAutoPack?: () => void;
  autoPacked?: boolean;
  /** Swap with parent: this node takes its parent's place as head of the zone. */
  onSwapWithParent?: () => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  readonlyTextRef: RefObject<HTMLDivElement>;
  textDraft: string;
  setTextDraft: (text: string) => void;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  textHeight: number | null;
  copied: boolean;
  templateKind: NodeTemplateKind | null;
  /** Resolves true unless the save failed. */
  onTextSave: () => Promise<boolean>;
  onCopyText: () => void;
  onDelete: () => void;
  onTemplate: (kind: NodeTemplateKind) => void;
  onClose: () => void;
  /** The node's pictures (ImagesSection), shown under the text inside the same box, like a post. */
  imagesSection?: ReactNode;
  /** Pictures dropped anywhere on the post box. Unset when this viewer can't add any. */
  onDropImages?: (files: File[]) => void;
  /** Saves the text, then opens the previous (-1) or next (1) node — the arrow keys at either end of the text. */
  onStepNode?: (dir: -1 | 1) => void;
}

// NodePanel's Info tab: the node's title and full text (editable in place for
// its owner), the puzzle card's fill, lock, copy/delete, and — on a node with
// no branch yet — growing a template from it.
export function InfoTab({ node, isCreator, busy, cardFill, cardLook, textLocked, onToggleLock, onMagnet, onChangeParent, onSwapWithParent, onAutoPack, autoPacked = false, textareaRef, readonlyTextRef, textDraft, setTextDraft, expanded, setExpanded, textHeight, copied, templateKind, onTextSave, onCopyText, onDelete, onTemplate, onClose, imagesSection, onDropImages, onStepNode }: Props) {
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="mt-2">
      {/* The node's title, when it has one — read-only here for
          everyone; the owner edits it under Modify. */}
      {node.title && <div className="mb-2 text-[0.95rem] font-semibold text-ink">{node.title}</div>}
      {/* The text and its pictures share one box, like a post: write, then
          paste, drop or pick a picture right under the words. */}
      <div
        className={`overflow-hidden rounded-lg border focus-within:outline focus-within:-outline-offset-1 focus-within:outline-2 focus-within:outline-accent ${
          dragOver ? "border-accent bg-accent-soft" : `border-line ${isCreator && !textLocked ? "bg-surface" : "bg-surface-2"}`
        }`}
        onDragOver={(e) => {
          if (!onDropImages || !Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          if (!onDropImages) return;
          const files = imageFilesFrom(e.dataTransfer);
          if (files.length === 0) return;
          e.preventDefault();
          onDropImages(files);
        }}
      >
        {isCreator && !textLocked ? (
          <textarea
            id="node-text"
            ref={textareaRef}
            rows={6}
            maxLength={MAX_NODE_TEXT}
            value={textDraft}
            // A ghost's prompt (see NodeDoc.prompt) is the question to answer here.
            placeholder={node.prompt || undefined}
            onChange={(e) => setTextDraft(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              // Up/Left at the very start of the text, or Down/Right at the
              // very end, saves and moves on to the previous/next node (see
              // utils/nodeOrder.ts) — Alt+arrow does it from anywhere.
              if (onStepNode && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                const ta = e.currentTarget;
                const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
                const atEnd = ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
                const back = (e.key === "ArrowUp" || e.key === "ArrowLeft") && (atStart || e.altKey);
                const forward = (e.key === "ArrowDown" || e.key === "ArrowRight") && (atEnd || e.altKey);
                if (back || forward) {
                  e.preventDefault();
                  void onTextSave().then((ok) => ok && onStepNode(back ? -1 : 1));
                  return;
                }
              }
              // Mobile has no Shift key to reach alongside a virtual
              // keyboard's Enter/return, so plain Enter has to behave
              // like a normal textarea there too (insert a newline,
              // "another row," same as Shift+Enter below) — saving is
              // onBlur's job only (tapping the visible strip of canvas
              // outside the panel already does this). Desktop keeps its
              // existing plain-Enter-saves shortcut, Shift+Enter still
              // its own newline escape hatch.
              if (e.key === "Enter" && !e.shiftKey && !isMobileViewport()) {
                e.preventDefault();
                // Saves, then closes the panel — editing is done.
                void onTextSave().then((ok) => ok && onClose());
              }
              // Shift+Enter (desktop), or plain Enter on mobile: no
              // preventDefault — the textarea's own default behavior
              // (insert a newline) is exactly what's wanted here.
            }}
            onBlur={() => void onTextSave()}
            className={`block min-h-[8rem] w-full resize-y border-0 bg-transparent px-[0.7rem] py-[0.55rem] text-[0.88rem] leading-relaxed font-[inherit] text-ink focus:outline-none ${expanded || textHeight != null ? "max-h-none" : "max-h-[40vh]"}`}
          />
        ) : (
          <div
            ref={readonlyTextRef}
            className={`min-h-[8rem] w-full overflow-y-auto bg-transparent px-[0.7rem] py-[0.55rem] text-[0.88rem] leading-relaxed whitespace-pre-wrap text-ink ${expanded || textHeight != null ? "max-h-none" : "max-h-[40vh]"}`}
            style={!expanded && textHeight != null ? { height: textHeight } : undefined}
          >
            {node.text || (node.prompt ? <span className="text-ink-soft italic">{node.prompt}</span> : null)}
          </div>
        )}
        {imagesSection}
      </div>
      <div className="mt-2 flex items-center gap-[0.5rem]">
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? t.ui.node.collapseTitle : t.ui.node.expandTitle}
        >
          {expanded ? t.ui.node.collapse : t.ui.node.expand}
        </button>
        {isCreator && (
          <button
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => textareaRef.current?.focus()}
          >
            {t.ui.common.edit}
          </button>
        )}
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCopyText}
        >
          {copied ? t.ui.common.copied : t.ui.common.copy}
        </button>
        {isCreator && (
          <button
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-danger-bg bg-danger-bg px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onDelete}
            disabled={busy}
          >
            {t.ui.common.delete}
          </button>
        )}
      </div>
    <div className="mt-3">
      {(onChangeParent || onSwapWithParent || onAutoPack) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {onAutoPack && (
            <button
              type="button"
              data-auto-pack
              aria-pressed={autoPacked}
              className={`cursor-pointer rounded-md border px-2 py-[0.2rem] text-[0.75rem] font-semibold hover:bg-surface-2 ${
                autoPacked ? "border-accent text-accent-ink" : "border-line text-ink"
              }`}
              title={t.ui.autoPack.hint}
              onClick={onAutoPack}
            >
              {autoPacked ? `⊕ ${t.ui.autoPack.unpack}` : `⊖ ${t.ui.autoPack.pack}`}
            </button>
          )}
          {onChangeParent && (
            <button
              type="button"
              data-change-parent
              className="cursor-pointer rounded-md border border-line px-2 py-[0.2rem] text-[0.75rem] font-semibold text-ink hover:bg-surface-2"
              title={t.ui.canvas.changeParentHint}
              onClick={onChangeParent}
            >
              ↪ {t.ui.canvas.changeParent}
            </button>
          )}
          {onSwapWithParent && (
            <button
              type="button"
              data-swap-parent
              className="cursor-pointer rounded-md border border-line px-2 py-[0.2rem] text-[0.75rem] font-semibold text-ink hover:bg-surface-2"
              title={t.ui.canvas.swapWithParentHint}
              onClick={onSwapWithParent}
            >
              ⇅ {t.ui.canvas.swapWithParent}
            </button>
          )}
        </div>
      )}
      {onMagnet && <MagnetButton onMagnet={onMagnet} />}
      {isCreator && onToggleLock && (
        // Lock/unlock: a locked block can't be moved, clicked into
        // another piece or have its text edited.
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`cursor-pointer rounded-md border px-2 py-[0.2rem] text-[0.75rem] font-semibold hover:bg-surface-2 ${
              textLocked ? "border-accent bg-surface-2 text-accent" : "border-line text-ink"
            }`}
            aria-pressed={textLocked}
            onClick={onToggleLock}
          >
            {textLocked ? `🔓 ${t.ui.display.unlockBlock}` : `🔒 ${t.ui.display.lockBlock}`}
          </button>
          {textLocked && <span className="text-[0.75rem] text-ink-soft">{t.ui.display.blockLocked}</span>}
        </div>
      )}
      {cardFill && (
        // The puzzle card's own fill — the viewer's choice, not shared.
        <div className="mb-3 flex flex-wrap items-center gap-[0.4rem]">
          <span className="mr-1 text-[0.75rem] font-semibold text-ink-soft">{t.ui.display.cardColor}</span>
          {CARD_FILL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-[22px] w-[22px] cursor-pointer rounded-full border-2 border-line${
                cardFill.value === c ? " outline outline-2 outline-offset-2 outline-accent" : ""
              }`}
              style={{ background: c }}
              aria-label={c}
              aria-pressed={cardFill.value === c}
              onClick={() => cardFill.onChange(c)}
            />
          ))}
          <button
            type="button"
            className={`cursor-pointer rounded-md border border-line px-2 py-[0.1rem] text-[0.72rem] hover:bg-surface-2 ${
              cardFill.value ? "text-ink" : "font-semibold text-accent"
            }`}
            onClick={() => cardFill.onChange(null)}
          >
            {t.ui.display.cardColorReset}
          </button>
        </div>
      )}
      {cardLook && (
        // The card's own text size, outline and size — its owner's, shared
        // with every member like its spot on the board.
        <div className="mb-3 flex flex-wrap items-center gap-[0.4rem]" data-testid="card-look">
          <span className="mr-1 text-[0.75rem] font-semibold text-ink-soft">{t.ui.display.cardText}</span>
          {(["−", "+"] as const).map((sign) => {
            const font = cardLook.font ?? CARD_FONT_DEFAULT;
            const next = Math.min(CARD_FONT_MAX, Math.max(CARD_FONT_MIN, font + (sign === "+" ? 2 : -2)));
            return (
              <button
                key={sign}
                type="button"
                aria-label={`${t.ui.display.cardText} ${sign}`}
                className="h-[24px] min-w-[28px] cursor-pointer rounded-md border border-line px-2 text-[0.8rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={next === font}
                onClick={() => cardLook.onChange({ cardFont: next })}
              >
                {sign === "+" ? "A+" : "A−"}
              </button>
            );
          })}
          <span className="ml-2 mr-1 text-[0.75rem] font-semibold text-ink-soft">{t.ui.display.cardShape}</span>
          {CARD_SHAPES.map((shape) => {
            const active = (cardLook.shape ?? "rounded") === shape;
            const label =
              shape === "rounded" ? t.ui.display.cardShapeRounded : shape === "square" ? t.ui.display.cardShapeSquare : t.ui.display.cardShapeRound;
            return (
              <button
                key={shape}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={`flex h-[24px] w-[30px] cursor-pointer items-center justify-center rounded-md border hover:bg-surface-2 ${active ? "border-accent" : "border-line"}`}
                onClick={() => cardLook.onChange({ cardShape: shape === "rounded" ? null : shape })}
              >
                <span
                  aria-hidden
                  className="block h-[12px] w-[18px] border-[1.5px] border-ink-soft"
                  style={{ borderRadius: shape === "rounded" ? 4 : shape === "square" ? 0 : 9999 }}
                />
              </button>
            );
          })}
          {cardLook.sized && (
            <button
              type="button"
              className="ml-1 cursor-pointer rounded-md border border-line px-2 py-[0.1rem] text-[0.72rem] text-ink hover:bg-surface-2"
              onClick={() => cardLook.onChange({ cardW: null, cardH: null })}
            >
              {t.ui.display.cardFitText}
            </button>
          )}
        </div>
      )}
      {/* Just the text — extendable (a generous min-height so even a
          short claim doesn't look cramped) and scrollable (capped at
          max-h so a long one scrolls in place instead of pushing the
          rest of the sheet, and this whole panel, off-screen, unless
          expanded — see the Expand/Collapse button below, and its own
          doc comment on the `expanded` state above for why that's a
          real button now rather than just this box's native CSS
          resize handle). Owner gets the same editable textarea
          NodePanel has always used here (Enter/blur-to-save, mobile's
          own Enter-inserts-a-newline handling below, unchanged);
          anyone else gets a plain read-only, same-sized block —
          reading a node's full text shouldn't require owning it. */}
    </div>
    {templateKind && (
      <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
        <div className="text-[0.78rem] font-semibold text-ink-soft">
          {templateKind === "retry" ? t.ui.templates.retry.title : t.ui.templates.section}
        </div>
        <p className="mt-1 text-[0.78rem] text-ink-soft">{t.ui.templates[templateKind].hint}</p>
        <button
          type="button"
          className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-accent bg-accent-soft px-3 py-[0.4rem] text-[0.85rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => onTemplate(templateKind)}
        >
          {t.ui.templates[templateKind].button}
        </button>
      </div>
    )}
    </div>
  );
}

// The parent's magnet: one press pulls its own nodes that sit outside its zone
// back in, and says so when they were all close already.
function MagnetButton({ onMagnet }: { onMagnet: () => Promise<number> }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "busy" | "none">("idle");
  async function run() {
    setState("busy");
    try {
      setState((await onMagnet()) === 0 ? "none" : "idle");
    } catch {
      setState("idle");
    }
  }
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="cursor-pointer rounded-md border border-line px-2 py-[0.2rem] text-[0.75rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        title={t.ui.display.magnetHint}
        disabled={state === "busy"}
        onClick={run}
      >
        🧲 {t.ui.display.magnet}
      </button>
      {state === "none" && <span className="text-[0.75rem] text-ink-soft">{t.ui.display.magnetNone}</span>}
    </div>
  );
}

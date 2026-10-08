import { useState } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { imageFilesFrom } from "../../utils/images";
import { MAX_NODE_TEXT } from "../../utils/nodeText";
import { isMobileViewport } from "../../utils/canvasLayout";
import type { TemplateKind } from "../../utils/templates";
import { CARD_FILL_COLORS } from "../../utils/cardFill";
import { useI18n } from "../../i18n/I18nContext";
import type { NodeDoc } from "../../types";

interface Props {
  node: NodeDoc;
  isCreator: boolean;
  busy: boolean;
  /** Set while this node is drawn as a puzzle card — see NodePanel's own prop. */
  cardFill?: { value: string | undefined; onChange: (color: string | null) => void } | null;
  textLocked: boolean;
  onToggleLock?: () => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  readonlyTextRef: RefObject<HTMLDivElement>;
  textDraft: string;
  setTextDraft: (text: string) => void;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  textHeight: number | null;
  copied: boolean;
  templateKind: TemplateKind | null;
  /** Resolves true unless the save failed. */
  onTextSave: () => Promise<boolean>;
  onCopyText: () => void;
  onDelete: () => void;
  onTemplate: (kind: TemplateKind) => void;
  onClose: () => void;
  /** The node's pictures (ImagesSection), shown under the text inside the same box, like a post. */
  imagesSection?: ReactNode;
  /** Pictures dropped anywhere on the post box. Unset when this viewer can't add any. */
  onDropImages?: (files: File[]) => void;
}

// NodePanel's Info tab: the node's title and full text (editable in place for
// its owner), the puzzle card's fill, lock, copy/delete, and — on a node with
// no branch yet — growing a template from it.
export function InfoTab({ node, isCreator, busy, cardFill, textLocked, onToggleLock, textareaRef, readonlyTextRef, textDraft, setTextDraft, expanded, setExpanded, textHeight, copied, templateKind, onTextSave, onCopyText, onDelete, onTemplate, onClose, imagesSection, onDropImages }: Props) {
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="mt-4">
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
      {/* The node's title, when it has one — read-only here for
          everyone; the owner edits it under Modify. */}
      {node.title && <div className="mb-2 text-[0.95rem] font-semibold text-ink">{node.title}</div>}
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
            onChange={(e) => setTextDraft(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
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
            {node.text}
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
    {templateKind && (
      <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
        <div className="text-[0.78rem] font-semibold text-ink-soft">
          {templateKind === "retry" ? t.ui.templates.retry.title : t.ui.templates.section}
        </div>
        <p className="mt-1 text-[0.78rem] text-ink-soft">
          {templateKind === "problem"
            ? t.ui.templates.problem.hint
            : templateKind === "goal"
              ? t.ui.templates.goal.hint
              : t.ui.templates.retry.hint}
        </p>
        <button
          type="button"
          className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-accent bg-accent-soft px-3 py-[0.4rem] text-[0.85rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => onTemplate(templateKind)}
        >
          {templateKind === "problem"
            ? t.ui.templates.problem.button
            : templateKind === "goal"
              ? t.ui.templates.goal.button
              : t.ui.templates.retry.button}
        </button>
      </div>
    )}
    </div>
  );
}

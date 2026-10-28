import { useEffect, useRef, useState } from "react";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { isMobileViewport } from "../utils/canvasLayout";
import { MAX_NODE_IMAGES, imageFilesFrom, shrinkImage } from "../utils/images";
import { MAX_NODE_TEXT } from "../utils/nodeText";
import { TypePicker } from "./TypePicker";
import { ImagesSection } from "./nodePanel/ImagesSection";

interface Props {
  type: NodeType;
  emoji?: string;
  /** A starter phrase picked on the quick-add ring: the field's placeholder, and the node's prompt. */
  prompt?: string;
  onTypeChange: (type: NodeType) => void;
  onClearEmoji: () => void;
  /** Resolves once the node is made (or making it failed — the caller shows that). */
  /** Empty `text` with a `prompt` makes a ghost (see NodeDoc.ghost). */
  onCreate: (text: string, type: NodeType, images: string[], prompt?: string) => Promise<void>;
  onCancel: () => void;
}

// Where a new node is written before it exists: the same bottom sheet NodePanel
// uses, opened with its text field focused. Type, emoji and pictures can be
// set here too; nothing is sent until Create (or Enter). The emoji is
// optional — writing straight away makes the node without one.
//
// "Ghost" turns what's written into the node's prompt instead of its text:
// the node lands faded with that question as its placeholder, to be filled in
// later. A picked starter phrase is a prompt from the start, so Create with
// nothing written makes a ghost of it too.
export function NewNodePanel({ type, emoji, prompt = "", onTypeChange, onClearEmoji, onCreate, onCancel }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [asGhost, setAsGhost] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  async function addImages(files: File[]) {
    const room = MAX_NODE_IMAGES - images.length;
    if (room <= 0) return setError(t.ui.images.limit(MAX_NODE_IMAGES));
    setError(null);
    const added: string[] = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push(await shrinkImage(file));
      } catch {
        setError(t.ui.images.tooLarge);
      }
    }
    if (files.length > room) setError(t.ui.images.limit(MAX_NODE_IMAGES));
    if (added.length) setImages((prev) => [...prev, ...added]);
  }

  async function create() {
    const trimmed = text.trim();
    if (busy || (!trimmed && !prompt)) return;
    setBusy(true);
    try {
      if (asGhost) await onCreate("", type, images, trimmed || prompt);
      else await onCreate(trimmed, type, images, prompt || undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[46] flex h-[50dvh] w-full flex-col overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-5 pt-3 pb-4 shadow-[var(--shadow-card)]"
      data-testid="new-node-panel"
      onPaste={(e) => {
        const files = imageFilesFrom(e.clipboardData);
        if (files.length === 0) return;
        e.preventDefault();
        void addImages(files);
      }}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        const files = imageFilesFrom(e.dataTransfer);
        if (files.length === 0) return;
        e.preventDefault();
        void addImages(files);
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[0.8rem] font-semibold text-ink">{t.ui.newNode.title}</span>
        <TypePicker value={type} types={NODE_TYPES} onChange={onTypeChange} disabled={busy} />
        {emoji && (
          <span className="inline-flex items-center gap-[0.2rem] rounded-full border border-line bg-surface-2 py-[0.05rem] pr-[0.15rem] pl-[0.4rem]">
            <span aria-hidden className="text-[1.05rem] leading-none">
              {emoji}
            </span>
            <button
              type="button"
              className="cursor-pointer rounded-full border-0 bg-transparent px-[0.25rem] text-[0.8rem] leading-none text-ink-soft hover:text-danger"
              aria-label={t.ui.emoji.remove}
              title={t.ui.emoji.remove}
              onClick={onClearEmoji}
            >
              ×
            </button>
          </span>
        )}
        <button
          type="button"
          className="ml-auto cursor-pointer rounded-lg border-0 bg-transparent px-[0.5rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink hover:bg-surface-2"
          aria-label={t.ui.common.cancel}
          onClick={onCancel}
        >
          ✕
        </button>
      </div>
      {error && <div className="mb-2 rounded-lg bg-danger-bg px-3 py-2 text-[0.8rem] text-danger">{error}</div>}
      {/* Same post-like box as NodePanel's Info tab: the words, then pictures. */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface focus-within:outline focus-within:-outline-offset-1 focus-within:outline-2 focus-within:outline-accent">
        <textarea
          ref={fieldRef}
          rows={5}
          maxLength={MAX_NODE_TEXT}
          value={text}
          placeholder={asGhost ? t.ui.newNode.ghostPlaceholder : prompt || t.ui.newNode.placeholder}
          readOnly={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            } else if (e.key === "Enter" && !e.shiftKey && !isMobileViewport()) {
              e.preventDefault();
              void create();
            }
          }}
          className="block min-h-[7rem] w-full resize-y border-0 bg-transparent px-[0.7rem] py-[0.55rem] text-[0.88rem] leading-relaxed font-[inherit] text-ink focus:outline-none"
        />
        <ImagesSection
          images={images}
          canEdit
          busy={busy}
          onAdd={(files) => void addImages(files)}
          onRemove={(i) => setImages((prev) => prev.filter((_, j) => j !== i))}
          extra={
            <span
              className={`text-[0.7rem] tabular-nums ${text.length >= MAX_NODE_TEXT ? "font-semibold text-danger" : "text-ink-soft"}`}
            >
              {text.length}/{MAX_NODE_TEXT}
            </span>
          }
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-accent bg-accent px-[0.9rem] py-[0.4rem] text-[0.82rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || (!text.trim() && !prompt)}
          onClick={() => void create()}
        >
          {asGhost || (!text.trim() && prompt) ? t.ui.newNode.createGhost : t.ui.newNode.create}
        </button>
        <label className="flex cursor-pointer items-center gap-[0.35rem] text-[0.78rem] text-ink-soft" title={t.ui.newNode.ghostHint}>
          <input type="checkbox" checked={asGhost} disabled={busy} onChange={(e) => setAsGhost(e.target.checked)} />
          {t.ui.newNode.ghost}
        </label>
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-line bg-surface px-[0.9rem] py-[0.4rem] text-[0.82rem] font-semibold text-ink hover:bg-surface-2"
          onClick={onCancel}
        >
          {t.ui.common.cancel}
        </button>
        <span className="ml-auto hidden text-[0.7rem] text-ink-soft sm:inline">{t.ui.newNode.hint}</span>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { MAX_NODE_IMAGES, imageFilesFrom } from "../../utils/images";

interface Props {
  /** null while they're still being fetched. */
  images: string[] | null;
  canEdit: boolean;
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}

// NodePanel's pictures: thumbnails of every image on the node (tap one to see
// it full size) and, for the node's owner, a way to add more — pick a file,
// drop one here, or paste a screenshot anywhere in the panel (NodePanel's own
// onPaste).
export function ImagesSection({ images, canEdit, busy, onAdd, onRemove }: Props) {
  const { t } = useI18n();
  const s = t.ui.images;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const list = images ?? [];
  const full = list.length >= MAX_NODE_IMAGES;

  if (!canEdit && list.length === 0) return null;

  return (
    <div
      className={`mt-3 rounded-lg border border-dashed p-2 ${dragOver ? "border-accent bg-accent-soft" : "border-line"}`}
      onDragOver={(e) => {
        if (!canEdit || !Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        if (!canEdit) return;
        const files = imageFilesFrom(e.dataTransfer);
        if (files.length === 0) return;
        e.preventDefault();
        onAdd(files);
      }}
    >
      <div className="mb-[0.35rem] flex flex-wrap items-center gap-2">
        <span className="text-[0.75rem] font-semibold text-ink-soft">
          {s.title} {list.length > 0 ? `(${list.length})` : ""}
        </span>
        {canEdit && (
          <>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-line bg-surface px-2 py-[0.15rem] text-[0.75rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || full || images === null}
              onClick={() => fileRef.current?.click()}
            >
              {s.add}
            </button>
            <span className="text-[0.7rem] text-ink-soft">{full ? s.limit(MAX_NODE_IMAGES) : s.hint}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) onAdd(files);
              }}
            />
          </>
        )}
      </div>
      {images === null ? (
        <p className="m-0 text-[0.75rem] text-ink-soft">{s.loading}</p>
      ) : (
        list.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {list.map((src, i) => (
              <div key={i} className="relative">
                <button
                  type="button"
                  className="block cursor-zoom-in overflow-hidden rounded-md border border-line bg-surface-2 p-0"
                  title={s.open}
                  onClick={() => setOpen(i)}
                >
                  <img src={src} alt="" className="block h-[72px] w-[96px] object-cover" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="absolute -top-[0.4rem] -right-[0.4rem] flex h-[1.2rem] w-[1.2rem] cursor-pointer items-center justify-center rounded-full border border-line bg-surface p-0 text-[0.75rem] leading-none text-ink-soft shadow-card hover:text-danger disabled:opacity-50"
                    aria-label={s.remove}
                    title={s.remove}
                    disabled={busy}
                    onClick={() => onRemove(i)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
      {open !== null && list[open] && (
        // Full-size view — click anywhere (or press Escape on the button) to close.
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-label={s.title}
          onClick={() => setOpen(null)}
        >
          <img src={list[open]} alt="" className="max-h-full max-w-full rounded-md object-contain shadow-card" />
          <button
            type="button"
            autoFocus
            className="absolute top-3 right-3 cursor-pointer rounded-full border-0 bg-surface px-3 py-1 text-[0.85rem] font-semibold text-ink"
            onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
            onClick={() => setOpen(null)}
          >
            {s.close}
          </button>
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { MAX_NODE_IMAGES } from "../../utils/images";

interface Props {
  /** null while they're still being fetched. */
  images: string[] | null;
  canEdit: boolean;
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  /** Shown at the right end of the toolbar — the text's character count. */
  extra?: ReactNode;
  /** The node's current picture icon (NodeDoc.iconImage), if it has one. */
  iconImage?: string;
  /** Makes picture `index` the node's icon, or (null) goes back to the type's symbol. Unset when this viewer can't. */
  onSetIcon?: (index: number | null) => void;
}

// The lower half of the Info tab's "post" box (see InfoTab): the node's
// pictures laid out under its text the way a post shows them (tap one to see
// it full size) and, for the node's owner, a small toolbar to add more. A
// picture can also be pasted anywhere in the panel (NodePanel's own onPaste)
// or dropped anywhere on the post box (InfoTab).
export function ImagesSection({ images, canEdit, busy, onAdd, onRemove, extra, iconImage = "", onSetIcon }: Props) {
  const { t } = useI18n();
  const s = t.ui.images;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const list = images ?? [];
  const full = list.length >= MAX_NODE_IMAGES;

  if (!canEdit && list.length === 0) return null;

  return (
    <div className="px-[0.7rem] pb-[0.5rem]">
      {images === null ? (
        <p className="m-0 text-[0.75rem] text-ink-soft">{s.loading}</p>
      ) : (
        list.length > 0 && (
          // One picture runs the full width; more go two to a row.
          <div className={`grid gap-[0.35rem] ${list.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {list.map((src, i) => (
              <div key={i} className="relative">
                <button
                  type="button"
                  className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-line bg-surface-2 p-0"
                  title={s.open}
                  onClick={() => setOpen(i)}
                >
                  <img
                    src={src}
                    alt=""
                    className={`block w-full object-cover ${list.length === 1 ? "max-h-[220px]" : "h-[110px]"}`}
                  />
                </button>
                {onSetIcon && (
                  // Shows this picture as the node's icon on the map, instead
                  // of its type's symbol; tapping it again goes back.
                  <button
                    type="button"
                    className="absolute bottom-[0.3rem] left-[0.3rem] cursor-pointer rounded-full border border-line bg-surface px-[0.45rem] py-[0.1rem] text-[0.68rem] font-semibold text-ink shadow-card hover:bg-surface-2 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onSetIcon(i)}
                  >
                    {s.useAsIcon}
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="absolute top-[0.3rem] right-[0.3rem] flex h-[1.3rem] w-[1.3rem] cursor-pointer items-center justify-center rounded-full border border-line bg-surface p-0 text-[0.8rem] leading-none text-ink-soft shadow-card hover:text-danger disabled:opacity-50"
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
      {canEdit && (
        <div className={`flex flex-wrap items-center gap-2 ${list.length > 0 ? "mt-[0.45rem]" : ""}`}>
          <button
            type="button"
            className="cursor-pointer rounded-md border border-line bg-surface-2 px-2 py-[0.15rem] text-[0.75rem] font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || full || images === null}
            title={s.title}
            onClick={() => fileRef.current?.click()}
          >
            {s.add}
          </button>
          <span className="text-[0.7rem] text-ink-soft">{full ? s.limit(MAX_NODE_IMAGES) : s.hint}</span>
          {iconImage && onSetIcon && (
            // The picture icon in use, and a way back to the type's symbol.
            <span className="inline-flex items-center gap-[0.3rem] rounded-full border border-line bg-surface-2 py-[0.1rem] pr-[0.2rem] pl-[0.1rem] text-[0.68rem] font-semibold text-ink">
              <img src={iconImage} alt="" className="h-[1.3rem] w-[1.3rem] rounded-full object-cover" />
              {s.isIcon}
              <button
                type="button"
                className="cursor-pointer rounded-full border-0 bg-transparent px-[0.25rem] text-[0.8rem] leading-none text-ink-soft hover:text-danger disabled:opacity-50"
                aria-label={s.remove}
                disabled={busy}
                onClick={() => onSetIcon(null)}
              >
                ×
              </button>
            </span>
          )}
          {extra && <span className="ml-auto">{extra}</span>}
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
        </div>
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

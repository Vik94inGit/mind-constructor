import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { imageSrc } from "../utils/images";

interface Props {
  /** Picture addresses or data URLs (see utils/images.ts imageSrc); `null` while they load. */
  images: string[] | null;
  onClose: () => void;
}

// A node's pictures, full size, over the whole map — what a click on a node
// with pictures opens first while reading (see MapPage's handleNodeClick).
// Click the backdrop, the close button or press Escape to close; ← / → step
// through several pictures.
export function PictureViewer({ images, onClose }: Props) {
  const { t } = useI18n();
  const s = t.ui.images;
  const [index, setIndex] = useState(0);
  const list = images ?? [];
  const many = list.length > 1;
  const step = (by: number) => setIndex((i) => (i + by + list.length) % list.length);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowLeft") step(-1);
      else if (many && e.key === "ArrowRight") step(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const arrow = "absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-surface/90 px-3 py-2 text-[1.1rem] font-semibold text-ink";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-label={s.title} onClick={onClose}>
      {images === null ? (
        <span className="text-[0.9rem] text-white">{s.loading}</span>
      ) : (
        list[index] && (
          <img
            src={imageSrc(list[index])}
            alt=""
            className="max-h-full max-w-full rounded-md object-contain shadow-card"
            onClick={(e) => e.stopPropagation()}
          />
        )
      )}
      {many && (
        <>
          <button type="button" className={`${arrow} left-3`} aria-label={s.prev} title={s.prev} onClick={(e) => (e.stopPropagation(), step(-1))}>
            ←
          </button>
          <button type="button" className={`${arrow} right-3`} aria-label={s.next} title={s.next} onClick={(e) => (e.stopPropagation(), step(1))}>
            →
          </button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-[0.8rem] text-ink">
            {index + 1} / {list.length}
          </span>
        </>
      )}
      <button
        type="button"
        autoFocus
        className="absolute top-3 right-3 cursor-pointer rounded-full border-0 bg-surface px-3 py-1 text-[0.85rem] font-semibold text-ink"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {s.close}
      </button>
    </div>
  );
}

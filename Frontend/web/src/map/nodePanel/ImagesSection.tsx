import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { MAX_NODE_IMAGES, imageSrc } from "../../utils/images";
import { PICTURE_TEMPLATES, pictureTemplateFile, pictureTemplateThumb } from "../../utils/pictureTemplates";
import type { PictureTemplate } from "../../utils/pictureTemplates";

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
  /** The node's current picture card (NodeDoc.cardImage), if it has one. */
  cardImage?: string;
  /** Shows picture `index` as a card on the map, or (null) removes the card. Unset when this viewer can't. */
  onSetCard?: (index: number | null) => void;
}

const pictureBtn =
  "cursor-pointer rounded-full border border-line bg-surface px-[0.45rem] py-[0.1rem] text-[0.68rem] font-semibold text-ink shadow-card hover:bg-surface-2 disabled:opacity-50";

// The Info tab's pictures box, under the text and its buttons (see InfoTab):
// the node's pictures the way a post shows them (tap one to see it full size)
// and, for the node's owner, a small toolbar to add more. A picture can also
// be pasted anywhere in the panel (NodePanel's own onPaste) or dropped on the
// text box or this one (InfoTab).
export function ImagesSection({ images, canEdit, busy, onAdd, onRemove, extra, iconImage = "", onSetIcon, cardImage = "", onSetCard }: Props) {
  const { t } = useI18n();
  const s = t.ui.images;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // A template's full painting is fetched when it's picked; while that runs
  // the tiles wait, and if it fails (offline) the picker says so.
  const [fetching, setFetching] = useState(false);
  const [templateFailed, setTemplateFailed] = useState(false);
  const list = images ?? [];
  const full = list.length >= MAX_NODE_IMAGES;

  async function pick(kind: PictureTemplate) {
    setFetching(true);
    setTemplateFailed(false);
    try {
      const file = await pictureTemplateFile(kind);
      setTemplatesOpen(false);
      onAdd([file]);
    } catch {
      setTemplateFailed(true);
    } finally {
      setFetching(false);
    }
  }

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
                {/* A node shown as a picture card already shows its picture on
                    the map, so its pictures here don't open full size on a tap. */}
                <ZoomWrap zoom={!cardImage} label={s.open} onOpen={() => setOpen(i)}>
                  {/* The whole picture, scaled to the panel's width (and
                      held under a share of the screen's height), never
                      cropped. */}
                  <img
                    src={imageSrc(src)}
                    alt=""
                    className={`mx-auto block max-w-full object-contain ${list.length === 1 ? "h-auto max-h-[30vh] w-full" : "h-[110px] w-full"}`}
                  />
                </ZoomWrap>
                {(onSetIcon || onSetCard) && (
                  // Shows this picture on the map: as the node's round icon
                  // (instead of its type's symbol) or as a card — one or the
                  // other, choosing one takes the other off.
                  <div className="absolute bottom-[0.3rem] left-[0.3rem] flex flex-wrap gap-[0.25rem]">
                    {onSetIcon && (
                      <button
                        type="button"
                        className={pictureBtn}
                        disabled={busy}
                        onClick={() => onSetIcon(i)}
                      >
                        {s.useAsIcon}
                      </button>
                    )}
                    {onSetCard && (
                      <button
                        type="button"
                        className={pictureBtn}
                        disabled={busy}
                        onClick={() => onSetCard(i)}
                      >
                        {s.useAsCard}
                      </button>
                    )}
                  </div>
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
          <button
            type="button"
            className={`cursor-pointer rounded-md border border-line px-2 py-[0.15rem] text-[0.75rem] font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${templatesOpen ? "bg-surface" : "bg-surface-2"}`}
            disabled={busy || full || images === null}
            aria-expanded={templatesOpen}
            title={s.templatesHint}
            onClick={() => {
              setTemplateFailed(false);
              setTemplatesOpen((v) => !v);
            }}
          >
            {s.templates}
          </button>
          <span className="text-[0.7rem] text-ink-soft">{full ? s.limit(MAX_NODE_IMAGES) : s.hint}</span>
          {iconImage && onSetIcon && (
            // The picture icon in use, and a way back to the type's symbol.
            <span className="inline-flex items-center gap-[0.3rem] rounded-full border border-line bg-surface-2 py-[0.1rem] pr-[0.2rem] pl-[0.1rem] text-[0.68rem] font-semibold text-ink">
              <img src={imageSrc(iconImage)} alt="" className="h-[1.3rem] w-[1.3rem] rounded-full object-cover" />
              {s.isIcon}
              <button
                type="button"
                className="cursor-pointer rounded-full border-0 bg-transparent px-[0.25rem] text-[0.8rem] leading-none text-ink-soft hover:text-danger disabled:opacity-50"
                aria-label={s.removeIcon}
                disabled={busy}
                onClick={() => onSetIcon(null)}
              >
                ×
              </button>
            </span>
          )}
          {cardImage && onSetCard && (
            // The picture card in use, and a way to take it off the map.
            <span className="inline-flex items-center gap-[0.3rem] rounded-full border border-line bg-surface-2 py-[0.1rem] pr-[0.2rem] pl-[0.1rem] text-[0.68rem] font-semibold text-ink">
              <img src={imageSrc(cardImage)} alt="" className="h-[1.3rem] w-[1.8rem] rounded-[3px] object-cover" />
              {s.isCard}
              <button
                type="button"
                className="cursor-pointer rounded-full border-0 bg-transparent px-[0.25rem] text-[0.8rem] leading-none text-ink-soft hover:text-danger disabled:opacity-50"
                aria-label={s.removeCard}
                disabled={busy}
                onClick={() => onSetCard(null)}
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
      {canEdit && templatesOpen && !full && images !== null && (
        // Ready-made paintings (utils/pictureTemplates.ts). Picking one adds
        // it like any other picture (then it can be the icon or card).
        <div className="mt-[0.4rem]">
          <div className="grid grid-cols-5 gap-[0.35rem]" role="group" aria-label={s.templatesHint}>
            {PICTURE_TEMPLATES.map((kind) => {
              const label = s.templateNames[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  data-template={kind}
                  className="aspect-square cursor-pointer overflow-hidden rounded-md border border-line bg-surface p-0 hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
                  disabled={busy || fetching}
                  title={label}
                  aria-label={label}
                  onClick={() => void pick(kind)}
                >
                  <img src={pictureTemplateThumb(kind)} alt="" loading="lazy" className="block h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
          {templateFailed && <p className="m-0 mt-[0.3rem] text-[0.72rem] text-danger">{s.templateFailed}</p>}
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
          <img src={imageSrc(list[open])} alt="" className="max-h-full max-w-full rounded-md object-contain shadow-card" />
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

// A picture that opens full size on a tap, or, with zoom off, just the picture.
function ZoomWrap({ zoom, label, onOpen, children }: { zoom: boolean; label: string; onOpen: () => void; children: ReactNode }) {
  const cls = "block w-full overflow-hidden rounded-md border border-line bg-surface-2 p-0";
  if (!zoom) return <div className={cls} data-testid="picture-no-zoom">{children}</div>;
  return (
    <button type="button" className={`${cls} cursor-zoom-in`} title={label} aria-label={label} onClick={onOpen}>
      {children}
    </button>
  );
}

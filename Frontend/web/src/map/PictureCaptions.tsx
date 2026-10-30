import type { PictureGroup } from "../utils/pictures";
import type { NodeDoc } from "../types";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  pictures: PictureGroup[];
  posFor: (node: NodeDoc) => { x: number; y: number };
  zoom: number;
  /** Whether this viewer may resize and move the picture (every dot is theirs to edit). */
  canEdit: (picture: PictureGroup) => boolean;
  openId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  canGrow: boolean;
  canShrink: boolean;
  onResize: (direction: 1 | -1) => void;
  onMove: () => void;
}

// Keeps a tap on a caption or the bar from reaching the canvas, which would
// start a marquee or clear the selection.
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// Under each picture ("Draw a picture", utils/pictures.ts) a caption says how
// much of it is drawn. Tapping it opens a small bar to make the whole picture
// bigger or smaller, or to pick it up and move it as one
// (docs/gestures/picture-resize.md, hooks/usePictureEdit.ts). The caption
// scales with the canvas; the bar keeps its size on screen.
export function PictureCaptions({
  pictures,
  posFor,
  zoom,
  canEdit,
  openId,
  onOpen,
  onClose,
  canGrow,
  canShrink,
  onResize,
  onMove,
}: Props) {
  const { t } = useI18n();
  const p = t.ui.pictures;
  if (pictures.length === 0) return null;
  return (
    <>
      {pictures.map((g) => {
        const name = p.names[g.kind];
        const spots = [...g.byDot.values()].map(posFor);
        const minX = Math.min(...spots.map((s) => s.x));
        const maxX = Math.max(...spots.map((s) => s.x));
        const minY = Math.min(...spots.map((s) => s.y));
        const maxY = Math.max(...spots.map((s) => s.y));
        const middle = (minX + maxX) / 2;
        const done = g.filled === g.total;
        const label = done ? p.done(name) : p.progress(name, g.percent);
        const editable = canEdit(g);
        const isOpen = openId === g.id;
        const captionStyle = {
          left: middle,
          top: maxY + 150,
          transform: "translate(-50%, -75%)",
          fontSize: 26,
          fontWeight: done ? 700 : 600,
          color: done ? g.def.color : "var(--color-ink-soft)",
        };
        return (
          <div key={g.id} data-picture-caption={g.kind}>
            {isOpen && (
              // Round the whole picture, so it's clear what the bar acts on.
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-[5] rounded-[40px]"
                style={{
                  left: minX - 130,
                  top: minY - 110,
                  width: maxX - minX + 260,
                  height: maxY - minY + 220,
                  border: `${3 / zoom}px dashed ${g.def.color}`,
                }}
              />
            )}
            {editable ? (
              <button
                type="button"
                className="absolute z-[30] cursor-pointer whitespace-nowrap rounded-[14px] px-3 py-1 hover:bg-surface-2/80"
                style={{ ...captionStyle, outline: isOpen ? `${2 / zoom}px solid ${g.def.color}` : undefined }}
                title={p.edit.open}
                aria-expanded={isOpen}
                onPointerDown={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isOpen) onClose();
                  else onOpen(g.id);
                }}
              >
                {label}
              </button>
            ) : (
              <div className="pointer-events-none absolute z-[30] whitespace-nowrap" style={captionStyle}>
                {label}
              </div>
            )}
            {isOpen && (
              <PictureBar
                x={middle}
                y={maxY + 175}
                zoom={zoom}
                canGrow={canGrow}
                canShrink={canShrink}
                onResize={onResize}
                onMove={onMove}
                onClose={onClose}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function PictureBar({
  x,
  y,
  zoom,
  canGrow,
  canShrink,
  onResize,
  onMove,
  onClose,
}: {
  x: number;
  y: number;
  zoom: number;
  canGrow: boolean;
  canShrink: boolean;
  onResize: (direction: 1 | -1) => void;
  onMove: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const e = t.ui.pictures.edit;
  const btn =
    "flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-[8px] px-2 text-[0.9rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div
      role="toolbar"
      aria-label={e.bar}
      data-testid="picture-bar"
      className="absolute z-[40] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card"
      style={{ left: x, top: y, transform: `translate(-50%, 0) scale(${1 / zoom})`, transformOrigin: "top center" }}
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
    >
      <button type="button" className={`${btn} text-[1.2rem]`} aria-label={e.smaller} title={e.smaller} disabled={!canShrink} onClick={() => onResize(-1)}>
        −
      </button>
      <button type="button" className={`${btn} text-[1.2rem]`} aria-label={e.bigger} title={e.bigger} disabled={!canGrow} onClick={() => onResize(1)}>
        +
      </button>
      <button type="button" className={btn} onClick={onMove}>
        {e.move}
      </button>
      <button type="button" className={`${btn} text-accent`} onClick={onClose}>
        {e.close}
      </button>
    </div>
  );
}

import { useI18n } from "../i18n/I18nContext";
import { MAX_ZOOM, MIN_ZOOM } from "../utils/canvasLayout";

interface Props {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  /** Brings every node on screen (useCanvasFraming's fitAll). */
  onFit: () => void;
  /** Whether the minimap sits between this and the view corner's eye button. */
  minimapShown: boolean;
}

const stepBtn =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

// Stacked in the bottom-right corner over the view corner's eye button
// (bottom-3, 36px tall) or, when it's shown, over the minimap that takes the
// corner (bottom-3, ~122px tall with its border): then the eye moves on top
// of the minimap and the zoom controls sit in the same row, left of it. Same z-[45] reasoning as the
// minimap: above the canvas/panel, below a real modal.
export function ZoomControls({ zoom, onZoomOut, onZoomIn, onReset, onFit, minimapShown }: Props) {
  const { t } = useI18n();
  return (
    <div className={`absolute ${minimapShown ? "bottom-[142px] right-[60px]" : "bottom-[56px] right-3"} z-[45] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card`}>
      <button type="button" className={stepBtn} disabled={zoom <= MIN_ZOOM} title={t.map.toolbar.zoomOut} onClick={onZoomOut}>
        −
      </button>
      <button
        type="button"
        className="inline-flex h-7 min-w-[3.2rem] cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent px-1 text-[0.72rem] font-semibold text-ink-soft hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={zoom === 1}
        title={t.map.toolbar.zoomReset}
        onClick={onReset}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={stepBtn} disabled={zoom >= MAX_ZOOM} title={t.map.toolbar.zoomIn} onClick={onZoomIn}>
        +
      </button>
      <button type="button" className={stepBtn} title={t.map.toolbar.fitMap} aria-label={t.map.toolbar.fitMap} onClick={onFit}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </svg>
      </button>
    </div>
  );
}

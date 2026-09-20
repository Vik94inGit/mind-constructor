import { useI18n } from "../i18n/I18nContext";
import { MAX_ZOOM, MIN_ZOOM } from "../utils/canvasLayout";

interface Props {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
}

const stepBtn =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

// Stacked directly above the minimap in the same bottom-right corner (used to
// sit bottom-left; moved to keep both of the canvas's floating controls in one
// place instead of split across the screen). bottom-[150px]: the minimap's own
// bottom-3 (12px) plus its ~122px rendered height (120px MINIMAP_H + its 1px
// border each side) plus a small gap, so this sits just above it rather than
// touching. Same z-[45] reasoning as the minimap: above the canvas/panel,
// below a real modal.
export function ZoomControls({ zoom, onZoomOut, onZoomIn, onReset }: Props) {
  const { t } = useI18n();
  return (
    <div className="absolute bottom-[150px] right-3 z-[45] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
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
    </div>
  );
}

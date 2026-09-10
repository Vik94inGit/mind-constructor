import type { NodeDoc } from "../types";

// Same bottom-sheet look/slot LinkPickerPanel uses (see its own PANEL_CLASS
// doc comment — the 1/3-desktop/2/3-mobile viewport cap kept in sync with
// MapPage's panelReserveFrac()) — this takes over that exact slot while
// pack mode is active, same mutual exclusivity MapPage already gives link
// mode. Picking works the same way link mode's own picking does: tap
// eligible nodes on the canvas to toggle them in or out of packSelection
// (see MapPage's own startPackFrom/eligiblePackIds gating), this panel
// just lists the current picks and confirms/cancels.
const PANEL_CLASS =
  "fixed inset-x-0 bottom-0 z-[46] max-h-[67dvh] sm:max-h-[34dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 shadow-[var(--shadow-card)]";

interface Props {
  containerText: string;
  picks: NodeDoc[];
  error: string | null;
  onRemove: (nodeId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// Only requires 1+ picks (not LinkPickerPanel's 2+, since packing a single
// linked node into the container is already a complete, meaningful action).
export function PackPickerPanel({ containerText, picks, error, onRemove, onConfirm, onCancel }: Props) {
  return (
    <div className={PANEL_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[0.95rem] font-bold text-ink">
            {picks.length === 0 ? "Pick nodes to pack" : `${picks.length} picked`}
          </p>
          <p className="m-0 mt-[0.15rem] text-[0.78rem] text-ink-soft">
            Tap a node linked or branched to <strong>{containerText.slice(0, 40)}</strong> to add or
            remove it — everything picked folds into it and disappears from the canvas.
          </p>
        </div>
        <button
          className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.5rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] hover:bg-surface-2"
          onClick={onCancel}
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}

      {picks.length > 0 && (
        <div className="mt-4 flex flex-col gap-[0.35rem]">
          {picks.map((n) => (
            <div
              key={n.nodeId}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-[0.65rem] py-[0.4rem] text-[0.82rem] text-ink"
            >
              <span className="min-w-0 truncate">{n.text}</span>
              <button
                className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent px-[0.4rem] py-[0.1rem] text-[0.78rem] font-semibold text-ink-soft hover:bg-surface"
                onClick={() => onRemove(n.nodeId)}
                title="Remove from this pack"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.5rem] text-[0.85rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={picks.length < 1}
          onClick={onConfirm}
        >
          {picks.length >= 1 ? `Pack ${picks.length} node${picks.length === 1 ? "" : "s"}` : "Pick at least 1 node"}
        </button>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.5rem] text-[0.85rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

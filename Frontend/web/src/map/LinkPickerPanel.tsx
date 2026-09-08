import type { NodeDoc } from "../types";

// Same bottom-sheet look NodePanel uses (see its own PANEL_CLASS, including
// the same z-[46] reasoning — above the minimap/zoom-controls cluster,
// below a real modal) — this takes over that exact slot while link mode is
// active (see MapPage's own mutual exclusivity between the two), so picking
// nodes to link and viewing a node's own details never compete for the same
// screen space.
const PANEL_CLASS =
  "fixed inset-x-0 bottom-0 z-[46] max-h-[60dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 shadow-[var(--shadow-card)]";

interface Props {
  picks: NodeDoc[];
  error: string | null;
  onRemove: (nodeId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// The "Pick nodes…"/"N picked…" status and the "Link N nodes" confirm
// button used to live only in the map's own top toolbar — which starts
// collapsed (see MapPage's toolbarOpen), so finishing a link that was
// started from a node's own "Link from this node" button (NodePanel's
// Links tab) meant hunting down and reopening that toolbar just to
// confirm it. This puts the whole picking workflow where the rest of a
// node's own actions already live instead.
export function LinkPickerPanel({ picks, error, onRemove, onConfirm, onCancel }: Props) {
  return (
    <div className={PANEL_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[0.95rem] font-bold text-ink">
            {picks.length === 0 ? "Pick nodes to link" : `${picks.length} picked`}
          </p>
          <p className="m-0 mt-[0.15rem] text-[0.78rem] text-ink-soft">
            Tap your own nodes on the canvas to add or remove them.
            {picks.length >= 3 && " Three or more closes into a loop."}
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
                title="Remove from this link"
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
          disabled={picks.length < 2}
          onClick={onConfirm}
        >
          {picks.length >= 2 ? `Link ${picks.length} nodes` : "Pick at least 2 nodes"}
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

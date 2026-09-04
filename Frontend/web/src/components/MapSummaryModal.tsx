import { useEffect, useState } from "react";
import * as mapsApi from "../api/maps";
import type { MapSummary } from "../api/maps";
import { Modal } from "./Modal";
import { ApiRequestError } from "../api/client";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NODE_TYPES } from "../types";
import type { MapDoc } from "../types";

// Horizontal bar chart of node counts by type — each bar carries three
// identity channels (icon shape, text label, color), not just color, since
// this app's existing per-type palette (NODE_TYPE_COLORS, reused here for
// consistency with every node icon elsewhere) isn't colorblind-safe on its
// own: Fail/Success/Solution sit too close together for red-green color
// vision. The icon shape + printed count make every row readable with zero
// color perception at all.
export function MapSummaryModal({ map, onClose }: { map: MapDoc; onClose: () => void }) {
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mapsApi
      .getMapSummary(map.mapId)
      .then((s) => !cancelled && setSummary(s))
      .catch((err) => !cancelled && setError(err instanceof ApiRequestError ? err.message : "Failed to load summary"));
    return () => {
      cancelled = true;
    };
  }, [map.mapId]);

  const maxCount = summary ? Math.max(1, ...NODE_TYPES.map((t) => summary.nodesByType[t] ?? 0)) : 1;

  return (
    <Modal title={`Summary — "${map.name}"`} onClose={onClose}>
      {error && <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}
      {!summary && !error ? (
        <div className="p-12 text-center text-ink-soft">Loading…</div>
      ) : summary ? (
        <>
          <div className="mb-[0.9rem] flex flex-wrap gap-[0.6rem] text-[0.78rem] text-ink-soft">
            <span className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft">
              {summary.nodeCount} node(s)
            </span>
            <span className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft">
              {Array.isArray(summary.members) ? summary.members.length : 0} member(s)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {NODE_TYPES.map((type) => {
              const count = summary.nodesByType[type] ?? 0;
              const pct = (count / maxCount) * 100;
              return (
                <div className="grid grid-cols-[16px_9rem_1fr_2ch] items-center gap-[0.6rem]" key={type}>
                  <NodeTypeIcon type={type} size={16} />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.8rem] text-ink-soft">
                    {type}
                  </span>
                  <div className="h-5 overflow-hidden rounded-[4px] bg-surface-2">
                    <div
                      className="h-full min-w-[2px] rounded-r-[4px] transition-[width] duration-200 ease-in-out"
                      style={{ width: `${pct}%`, background: NODE_TYPE_COLORS[type] }}
                    />
                  </div>
                  <span className="text-right text-[0.8rem] tabular-nums text-ink">{count}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

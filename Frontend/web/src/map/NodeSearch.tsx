import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { filterNodes, isFiltering, toggleType } from "../utils/nodeFilter";
import { NODE_TYPES } from "../types";
import type { NodeDoc, NodeType } from "../types";

interface Props {
  nodes: NodeDoc[];
  /** Makes sure every node's real text is loaded (the list itself leaves it out) — resolves when done. */
  onLoadTexts: () => Promise<void>;
  /** The ids matching the current query (null while nothing is typed) — the canvas dims everything else. */
  onMatches: (ids: Set<string> | null) => void;
  onPick: (nodeId: string) => void;
  /** The node types picked under the search (empty = all). Kept by the map, so the filter outlives the popup. */
  types: NodeType[];
  onTypes: (types: NodeType[]) => void;
  onClose: () => void;
  /** Where it opens from its button: below (top toolbar) or to the right (desktop side panel). */
  side?: "below" | "right";
}

const MAX_RESULTS = 8;

// The toolbar's node search: type to find nodes by their title, text or zone
// name, and/or pick node types to show only those (utils/nodeFilter.ts).
// Matching nodes stay lit on the canvas while the rest dim; clicking a
// result selects that node and brings it to the middle of the screen. The
// picked types stay in force after the popup closes; the typed words don't.
export function NodeSearch({ nodes, onLoadTexts, onMatches, onPick, types, onTypes, onClose, side = "below" }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [textsReady, setTextsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void onLoadTexts().finally(() => !cancelled && setTextsReady(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  const filtering = isFiltering(query, types);
  const matches = useMemo(() => {
    if (!filtering) return [];
    return filterNodes(nodes, query, types);
    // `textsReady`: the texts arrive into `nodes` after the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtering, query, types, nodes, textsReady]);
  // Only the types this map actually has, each with how many nodes it has.
  const typeCounts = useMemo(() => {
    const counts = new Map<NodeType, number>();
    for (const n of nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    return NODE_TYPES.filter((type) => counts.has(type) || types.includes(type)).map((type) => ({ type, count: counts.get(type) ?? 0 }));
  }, [nodes, types]);

  useEffect(() => {
    // The picked types dim the canvas on their own (the map keeps them), so
    // only typed words need reporting.
    onMatches(query.trim() ? new Set(matches.map((n) => n.nodeId)) : null);
  }, [query, matches, onMatches]);
  useEffect(() => () => onMatches(null), [onMatches]);

  return (
    <div
      ref={ref}
      className={`absolute ${side === "right" ? "left-[calc(100%+0.5rem)] top-0" : "left-0 top-[calc(100%+0.4rem)]"} z-[60] flex w-[min(300px,calc(100vw-1.5rem))] flex-col gap-[0.35rem] rounded-card border border-line bg-surface p-[0.5rem] shadow-card`}
    >
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            onPick(matches[0].nodeId);
            onClose();
          }
        }}
        placeholder={t.ui.search.placeholder}
        className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.45rem] text-[0.88rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
      />
      {typeCounts.length > 1 && (
        <div className="flex flex-col gap-[0.3rem] px-[0.2rem]" role="group" aria-label={t.ui.search.byType}>
          <div className="text-[0.72rem] text-ink-soft">{t.ui.search.byType}</div>
          <div className="flex flex-wrap gap-[0.3rem]">
            {typeCounts.map(({ type, count }) => {
              const on = types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={on}
                  title={t.ui.types[type]}
                  onClick={() => onTypes(toggleType(types, type))}
                  className={`inline-flex cursor-pointer items-center gap-[0.3rem] rounded-full border px-[0.5rem] py-[0.2rem] text-[0.75rem] ${
                    on ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  <NodeTypeSymbol type={type} size={13} />
                  <span>{t.ui.types[type]}</span>
                  <span className="text-ink-soft">{count}</span>
                </button>
              );
            })}
            {types.length > 0 && (
              <button
                type="button"
                onClick={() => onTypes([])}
                className="cursor-pointer rounded-full border border-transparent px-[0.5rem] py-[0.2rem] text-[0.75rem] text-ink-soft underline hover:text-ink"
              >
                {t.ui.search.clearTypes}
              </button>
            )}
          </div>
        </div>
      )}
      {filtering && (
        <div className="px-[0.2rem] text-[0.72rem] text-ink-soft">
          {matches.length === 0 ? t.ui.search.none : t.ui.search.found(matches.length)}
        </div>
      )}
      <div className="flex max-h-[45vh] flex-col overflow-y-auto">
        {matches.slice(0, MAX_RESULTS).map((n) => (
          <button
            key={n.nodeId}
            type="button"
            className="flex cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.5rem] py-[0.4rem] text-left text-[0.85rem] text-ink hover:bg-surface-2"
            onClick={() => {
              onPick(n.nodeId);
              onClose();
            }}
          >
            <span className="flex-shrink-0">
              <NodeTypeSymbol type={n.type} size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate">{n.title?.trim() || n.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

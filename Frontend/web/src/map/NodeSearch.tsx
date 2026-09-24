import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "./NodeTypeIcon";
import type { NodeDoc } from "../types";

interface Props {
  nodes: NodeDoc[];
  /** Makes sure every node's real text is loaded (the list itself leaves it out) — resolves when done. */
  onLoadTexts: () => Promise<void>;
  /** The ids matching the current query (null while nothing is typed) — the canvas dims everything else. */
  onMatches: (ids: Set<string> | null) => void;
  onPick: (nodeId: string) => void;
  onClose: () => void;
}

const MAX_RESULTS = 8;

// Lowercase and without accents, so "kralovstvi" finds "Království".
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The toolbar's node search: type to find nodes by their title, text or zone
// name. Matching nodes stay lit on the canvas while the rest dim; clicking a
// result selects that node and brings it to the middle of the screen.
export function NodeSearch({ nodes, onLoadTexts, onMatches, onPick, onClose }: Props) {
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

  const matches = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return [];
    return nodes.filter((n) => fold(`${n.title ?? ""} ${n.text} ${n.zoneName ?? ""}`).includes(needle));
    // `textsReady`: the texts arrive into `nodes` after the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nodes, textsReady]);

  useEffect(() => {
    onMatches(query.trim() ? new Set(matches.map((n) => n.nodeId)) : null);
  }, [query, matches, onMatches]);
  useEffect(() => () => onMatches(null), [onMatches]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-[calc(100%+0.4rem)] z-[60] flex w-[min(300px,calc(100vw-1.5rem))] flex-col gap-[0.35rem] rounded-card border border-line bg-surface p-[0.5rem] shadow-card"
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
      {query.trim() && (
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
              <NodeTypeIcon type={n.type} size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate">{n.title?.trim() || n.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

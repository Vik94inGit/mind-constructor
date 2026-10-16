import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as mapsApi from "../api/maps";
import type { ThoughtHit } from "../api/maps";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

/**
 * Thoughts matching the dashboard's search box, across every map (see the
 * backend's searchNodesAbl). Waits for a short pause in typing; an older
 * answer arriving late never replaces a newer one.
 */
export function useThoughtSearch(query: string) {
  const q = query.trim();
  const [hits, setHits] = useState<ThoughtHit[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (q.length < MIN_QUERY) {
      setHits([]);
      setFailed(false);
      return;
    }
    let stale = false;
    const timer = window.setTimeout(() => {
      mapsApi
        .searchThoughts(q)
        .then((found) => {
          if (stale) return;
          setHits(found);
          setFailed(false);
        })
        .catch(() => {
          if (stale) return;
          setHits([]);
          setFailed(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [q]);
  return { hits: q.length < MIN_QUERY ? [] : hits, failed };
}

export function ThoughtResults({ hits, failed }: { hits: ThoughtHit[]; failed: boolean }) {
  const { t } = useI18n();
  const s = t.dashboard.library;
  if (failed) return <p className="mb-4 text-[0.85rem] text-danger">{s.thoughtsError}</p>;
  if (hits.length === 0) return null;
  return (
    <section className="mb-6" aria-label={s.thoughts}>
      <h2 className="mb-2 text-[0.8rem] font-semibold tracking-[0.04em] text-ink-soft uppercase">{s.thoughts}</h2>
      <ul className="flex flex-col gap-1">
        {hits.map((hit) => (
          <li key={hit.nodeId}>
            <Link
              to={`/maps/${hit.mapId}?node=${hit.nodeId}`}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-ink no-underline hover:bg-surface-2"
            >
              <span className="mt-[0.1rem] shrink-0">
                <NodeTypeIcon type={hit.type} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                {hit.title && <span className="block text-[0.85rem] font-semibold">{hit.title}</span>}
                <span className="block text-[0.85rem] break-words">{hit.snippet || hit.zoneName}</span>
                <span className="block text-[0.72rem] text-ink-soft">{s.thoughtIn(hit.mapName)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

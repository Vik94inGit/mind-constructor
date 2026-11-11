import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as nodesApi from "../api/nodes";
import * as mapsApi from "../api/maps";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { MapIcon } from "./LibraryTile";
import { miniature, recentThoughts } from "./firstMap";
import type { Miniature } from "./firstMap";
import type { MapDoc, NodeDoc } from "../types";

const W = 640;
const H = 220;
const LATEST = 5;

interface Latest {
  node: NodeDoc;
  map: MapDoc;
  text: string;
}

/**
 * The dashboard right after the user made their first map from a template:
 * the map itself, drawn small, on top, and the thoughts they wrote last right
 * under it (that map's and the Inbox's quick notes, newest first), each one
 * opening the map at that thought.
 */
export function FirstMapCard({ map, inbox }: { map: MapDoc; inbox: MapDoc | null }) {
  const { t } = useI18n();
  const s = t.dashboard.library.firstMap;
  const [mini, setMini] = useState<Miniature | null>(null);
  const [latest, setLatest] = useState<Latest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inboxId = inbox?.mapId ?? null;

  useEffect(() => {
    let stale = false;
    const sources = inbox ? [map, inbox] : [map];
    Promise.all(sources.map((m) => nodesApi.listNodes(m.mapId).then((nodes) => ({ m, nodes }))))
      .then(async (loaded) => {
        const own = loaded[0].nodes;
        const newest = recentThoughts(
          loaded.flatMap(({ nodes }) => nodes),
          LATEST,
        );
        const mapOf = new Map(loaded.flatMap(({ m, nodes }) => nodes.map((n) => [n.nodeId, m] as const)));
        // The node list leaves each node's text out; one request per map fills in only the ones shown.
        const texts = await Promise.all(
          loaded.map(({ m }) => {
            const ids = newest.filter((n) => mapOf.get(n.nodeId) === m).map((n) => n.nodeId);
            return ids.length ? mapsApi.getNodesText(m.mapId, ids) : Promise.resolve({} as Record<string, string>);
          }),
        );
        const textById: Record<string, string> = Object.assign({}, ...texts);
        if (stale) return;
        setMini(miniature(own, W, H));
        setLatest(
          newest.map((node) => ({
            node,
            map: mapOf.get(node.nodeId)!,
            text: node.title?.trim() || (textById[node.nodeId] ?? node.text ?? "").trim() || node.prompt || "",
          })),
        );
        setFailed(false);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
    // Reloaded when either map gains or loses a thought (a quick note saved, a note moved out of the Inbox).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.mapId, map.nodeCount, inboxId, inbox?.nodeCount]);

  return (
    <section className="mb-8 overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label={s.title}>
      <Link
        to={`/maps/${map.mapId}`}
        className="block text-ink no-underline transition-colors duration-[120ms] hover:bg-surface-2"
      >
        <div className="flex items-center gap-3 px-4 pt-4">
          <MapIcon color={map.color} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.75rem] font-semibold tracking-[0.03em] text-ink-soft uppercase">{s.title}</span>
            <span className="block truncate text-[1.05rem] font-bold">{map.name}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-accent px-3 py-[0.45rem] text-[0.85rem] font-semibold text-white">
            {s.open} →
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 block h-auto max-h-[240px] w-full"
          role="img"
          aria-label={map.name}
          data-testid="first-map-preview"
        >
          {mini?.links.map((l) => (
            <line
              key={`${l.from.id}-${l.to.id}`}
              x1={l.from.x}
              y1={l.from.y}
              x2={l.to.x}
              y2={l.to.y}
              stroke="var(--ink-soft)"
              strokeOpacity={0.45}
              strokeWidth={2}
            />
          ))}
          {mini?.nodes.map((n) => (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={9}
              fill={NODE_TYPE_COLORS[n.type] ?? NODE_TYPE_COLORS.unknown}
              opacity={n.ghost ? 0.3 : 1}
              stroke={n.ghost ? NODE_TYPE_COLORS[n.type] : "none"}
              strokeDasharray={n.ghost ? "3 3" : undefined}
            />
          ))}
        </svg>
      </Link>

      <div className="border-t border-line px-4 py-3">
        <h2 className="mt-0 mb-2 text-[0.8rem] font-semibold tracking-[0.04em] text-ink-soft uppercase">{s.latest}</h2>
        {failed ? (
          <p className="m-0 text-[0.85rem] text-danger">{s.error}</p>
        ) : latest === null ? null : latest.length === 0 ? (
          <p className="m-0 text-[0.85rem] text-ink-soft">{s.none}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {latest.map(({ node, map: where, text }) => (
              <li key={node.nodeId}>
                <Link
                  to={`/maps/${where.mapId}?node=${node.nodeId}`}
                  className="flex items-start gap-3 rounded-lg px-2 py-[0.4rem] text-ink no-underline hover:bg-surface-2"
                >
                  <span className="mt-[0.1rem] shrink-0">
                    <NodeTypeIcon type={node.type} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.88rem] break-words">{text}</span>
                    {where.mapId !== map.mapId && (
                      <span className="block text-[0.72rem] text-ink-soft">{s.inMap(where.name)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

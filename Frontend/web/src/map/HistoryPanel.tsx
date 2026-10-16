import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import * as mapsApi from "../api/maps";
import type { NodeRevisionDoc, NodeType } from "../types";

interface Props {
  mapId: string;
  /** Node ids still on the map — an entry for one of them can be shown there. */
  liveIds: Set<string>;
  onShow: (nodeId: string) => void;
  onExit: () => void;
}

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-[0.6rem] py-[0.25rem] text-[0.75rem] font-semibold text-ink enabled:hover:bg-surface-2";

// The discussion's history: every edit of what a point says, and every
// deletion, newest first, for every member (Backend's NodeRevision). Read
// only — nothing here can remove an entry. Takes over the bottom-sheet slot
// like SiegePanel.
export function HistoryPanel({ mapId, liveIds, onShow, onExit }: Props) {
  const { t, language } = useI18n();
  const h = t.ui.siege.history;
  const [rows, setRows] = useState<NodeRevisionDoc[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    mapsApi
      .getMapHistory(mapId)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [mapId]);

  const typeName = (type: string) => t.ui.types[type as NodeType] ?? type;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-x-0 bottom-0 z-[46] flex max-h-[55vh] flex-col gap-2 overflow-y-auto border-t border-line bg-surface px-5 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[0.9rem] text-ink" title={h.intro}>
          ◷ {h.title}
        </strong>
        <button className={btn} onClick={onExit} aria-label={t.ui.common.close}>
          ✕
        </button>
      </div>
      <p className="text-[0.78rem] text-ink-soft">{h.intro}</p>
      {failed ? (
        <p className="text-[0.82rem] font-semibold text-danger">{h.failed}</p>
      ) : rows === null ? (
        <p className="text-[0.82rem] text-ink-soft">{h.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-[0.82rem] text-ink-soft">{h.empty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => {
            const who = typeof r.userId === "string" ? "?" : r.userId.username;
            const deleted = r.action === "delete";
            const after = r.after;
            return (
              <li key={r.revisionId} className="rounded-lg border border-line px-3 py-2 text-[0.82rem] text-ink">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.75rem] text-ink-soft">
                  <span>
                    <strong className="text-ink">{who}</strong> {deleted ? h.deleted : h.edited} · {when(r.createdAt)}
                  </span>
                  {liveIds.has(r.nodeId) && (
                    <button className={btn} onClick={() => onShow(r.nodeId)}>
                      {h.show}
                    </button>
                  )}
                </div>
                {after && after.type !== r.before.type && (
                  <div className="mt-1 text-[0.75rem] text-ink-soft">{h.typeChanged(typeName(r.before.type), typeName(after.type))}</div>
                )}
                {after && after.title !== r.before.title && (
                  <div className="mt-1">
                    <span className="text-ink-soft">{h.titleChanged}: </span>
                    {r.before.title && <del className="text-danger">{r.before.title}</del>} {after.title && <ins className="text-success no-underline">{after.title}</ins>}
                  </div>
                )}
                {(deleted || (after && after.text !== r.before.text)) && (
                  <div className="mt-1 flex flex-col gap-1 whitespace-pre-wrap break-words">
                    {r.before.text && <del className="text-danger">{r.before.text}</del>}
                    {after?.text && <ins className="text-success no-underline">{after.text}</ins>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

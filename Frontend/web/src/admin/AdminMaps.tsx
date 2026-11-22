import { useEffect, useMemo, useState } from "react";
import * as adminApi from "../api/admin";
import type { AdminMap } from "../api/admin";
import { ApiRequestError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { useConfirm } from "../context/ConfirmContext";
import { ErrorBanner } from "../components/ErrorBanner";
import { filterMaps, shortDate } from "./cleanup";

const TH =
  "border-b border-line bg-surface-2 px-[0.85rem] py-[0.65rem] text-left text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase";
const DANGER_BTN =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-danger-bg bg-danger-bg px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

// The admin page's list of every map in the app, whoever owns it, each with
// a Delete that asks first (Backend's DELETE /api/admin/maps/:mapId).
// `reloadKey` changes when the user list deleted accounts, whose maps went too.
export function AdminMaps({ reloadKey }: { reloadKey: number }) {
  const { t, language } = useI18n();
  const c = t.ui.admin.cleanup;
  const confirm = useConfirm();
  const [maps, setMaps] = useState<AdminMap[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setError(null);
    adminApi
      .listAllMaps()
      .then((next) => !stale && setMaps(next))
      .catch((err) => !stale && setError(err instanceof ApiRequestError ? err.message : t.ui.errors.action));
    return () => {
      stale = true;
    };
  }, [reloadKey]);

  const shown = useMemo(() => filterMaps(maps ?? [], query), [maps, query]);

  async function remove(m: AdminMap) {
    if (!(await confirm(c.deleteMapConfirm(m.name, m.ownerName ?? "?", m.writtenNodes), { confirmLabel: t.ui.common.delete, danger: true })))
      return;
    setBusyId(m.mapId);
    setError(null);
    try {
      await adminApi.deleteMapAsAdmin(m.mapId);
      setMaps((prev) => (prev ?? []).filter((x) => x.mapId !== m.mapId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.action);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-bold">
            {c.mapsTitle}
            {maps ? <span className="ml-2 text-[0.85rem] font-normal text-ink-soft">{maps.length}</span> : null}
          </h2>
          <p className="mt-[0.2rem] mb-0 text-[0.85rem] text-ink-soft">{c.mapsHint}</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={c.filter}
          aria-label={c.filter}
          className="w-full max-w-[260px] rounded-lg border border-line bg-surface px-3 py-[0.45rem] text-[0.85rem] text-ink"
        />
      </div>
      <ErrorBanner message={error} />
      {maps === null ? (
        !error && <div className="p-8 text-center text-ink-soft">{c.loadingMaps}</div>
      ) : shown.length === 0 ? (
        <div className="p-8 text-center text-ink-soft">{c.noMaps}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full overflow-hidden rounded-card border border-line bg-surface" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className={TH}>{c.mapName}</th>
                <th className={TH}>{c.owner}</th>
                <th className={TH}>{c.members}</th>
                <th className={TH}>{c.thoughts}</th>
                <th className={TH}>{c.changed}</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m, i) => {
                const cell = `px-[0.85rem] py-[0.65rem] text-[0.85rem]${i === shown.length - 1 ? "" : " border-b border-line"}`;
                return (
                  <tr key={m.mapId}>
                    <td className={cell}>{m.name}</td>
                    <td className={cell}>{m.ownerName ?? "?"}</td>
                    <td className={cell}>{m.memberCount}</td>
                    <td className={cell}>{m.writtenNodes}</td>
                    <td className={`${cell} whitespace-nowrap text-ink-soft`}>{shortDate(m.updatedAt, language) ?? c.never}</td>
                    <td className={cell}>
                      <button className={DANGER_BTN} disabled={busyId === m.mapId} onClick={() => remove(m)}>
                        {t.ui.admin.delete}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

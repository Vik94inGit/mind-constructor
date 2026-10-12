import { useEffect, useState } from "react";
import * as mapsApi from "../api/maps";
import * as authApi from "../api/auth";
import { Modal } from "./Modal";
import { ApiRequestError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import type { MapDoc, UserSearchResult } from "../types";

// How long typing has to pause before the search goes out — one request per
// word typed, not one per keystroke.
const SEARCH_DELAY_MS = 250;

export function InviteMemberModal({
  map,
  onClose,
  onInvited,
}: {
  map: MapDoc;
  onClose: () => void;
  onInvited?: (map: MapDoc) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  // null: nothing searched yet (query too short), or a search still running.
  const [results, setResults] = useState<UserSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The server leaves out you and everyone already on this map (see
  // Backend's searchUsersAbl), so every result can be invited as is.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      authApi
        .searchUsers(q, map.mapId)
        .then((users) => {
          if (cancelled) return;
          setResults(users);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setResults([]);
          setError(err instanceof ApiRequestError ? err.message : t.ui.invite.searchFailed);
        })
        .finally(() => !cancelled && setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, map.mapId]);

  async function invite(user: UserSearchResult) {
    setError(null);
    setSuccess(null);
    setBusyId(user._id);
    try {
      const updated = await mapsApi.inviteMember(map.mapId, user._id);
      setSuccess(t.ui.invite.invited(user.username));
      // Now a member, so no longer someone to invite.
      setResults((prev) => prev?.filter((u) => u._id !== user._id) ?? null);
      onInvited?.(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.invite.failed);
    } finally {
      setBusyId(null);
    }
  }

  const q = query.trim();

  return (
    <Modal title={t.ui.invite.title(map.name)} onClose={onClose}>
      {error && <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}
      {success && (
        <div className="mb-4 rounded-lg bg-success-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-success">{success}</div>
      )}
      <div className="mb-3 flex flex-col gap-[0.35rem]">
        <label htmlFor="invite-search" className="text-[0.8rem] font-semibold text-ink-soft">
          {t.ui.invite.search}
        </label>
        <input
          id="invite-search"
          type="search"
          autoFocus
          autoComplete="off"
          value={query}
          placeholder={t.ui.invite.placeholder}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
        />
      </div>

      {q.length < 2 ? (
        <p className="text-[0.85rem] text-ink-soft">{t.ui.invite.typeMore}</p>
      ) : searching && !results ? (
        <p className="text-[0.85rem] text-ink-soft">{t.ui.invite.searching}</p>
      ) : results && results.length === 0 ? (
        <p className="text-[0.85rem] text-ink-soft">{searching ? t.ui.invite.searching : t.ui.invite.noResults}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line" aria-busy={searching}>
          {results?.map((u) => (
            <li key={u._id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9rem] font-semibold text-ink">{u.username}</div>
                <div className="truncate text-[0.78rem] text-ink-soft">{u.email}</div>
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-accent bg-accent px-3 py-[0.4rem] text-[0.82rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busyId !== null}
                onClick={() => invite(u)}
              >
                {busyId === u._id ? t.ui.invite.inviting : t.ui.invite.invite}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-[1.2rem] flex justify-end">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onClose}
        >
          {t.ui.common.close}
        </button>
      </div>
    </Modal>
  );
}

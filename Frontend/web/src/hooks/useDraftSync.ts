import { useEffect, useRef } from "react";
import * as stateApi from "../api/state";
import type { DraftKind } from "../api/state";

const SAVE_DELAY_MS = 1200;

const tsKey = (kind: DraftKind, userId: string) => `mc_draft_ts:${kind}:${userId}`;
function readTs(kind: DraftKind, userId: string): number {
  try {
    return Number(localStorage.getItem(tsKey(kind, userId))) || 0;
  } catch {
    return 0;
  }
}
function writeTs(kind: DraftKind, userId: string, ts: number | null) {
  try {
    if (ts === null) localStorage.removeItem(tsKey(kind, userId));
    else localStorage.setItem(tsKey(kind, userId), String(ts));
  } catch {
    // best-effort
  }
}

/** Marks this device's copy of the draft as the newest (a fresh start that should win over an older one elsewhere). */
export function markDraftChanged(kind: DraftKind, userId: string) {
  writeTs(kind, userId, Date.now());
}

/**
 * Keeps a draft (kept in this browser by its page) in step with the copy on
 * the server, so it can be finished on another device. On opening, whichever
 * copy was changed last wins: a newer server copy is handed to `apply` (after
 * `parse` checks it), a newer local one is sent up. After that, every change
 * is sent a moment after typing stops. Returns `discard`, for when the draft
 * is used up (the map was made) or thrown away.
 */
export function useDraftSync<T>({
  kind,
  userId,
  enabled,
  draft,
  isEmpty,
  parse,
  apply,
}: {
  kind: DraftKind;
  userId: string;
  enabled: boolean;
  draft: T;
  isEmpty: (draft: T) => boolean;
  parse: (data: unknown) => T | null;
  apply: (draft: T) => void;
}): { discard: () => void } {
  const readyRef = useRef(false);
  // The draft as last applied from the server — its echo isn't a change.
  const appliedRef = useRef<T | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    readyRef.current = false;
    if (!enabled) return;
    let cancelled = false;
    stateApi
      .getDraft(kind)
      .then((remote) => {
        if (cancelled) return;
        const localTs = readTs(kind, userId);
        const parsed = remote ? parse(remote.data) : null;
        if (remote && parsed && remote.clientUpdatedAt > localTs) {
          appliedRef.current = parsed;
          writeTs(kind, userId, remote.clientUpdatedAt);
          apply(parsed);
        } else if (!isEmpty(draftRef.current) && (!remote || localTs > remote.clientUpdatedAt)) {
          stateApi.saveDraft(kind, draftRef.current, localTs || Date.now()).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) readyRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // Once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, userId, enabled]);

  const pendingTsRef = useRef<number | null>(null);
  function flush() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const ts = pendingTsRef.current;
    pendingTsRef.current = null;
    if (ts === null) return;
    const current = draftRef.current;
    (isEmpty(current) ? stateApi.deleteDraft(kind) : stateApi.saveDraft(kind, current, ts)).catch(() => {});
  }

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    if (appliedRef.current === draft) return;
    const ts = Date.now();
    writeTs(kind, userId, ts);
    pendingTsRef.current = ts;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Leaving the page (or the app going to the background) sends what's waiting.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    discard: () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingTsRef.current = null;
      writeTs(kind, userId, null);
      if (enabled) stateApi.deleteDraft(kind).catch(() => {});
    },
  };
}

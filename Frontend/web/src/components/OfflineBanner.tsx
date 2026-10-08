import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext";
import {
  dismissSyncFailures,
  flush,
  getSyncStatus,
  onSynced,
  subscribeSyncStatus,
} from "../offline/sync";

// A small pill along the bottom of every page saying whether the app is
// working offline and how many changes are still waiting to reach the server
// (see offline/sync.ts). Hidden while everything is online and saved. Kept
// deliberately tiny — one short line, small type, tucked in the bottom-left
// corner — so it reads as a status note rather than covering the canvas.
export function OfflineBanner() {
  const { t } = useI18n();
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const navigate = useNavigate();
  const location = useLocation();
  const [justSynced, setJustSynced] = useState(false);

  // A map made offline lives at /maps/<temporary id> until it reaches the
  // server — then the address moves to its real id.
  useEffect(
    () =>
      onSynced((ids) => {
        setJustSynced(true);
        const m = /^\/maps\/([^/]+)$/.exec(location.pathname);
        if (m && ids[m[1]]) navigate(`/maps/${ids[m[1]]}`, { replace: true });
      }),
    [location.pathname, navigate],
  );
  useEffect(() => {
    if (!justSynced) return;
    const timer = setTimeout(() => setJustSynced(false), 3000);
    return () => clearTimeout(timer);
  }, [justSynced]);

  const s = t.ui.offline;
  let message: string | null = null;
  let action: { label: string; run: () => void } | null = null;
  let tone: "muted" | "danger" | "success" = "muted";

  if (status.failed) {
    message = s.failed(status.failed.count, status.failed.lastError);
    action = { label: s.dismiss, run: dismissSyncFailures };
    tone = "danger";
  } else if (status.needsSignIn && status.pending > 0) {
    message = s.signIn(status.pending);
    tone = "danger";
  } else if (!status.online) {
    message = status.pending > 0 ? s.offlinePending(status.pending) : s.offline;
  } else if (status.syncing) {
    message = s.syncing(status.pending);
  } else if (status.pending > 0) {
    message = s.pending(status.pending);
    action = { label: s.syncNow, run: () => void flush() };
  } else if (justSynced) {
    message = s.synced;
    tone = "success";
  }

  if (!message) return null;
  const toneClass =
    tone === "danger"
      ? "bg-danger-bg text-danger"
      : tone === "success"
        ? "bg-success-bg text-success"
        : "bg-surface text-ink";

  return (
    <div
      role="status"
      aria-live="polite"
      title={message}
      className={`pointer-events-auto fixed bottom-2 left-2 z-[60] flex max-w-[min(20rem,calc(100vw-1rem))] items-center gap-[0.4rem] rounded-full border border-line px-[0.55rem] py-[0.15rem] text-[0.68rem] leading-tight opacity-90 shadow-sm ${toneClass}`}
    >
      {!status.online && (
        <span aria-hidden="true" className="inline-block h-[0.4rem] w-[0.4rem] shrink-0 rounded-full bg-ink-soft" />
      )}
      <span className="min-w-0 truncate">{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="shrink-0 cursor-pointer rounded-full border border-line px-[0.4rem] py-0 font-semibold hover:bg-paper"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

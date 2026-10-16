import { useI18n } from "../i18n/I18nContext";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.65rem] py-[0.3rem] text-[0.78rem] font-semibold transition-[background-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50";

// A finished discussion (see utils/finish.ts): how the fight ended, a way to
// watch it again from the first point, and — for the owner — to reopen it.
export function FinishedBanner({
  standing,
  fallen,
  onReplay,
  onReopen,
  busy,
}: {
  standing: number;
  fallen: number;
  onReplay: () => void;
  /** Owner only. */
  onReopen?: () => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const f = t.ui.siege.finish;
  return (
    <div
      role="status"
      className="mx-4 mt-[0.6rem] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-line bg-surface-2 px-[0.9rem] py-[0.6rem] text-[0.85rem] text-ink"
    >
      <span>
        <strong>⚐ {f.finished(standing, fallen)}</strong> <span className="text-ink-soft">{f.closed}</span>
      </span>
      <span className="flex gap-2">
        <button className={`${btn} border-accent bg-accent text-white enabled:hover:opacity-90`} onClick={onReplay}>
          ▶ {f.replay}
        </button>
        {onReopen && (
          <button className={`${btn} border-line bg-surface text-ink enabled:hover:bg-surface-2`} disabled={busy} onClick={onReopen}>
            {f.reopen}
          </button>
        )}
      </span>
    </div>
  );
}

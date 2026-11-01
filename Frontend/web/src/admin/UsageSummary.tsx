import { useEffect, useState } from "react";
import * as usageApi from "../api/usage";
import type { UsageSummary as Summary } from "../api/usage";
import { ApiRequestError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { browserOptedOut } from "../utils/usage";
import { featureRows } from "./featureRows";

const WINDOWS = [7, 30, 90] as const;

// The admin page's usage numbers: who's active, what got made, people per
// day, and what they did (utils/usage.ts records it, Backend's usageAbl.ts sums it).
export function UsageSummary() {
  const { t } = useI18n();
  const s = t.ui.admin.usage;
  const [days, setDays] = useState<number>(30);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setError(null);
    usageApi
      .getUsageSummary(days, includeDemo)
      .then((next) => !stale && setSummary(next))
      .catch((err) => !stale && setError(err instanceof ApiRequestError ? err.message : s.failed));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, includeDemo]);

  const tiles: [string, number | undefined][] = [
    [s.today, summary?.active.today],
    [s.week, summary?.active.week],
    [s.month, summary?.active.month],
    [s.returning, summary?.active.returning],
    [s.newUsers, summary?.created.newUsers],
    [s.maps, summary?.created.maps],
    [s.nodes, summary?.created.nodes],
    [s.users, summary?.created.users],
  ];

  return (
    <section className="mb-8" aria-label={s.title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-bold">{s.title}</h2>
          <p className="mt-[0.2rem] mb-0 max-w-[60ch] text-[0.8rem] text-ink-soft">{s.hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[0.82rem]">
          <div className="flex overflow-hidden rounded-lg border border-line" role="group">
            {WINDOWS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={days === n}
                onClick={() => setDays(n)}
                className={`cursor-pointer px-3 py-[0.35rem] font-semibold ${
                  days === n ? "bg-accent-soft text-accent-ink" : "bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                {s.days(n)}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-[0.35rem]">
            <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
            {s.includeDemo}
          </label>
        </div>
      </div>

      {browserOptedOut() && (
        <div className="mb-3 rounded-lg bg-accent-soft px-[0.9rem] py-[0.6rem] text-[0.82rem] text-accent-ink">{s.optedOut}</div>
      )}
      {error && <div className="mb-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}
      {!summary && !error && <div className="p-6 text-center text-ink-soft">{s.loading}</div>}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-card border border-line bg-surface px-3 py-[0.6rem]">
                <div className="text-[0.72rem] text-ink-soft">{label}</div>
                <div className="text-xl font-bold tabular-nums">{value ?? "–"}</div>
              </div>
            ))}
          </div>
          <DailyChart summary={summary} />
          <FeatureTable summary={summary} />
          <EventTable summary={summary} />
        </>
      )}
    </section>
  );
}

function DailyChart({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const s = t.ui.admin.usage;
  const max = Math.max(1, ...summary.daily.map((d) => d.users));
  const first = summary.daily[0]?.day;
  const last = summary.daily[summary.daily.length - 1]?.day;
  return (
    <figure className="m-0 mb-4 rounded-card border border-line bg-surface p-3">
      <figcaption className="mb-2 flex justify-between text-[0.78rem] font-semibold">
        <span>{s.dailyTitle}</span>
        <span className="text-ink-soft tabular-nums">max {max}</span>
      </figcaption>
      <div className="flex h-28 items-end gap-[2px] border-b border-line" role="list">
        {summary.daily.map((d) => (
          <div
            key={d.day}
            role="listitem"
            title={s.dayTip(d.day, d.users, d.events)}
            aria-label={s.dayTip(d.day, d.users, d.events)}
            className="group flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className="w-full rounded-t-[4px] bg-accent opacity-85 group-hover:opacity-100"
              style={{ height: d.users ? `${Math.max(4, (d.users / max) * 100)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.7rem] text-ink-soft tabular-nums">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </figure>
  );
}

function EventTable({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const s = t.ui.admin.usage;
  const th = "border-b border-line bg-surface-2 px-[0.85rem] py-[0.5rem] text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase";
  if (summary.events.length === 0) return <p className="text-[0.85rem] text-ink-soft">{s.none}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full overflow-hidden rounded-card border border-line bg-surface" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className={`${th} text-left`}>{s.event}</th>
            <th className={`${th} text-right`}>{s.times}</th>
            <th className={`${th} text-right`}>{s.people}</th>
          </tr>
        </thead>
        <tbody>
          {summary.events.map((e, i) => {
            const cell = `px-[0.85rem] py-[0.45rem] text-[0.85rem]${i === summary.events.length - 1 ? "" : " border-b border-line"}`;
            return (
              <tr key={e.name}>
                <td className={cell}>{s.events[e.name] ?? e.name}</td>
                <td className={`${cell} text-right tabular-nums`}>{e.count}</td>
                <td className={`${cell} text-right tabular-nums`}>{e.users}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FeatureTable({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const s = t.ui.admin.usage;
  const rows = featureRows(summary);
  const th = "border-b border-line bg-surface-2 px-[0.85rem] py-[0.5rem] text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase";
  return (
    <div className="mb-4">
      <h3 className="mt-0 mb-[0.2rem] text-[0.95rem] font-bold">{s.featuresTitle}</h3>
      <p className="mt-0 mb-2 text-[0.8rem] text-ink-soft">{s.featuresHint}</p>
      <div className="max-h-[28rem] overflow-auto rounded-card border border-line">
        <table className="w-full bg-surface" style={{ borderCollapse: "collapse" }}>
          <thead className="sticky top-0">
            <tr>
              <th className={`${th} text-left`}>{s.feature}</th>
              <th className={`${th} text-right`}>{s.times}</th>
              <th className={`${th} text-right`}>{s.people}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const label = (r.kind === "event" ? s.events[r.name] : s.features[r.name]) ?? r.name;
              const cell = `px-[0.85rem] py-[0.4rem] text-[0.85rem]${i === rows.length - 1 ? "" : " border-b border-line"}`;
              const unused = r.count === 0;
              return (
                <tr key={r.key}>
                  <td className={`${cell}${unused ? " text-ink-soft" : ""}`}>
                    {label}
                    {unused && (
                      <span className="ml-2 rounded-[5px] bg-danger-bg px-[0.4rem] py-[0.1rem] text-[0.68rem] font-bold text-danger">
                        {s.neverUsed}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} text-right tabular-nums`}>{r.count}</td>
                  <td className={`${cell} text-right tabular-nums`}>{r.users}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

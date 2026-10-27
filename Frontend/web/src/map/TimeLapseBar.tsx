import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { NodeDoc } from "../types";

/** A map's nodes in the order they were written, oldest first — what the time-lapse replays. */
export function timeLapseOrder(nodes: NodeDoc[]): NodeDoc[] {
  return nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (a.n.createdAt ?? "").localeCompare(b.n.createdAt ?? "") || a.i - b.i)
    .map(({ n }) => n);
}

export type TimeLapseSpeed = "slow" | "normal" | "fast";
export const TIME_LAPSE_SPEEDS: TimeLapseSpeed[] = ["slow", "normal", "fast"];
const SPEED_FACTOR: Record<TimeLapseSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5 };

/**
 * How long the replay stays on a node: long enough to read it. A base
 * moment plus a little per character of what it says, within limits, then
 * scaled by the chosen speed. Before the first node, a short beat.
 */
export function timeLapseStepMs(node: NodeDoc | undefined, speed: TimeLapseSpeed = "normal"): number {
  if (!node) return 600;
  const chars = (node.title || node.text || node.prompt || "").length;
  const read = Math.min(5000, Math.max(1800, 1400 + 35 * chars));
  return Math.round(read * SPEED_FACTOR[speed]);
}

// The chosen speed is a per-browser view preference, like the minimap.
const SPEED_KEY = "mc_time_lapse_speed";
export function loadTimeLapseSpeed(): TimeLapseSpeed {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    return v === "slow" || v === "fast" ? v : "normal";
  } catch {
    return "normal";
  }
}
function saveTimeLapseSpeed(speed: TimeLapseSpeed) {
  try {
    localStorage.setItem(SPEED_KEY, speed);
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

interface Props {
  /** How many nodes, oldest first, are on the map at this step. Playing stops at `total`. */
  step: number;
  total: number;
  playing: boolean;
  /** The newest node shown: the replay stays on it long enough to read it. */
  current?: NodeDoc;
  /** When the newest node shown was written, for the label. */
  at?: string;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
  onExit: () => void;
}

// The time-lapse's bottom bar: the map replays node by node from the first
// thought, and the slider scrubs back and forth through it. Takes the bottom
// sheet's slot, like DrawLineBar.
export function TimeLapseBar({ step, total, playing, current, at, onStep, onTogglePlay, onExit }: Props) {
  const { t, language } = useI18n();
  const s = t.map.toolbar;
  const [speed, setSpeed] = useState<TimeLapseSpeed>(loadTimeLapseSpeed);
  const dwell = timeLapseStepMs(step > 0 ? current : undefined, speed);

  useEffect(() => {
    if (!playing || step >= total) return;
    const id = window.setTimeout(() => onStep(step + 1), dwell);
    return () => window.clearTimeout(id);
  }, [playing, step, total, onStep, dwell]);

  const btn =
    "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color] duration-[120ms] hover:bg-surface-2";
  const date = at ? new Date(at) : null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[46] flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface px-5 py-3 shadow-[var(--shadow-card)]">
      <button type="button" className={btn} aria-label={playing ? s.timeLapsePause : s.timeLapsePlay} title={playing ? s.timeLapsePause : s.timeLapsePlay} onClick={onTogglePlay}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          {playing ? (
            <path d="M3.5 2.5 H5.5 V11.5 H3.5 Z M8.5 2.5 H10.5 V11.5 H8.5 Z" fill="currentColor" />
          ) : (
            <path d="M4 2.2 L11.5 7 L4 11.8 Z" fill="currentColor" />
          )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={total}
        value={step}
        aria-label={s.timeLapse}
        className="min-w-[8rem] flex-1 accent-[var(--accent)]"
        onChange={(e) => onStep(Number(e.target.value))}
      />
      <span className="text-[0.8rem] whitespace-nowrap text-ink-soft tabular-nums">
        {s.timeLapseStep(step, total)}
        {date && !Number.isNaN(date.getTime()) ? ` · ${date.toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })}` : ""}
      </span>
      <div role="group" aria-label={s.timeLapseSpeed} className="inline-flex overflow-hidden rounded-lg border border-line">
        {TIME_LAPSE_SPEEDS.map((sp) => (
          <button
            key={sp}
            type="button"
            aria-pressed={speed === sp}
            onClick={() => {
              setSpeed(sp);
              saveTimeLapseSpeed(sp);
            }}
            className={`cursor-pointer px-[0.6rem] py-[0.35rem] text-[0.75rem] font-semibold transition-[background-color] duration-[120ms] ${speed === sp ? "bg-accent-soft text-accent-ink" : "bg-surface text-ink hover:bg-surface-2"}`}
          >
            {s.timeLapseSpeeds[sp]}
          </button>
        ))}
      </div>
      <button type="button" className={btn} onClick={onExit}>
        {s.timeLapseExit}
      </button>
    </div>
  );
}

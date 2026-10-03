import type { MapKind, NodeType } from "../types";

// Shared look for the "Think it through" steps (pages/ThinkPage.tsx).
export const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color] duration-[120ms] enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-[0.6rem] text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]";

export const KIND_ICON: Record<MapKind, NodeType> = { problem: "Problem", decision: "Option", goal: "Success", retro: "unknown" };

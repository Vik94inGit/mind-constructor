import type { Sentiment } from "../utils/nodeType";

// A knight's great helm with a plume — the marker for a circle parent that
// hangs from another node (a "variant"), as opposed to the crown at the top of
// a tree. The T-shaped visor, the rivets and the plume are what make it read
// as a knight's helmet at a glance rather than a blob. Always some shade of
// blue (never the red/green the crown itself uses) — the surrounding chip/
// ring every caller already draws around this icon (NodeCard's own badge
// border, ZoneNames' colored label) already carries the positive/negative
// signal, so the icon's own colors are free to just be "a knight's helmet,"
// not a second copy of that signal.
//
// Still two-toned by sentiment, not one fixed color, per the person's own
// ask: a positive circle's helm is light blue with a dark-blue outline (the
// outline is what keeps it legible against a light --surface chip in light
// mode as well as a dark one in dark mode — a light fill alone gets lost
// against a light background with nothing else to draw its edge); a
// negative circle's helm is a plain solid dark blue fill (already high-
// contrast against both a light and a dark --surface on its own, no outline
// needed). "neutral" (a tied-vote or all-"unknown" circle — see
// utils/nodeType.ts's own Sentiment doc comment) reads as positive here:
// the light-fill-plus-outline treatment is the safer default of the two
// wherever a genuinely third look was never asked for.
const LIGHT_BLUE = "#7ec8e3";
const DARK_BLUE = "#1c4f73";

export function KnightHelmet({ size = 14, sentiment }: { size?: number; sentiment: Sentiment }) {
  const negative = sentiment === "negative";
  const fill = negative ? DARK_BLUE : LIGHT_BLUE;
  // Only the positive/neutral look gets an outline — see this file's own
  // top doc comment for why the negative fill doesn't need one.
  const outline = negative ? {} : { stroke: DARK_BLUE, strokeWidth: 1, strokeLinejoin: "round" as const };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="inline-block">
      {/* plume */}
      <path d="M12.5 5.2C12 2.6 14.6 0.9 18.6 2.2C16.6 2.9 15.7 4 15.4 5.6Z" fill={fill} {...outline} />
      {/* helm */}
      <path
        d="M4.6 12C4.6 8 7.6 5.2 12 5.2C16.4 5.2 19.4 8 19.4 12V19.2C19.4 20.3 18.6 21.2 17.5 21.2H6.5C5.4 21.2 4.6 20.3 4.6 19.2Z"
        fill={fill}
        {...outline}
      />
      {/* T-shaped visor */}
      <path d="M6.4 10.6H17.6V12.9H6.4Z M10.9 12.9H13.1V18.2H10.9Z" fill="var(--surface)" />
      {/* rivets */}
      <circle cx="7" cy="16.2" r="0.7" fill="var(--surface)" />
      <circle cx="17" cy="16.2" r="0.7" fill="var(--surface)" />
      <circle cx="7" cy="19" r="0.7" fill="var(--surface)" />
      <circle cx="17" cy="19" r="0.7" fill="var(--surface)" />
    </svg>
  );
}

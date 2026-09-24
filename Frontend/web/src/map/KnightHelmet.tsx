// A knight's great helm with a plume — the marker for a circle parent that
// hangs from another node (a "variant"), as opposed to the crown at the top of
// a tree. The T-shaped visor, the rivets and the plume are what make it read
// as a knight's helmet at a glance rather than a blob. Always blue (a
// steel-blue helm, a lighter-blue plume for depth) — no longer tinted via
// `currentColor`/the caller's `color` (that was sentiment red/green, same as
// the crown, but at this icon's actual render size — 14-17px in most
// callers — the old light-blue-plume-only accent was too small a sliver to
// read as "blue" at all next to the much bigger, still red/green helm body).
// The surrounding chip/ring every caller already draws around this icon
// (NodeCard's own badge border, ZoneNames' colored label) still carries the
// positive/negative sentiment signal, so nothing is lost by this icon no
// longer double-encoding it.
const HELM_COLOR = "#4f83b0";
const PLUME_COLOR = "#7ec8e3";

export function KnightHelmet({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="inline-block">
      {/* plume */}
      <path d="M12.5 5.2C12 2.6 14.6 0.9 18.6 2.2C16.6 2.9 15.7 4 15.4 5.6Z" fill={PLUME_COLOR} />
      {/* helm */}
      <path
        d="M4.6 12C4.6 8 7.6 5.2 12 5.2C16.4 5.2 19.4 8 19.4 12V19.2C19.4 20.3 18.6 21.2 17.5 21.2H6.5C5.4 21.2 4.6 20.3 4.6 19.2Z"
        fill={HELM_COLOR}
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

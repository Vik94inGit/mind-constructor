// A knight's great helm with a plume — the marker for a circle parent that
// hangs from another node (a "variant"), as opposed to the crown at the top of
// a tree. The T-shaped visor, the rivets and the plume are what make it read
// as a knight's helmet at a glance rather than a blob. Drawn in the current
// text color, so the caller tints it by setting `color`.
export function KnightHelmet({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="inline-block">
      {/* plume */}
      <path d="M12.5 5.2C12 2.6 14.6 0.9 18.6 2.2C16.6 2.9 15.7 4 15.4 5.6Z" fill="currentColor" />
      {/* helm */}
      <path
        d="M4.6 12C4.6 8 7.6 5.2 12 5.2C16.4 5.2 19.4 8 19.4 12V19.2C19.4 20.3 18.6 21.2 17.5 21.2H6.5C5.4 21.2 4.6 20.3 4.6 19.2Z"
        fill="currentColor"
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

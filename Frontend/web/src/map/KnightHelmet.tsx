// A knight's great helm — the marker for a circle parent that hangs from
// another node (a "variant"), as opposed to the crown at the top of a tree.
// Drawn in the current text color, so the caller tints it by setting `color`.
export function KnightHelmet({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="inline-block">
      <path
        d="M12 2C7.6 2 4.5 5.4 4.5 9.8V15.2C4.5 17.6 6.4 19.6 8.8 20.2L9.5 22H14.5L15.2 20.2C17.6 19.6 19.5 17.6 19.5 15.2V9.8C19.5 5.4 16.4 2 12 2Z"
        fill="currentColor"
      />
      <path d="M12 3.2V9" stroke="var(--surface)" strokeWidth="0.9" strokeOpacity="0.55" />
      <rect x="6.5" y="9" width="11" height="2.3" rx="1.1" fill="var(--surface)" />
      <circle cx="9" cy="14.2" r="0.75" fill="var(--surface)" />
      <circle cx="9" cy="16.9" r="0.75" fill="var(--surface)" />
      <circle cx="15" cy="14.2" r="0.75" fill="var(--surface)" />
      <circle cx="15" cy="16.9" r="0.75" fill="var(--surface)" />
    </svg>
  );
}

// A magnifying glass with a plus: "look at this picture closer".
export function ZoomGlass({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="6.8" cy="6.8" r="4.6" />
      <path d="M10.3 10.3 L14.2 14.2" />
      <path d="M6.8 4.7 V8.9 M4.7 6.8 H8.9" strokeWidth="1.5" />
    </svg>
  );
}

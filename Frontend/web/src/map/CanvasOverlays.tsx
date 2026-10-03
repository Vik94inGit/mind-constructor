// Small, purely visual layers drawn on the map canvas, in its own raw canvas
// coordinates (so they pan and scale with everything else on it).
import { CANVAS_W, CANVAS_H } from "../utils/canvasLayout";
import type { Marquee } from "../hooks/useMarqueeSelect";

type Pt = { x: number; y: number };

// The connection being dragged out of a puzzle piece's tab (see
// usePuzzleConnect): green over a piece it can link to, red over one it
// can't, the accent color over empty canvas.
export function PuzzleConnectLine({
  from,
  connect,
  zoom,
}: {
  from: Pt;
  connect: { to: Pt; overId: string | null; valid: boolean };
  zoom: number;
}) {
  const color = connect.overId ? (connect.valid ? "var(--success)" : "var(--danger)") : "var(--accent)";
  return (
    <svg className="pointer-events-none absolute inset-0 z-[40] h-full w-full" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
      <line
        x1={from.x}
        y1={from.y}
        x2={connect.to.x}
        y2={connect.to.y}
        stroke={color}
        strokeWidth={3 / zoom}
        strokeDasharray={`${8 / zoom} ${6 / zoom}`}
        strokeLinecap="round"
      />
      <circle cx={connect.to.x} cy={connect.to.y} r={6 / zoom} fill={color} />
    </svg>
  );
}

// Loading spinner on a zone that was just clicked — sits at the zone's
// middle, counter-scaled so it stays the same size on screen at any zoom.
export function ZoneLoadingSpinner({ x, y, zoom, label }: { x: number; y: number; zoom: number; label: string }) {
  return (
    <div
      className="pointer-events-none absolute z-[35]"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
      }}
      role="status"
      aria-label={label}
      title={label}
    >
      <div className="h-11 w-11 animate-spin rounded-full border-4 border-accent/25 border-t-accent bg-surface/90 shadow-card" />
    </div>
  );
}

// Rubber-band select rectangle — see useMarqueeSelect. A plain
// absolutely-positioned div (not another SVG layer) in the same raw canvas
// coordinates every NodeCard already uses, so it scales/pans along with the
// rest of the canvas via the canvas div's own transform, no separate math
// needed.
export function MarqueeRect({ marquee }: { marquee: Marquee }) {
  return (
    <div
      className="pointer-events-none absolute z-[20]"
      style={{
        left: Math.min(marquee.x0, marquee.x1),
        top: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
        border: "1.5px solid var(--accent)",
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
      }}
    />
  );
}

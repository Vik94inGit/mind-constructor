import { ringKindFor } from "./OutcomeBadge";
import type { NodeType } from "../types";

// Wings get their own color, independent of the type's own symbol color —
// angel wings are always dark blue, devil wings are always dark gray,
// regardless of which specific type they're on.
const WING_COLOR: Record<"angel" | "devil", string> = {
  angel: "#1e3a8a",
  devil: "#3f3f46",
};

// Simple, flat-shape wings — not a feather-by-feather illustration (too
// much detail to read at icon size), just enough silhouette to say
// "wings" at a glance. Angel wings are smooth curves; devil wings are
// angular, bat-membrane-like. Both paths assume a face centered at
// (200, 150), same as OutcomeBadge's own symbols — see WINGS_VIEWBOX
// below for how that lines up with a real node's 60px circle.
function AngelWings({ color }: { color: string }) {
  return (
    <g fill={color} fillOpacity="0.85">
      <path d="M 150,150.2 C 137.4,143.5 124,136.8 109.7,126.7 C 96.2,117.4 85.3,105.7 77.8,92.2 C 75.2,88 71.9,88.9 71.9,93.9 C 72.7,105.7 77.8,118.3 86.2,129.2 C 79.4,126.7 72.7,122.5 66.8,116.6 C 63.5,113.2 60.1,114.9 61.8,119.1 C 66.8,130.9 75.2,141 86.2,148.5 C 80.3,147.7 74.4,145.2 69.4,141.8 C 66,139.3 62.6,141.8 65.2,145.2 C 72.7,154.4 83.6,161.1 96.2,164.5 C 92,165.3 87.8,164.5 83.6,162.8 C 80.3,161.1 77.8,164.5 81.1,167 C 91.2,173.7 103.8,176.2 115.6,173.7 C 125.6,171.2 134.9,165.3 141.6,157.8 C 145,154.4 147.5,151.9 150,150.2 Z" />
      <path d="M 250,150.2 C 262.6,143.5 276,136.8 290.3,126.7 C 303.8,117.4 314.7,105.7 322.2,92.2 C 324.8,88 328.1,88.9 328.1,93.9 C 327.3,105.7 322.2,118.3 313.8,129.2 C 320.6,126.7 327.3,122.5 333.2,116.6 C 336.5,113.2 339.9,114.9 338.2,119.1 C 333.2,130.9 324.8,141 313.8,148.5 C 319.7,147.7 325.6,145.2 330.6,141.8 C 334,139.3 337.4,141.8 334.8,145.2 C 327.3,154.4 316.4,161.1 303.8,164.5 C 308,165.3 312.2,164.5 316.4,162.8 C 319.7,161.1 322.2,164.5 318.9,167 C 308.8,173.7 296.2,176.2 284.4,173.7 C 274.4,171.2 265.1,165.3 258.4,157.8 C 255,154.4 252.5,151.9 250,150.2 Z" />
    </g>
  );
}

function DevilWings({ color }: { color: string }) {
  return (
    <g fill={color} fillOpacity="0.85">
      <path d="M 150,150 L 75,90 Q 104.9,124.7 61,118 Q 100.5,140.7 59,148 Q 105.2,155.8 78,173 Q 105,164.4 150,150 Z" />
      <path d="M 250,150 L 325,90 Q 295.1,124.7 339,118 Q 299.5,140.7 341,148 Q 294.8,155.8 322,173 Q 295,164.4 250,150 Z" />
    </g>
  );
}

// Cropped to x:60-340 / y:88-212 — deliberately *symmetric* around
// (200, 150), the same face-center point OutcomeBadge's own symbols use
// (200-60 == 340-200 == 140; 150-88 == 212-150 == 62). That symmetry is
// exactly why this can just be centered on the 60px icon circle with a
// plain "center both axes" transform below, with no extra offset math to
// re-align (200, 150) against the circle's own center — the viewBox's own
// geometric center already *is* (200, 150).
const WINGS_VIEWBOX = "60 88 280 124";
const WINGS_ASPECT = 124 / 280;
// Scaled so the wings sit at the same size relative to a node's 48px icon
// circle that they used to when they shared OutcomeBadge's own canvas with
// a face of radius 54 there — i.e. this width : 48px circle diameter is
// the same ratio as this viewBox's own 280 units : a 108-unit (r=54) face
// diameter. (48, not the original 60, per the node icon's own -20% resize.)
const WINGS_WIDTH = 280 * (48 / 108);

// Flanks a node's own 48px icon circle from behind (a plain sibling,
// painted before the bordered circle in the DOM — see NodeCard — so the
// circle draws over the wings' own base without needing z-index for it).
// Pulled out of OutcomeBadge entirely rather than drawn inside its SVG:
// wings need to spread *past* the circle's own edge, which meant either
// giving OutcomeBadge's canvas a much bigger size than the circle it sits
// inside (clipped hard by that circle's own overflow-hidden — the actual
// bug behind "the symbol deforms when I select a node") or, the fix here,
// keeping OutcomeBadge always fixed-size and never touching it based on
// selection at all. `show` is the node's own `selected` state — wings are
// optional, on only for whichever node is currently chosen; `type` with
// no halo/horns classification (just "unknown") never gets wings, same as
// it never gets a crown.
export function NodeWings({ type, show }: { type: NodeType; show: boolean }) {
  if (!show) return null;
  const kind = ringKindFor(type);
  if (!kind) return null;
  const wingsKind = kind === "halo" ? "angel" : "devil";

  return (
    <svg
      width={WINGS_WIDTH}
      height={WINGS_WIDTH * WINGS_ASPECT}
      viewBox={WINGS_VIEWBOX}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {wingsKind === "angel" ? <AngelWings color={WING_COLOR.angel} /> : <DevilWings color={WING_COLOR.devil} />}
    </svg>
  );
}

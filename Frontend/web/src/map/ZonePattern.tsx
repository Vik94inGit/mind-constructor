import type { ZonePattern } from "../types";
import { ZONE_PATTERN_TILE } from "../utils/zoneStyle";

// One zone pattern (Node.zonePattern) as an SVG <pattern>, drawn in the zone's
// own colour and kept faint so the text on top stays readable. Put it in a
// <defs> and fill a shape with url(#id). `scale` shrinks the tile and
// `strength` darkens the marks for small previews (the picker's swatches).
export function ZonePatternDef({ id, pattern, color, scale = 1, strength = 1 }: { id: string; pattern: ZonePattern; color: string; scale?: number; strength?: number }) {
  const s = ZONE_PATTERN_TILE[pattern] * scale;
  const mark = { stroke: color, fill: "none", strokeOpacity: 0.35 * strength } as const;
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform={pattern === "stripes" ? "rotate(45)" : undefined}>
      {pattern === "dots" && <circle cx={s / 2} cy={s / 2} r={2.2 * scale} style={{ fill: color, fillOpacity: 0.4 * strength }} />}
      {pattern === "stripes" && <line x1={0} y1={0} x2={0} y2={s} style={{ ...mark, strokeWidth: 3 * scale }} />}
      {pattern === "grid" && <path d={`M ${s} 0 L 0 0 0 ${s}`} style={{ ...mark, strokeWidth: 1.5 * scale }} />}
      {pattern === "chess" && (
        <>
          <rect x={0} y={0} width={s / 2} height={s / 2} style={{ fill: color, fillOpacity: 0.16 * strength }} />
          <rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} style={{ fill: color, fillOpacity: 0.16 * strength }} />
        </>
      )}
    </pattern>
  );
}

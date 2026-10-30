import { memo } from "react";
import { CANVAS_H, CANVAS_W } from "../utils/canvasLayout";
import { pictureFills, pictureSegments } from "../utils/pictures";
import type { PictureGroup } from "../utils/pictures";
import { ZONE_PALETTE_HEX } from "../utils/zoneStyle";
import type { NodeDoc } from "../types";

interface Props {
  pictures: PictureGroup[];
  posFor: (node: NodeDoc) => { x: number; y: number };
}

// The pictures on the map ("Draw a picture", utils/pictures.ts), drawn under
// the nodes: a line between two dots is inked in the picture's colour once
// both are written in and stays a faint dotted guide until then, and a closed
// shape fills in a little more with every dot drawn. Lines follow the nodes'
// live spots, so moving a dot bends the drawing with it. The caption that says
// how much is there sits above the nodes (PictureCaptions.tsx).
export const PictureLayer = memo(function PictureLayer({ pictures, posFor }: Props) {
  if (pictures.length === 0) return null;
  return (
    <svg
      data-testid="picture-layer"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
    >
      {pictures.map((g) => {
        return (
          <g key={g.id} data-picture={g.kind} data-percent={g.percent}>
            {pictureFills(g).map((ns, i) => (
              <polygon
                key={`fill-${i}`}
                points={ns.map((n) => `${posFor(n).x},${posFor(n).y}`).join(" ")}
                fill={g.color ? ZONE_PALETTE_HEX[g.color] : g.def.color}
                // A picked colour is a muted background from the start, a
                // little stronger as the dots fill in; its own colour only
                // appears as the dots fill in.
                fillOpacity={(g.color ? 0.14 : 0.02) + 0.14 * (g.filled / g.total)}
                stroke="none"
              />
            ))}
            {pictureSegments(g).map((s) => {
              const a = posFor(s.from);
              const b = posFor(s.to);
              return s.drawn ? (
                <line
                  key={s.key}
                  data-drawn="true"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={g.def.color}
                  strokeWidth={7}
                  strokeOpacity={0.75}
                  strokeLinecap="round"
                />
              ) : (
                <line
                  key={s.key}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--color-ink-soft)"
                  strokeWidth={3}
                  strokeOpacity={0.35}
                  strokeDasharray="2 12"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});

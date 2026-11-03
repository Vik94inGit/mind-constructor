import { memo } from "react";
import { CANVAS_H, CANVAS_W } from "../utils/canvasLayout";
import { isDotDrawn, pictureFills, pictureSegments, pictureSpots } from "../utils/pictures";
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
// shape fills in a little more with every dot drawn.
//
// A picture drawn on its own (Node.picture.size, docs/gestures/picture-projection.md)
// is a small drawing with numbered dots, sized to be seen whole at 100%, and
// each card round it is joined to its dot by a thin line; moving a card
// leaves the drawing's shape alone. An older picture's lines follow its
// nodes' live spots, so moving a dot bends it. The caption that says how much
// is there sits above the nodes (PictureCaptions.tsx).
export const PictureLayer = memo(function PictureLayer({ pictures, posFor }: Props) {
  if (pictures.length === 0) return null;
  return (
    <svg
      data-testid="picture-layer"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
    >
      {pictures.map((g) => {
        const spots = pictureSpots(g, posFor);
        const at = (n: NodeDoc) => spots.get(n.picture?.dot ?? -1) ?? posFor(n);
        const own = !!g.size;
        return (
          <g key={g.id} data-picture={g.kind} data-percent={g.percent} data-own-drawing={own || undefined}>
            {own &&
              [...g.byDot.entries()].map(([dot, n]) => {
                const card = posFor(n);
                const spot = spots.get(dot)!;
                return (
                  <line
                    key={`leader-${dot}`}
                    data-leader={dot}
                    x1={card.x}
                    y1={card.y}
                    x2={spot.x}
                    y2={spot.y}
                    stroke={isDotDrawn(n) ? g.def.color : "var(--color-ink-soft)"}
                    strokeWidth={1.5}
                    strokeOpacity={isDotDrawn(n) ? 0.45 : 0.25}
                    strokeDasharray="4 6"
                  />
                );
              })}
            {pictureFills(g).map((ns, i) => (
              <polygon
                key={`fill-${i}`}
                points={ns.map((n) => `${at(n).x},${at(n).y}`).join(" ")}
                fill={g.color ? ZONE_PALETTE_HEX[g.color] : g.def.color}
                // A picked colour is a muted background from the start, a
                // little stronger as the dots fill in; its own colour only
                // appears as the dots fill in.
                fillOpacity={(g.color ? 0.14 : 0.02) + 0.14 * (g.filled / g.total)}
                stroke="none"
              />
            ))}
            {pictureSegments(g).map((s) => {
              const a = at(s.from);
              const b = at(s.to);
              return s.drawn ? (
                <line
                  key={s.key}
                  data-drawn="true"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={g.def.color}
                  strokeWidth={own ? 5 : 7}
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
                  strokeWidth={own ? 2.5 : 3}
                  strokeOpacity={0.35}
                  strokeDasharray={own ? "2 9" : "2 12"}
                  strokeLinecap="round"
                />
              );
            })}
            {own &&
              [...g.byDot.entries()].map(([dot, n]) => {
                const spot = spots.get(dot)!;
                const drawn = isDotDrawn(n);
                return (
                  <g key={`dot-${dot}`} data-dot={dot}>
                    <circle
                      cx={spot.x}
                      cy={spot.y}
                      r={11}
                      fill={drawn ? g.def.color : "var(--color-surface)"}
                      stroke={g.def.color}
                      strokeWidth={2}
                      strokeOpacity={drawn ? 1 : 0.6}
                    />
                    <text
                      x={spot.x}
                      y={spot.y}
                      dy="0.35em"
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={700}
                      fill={drawn ? "#fff" : g.def.color}
                    >
                      {dot + 1}
                    </text>
                  </g>
                );
              })}
          </g>
        );
      })}
    </svg>
  );
});

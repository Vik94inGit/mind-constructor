import { memo } from "react";
import { CANVAS_H, CANVAS_W } from "../utils/canvasLayout";
import { pictureFills, pictureSegments } from "../utils/pictures";
import type { PictureGroup } from "../utils/pictures";
import type { NodeDoc } from "../types";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  pictures: PictureGroup[];
  posFor: (node: NodeDoc) => { x: number; y: number };
}

// The pictures on the map ("Draw a picture", utils/pictures.ts), drawn under
// the nodes: a line between two dots is inked in the picture's colour once
// both are written in and stays a faint dotted guide until then, a closed
// shape fills in a little more with every dot drawn, and a caption under the
// picture says how much of it is there. Lines follow the nodes' live spots,
// so moving a dot bends the drawing with it.
export const PictureLayer = memo(function PictureLayer({ pictures, posFor }: Props) {
  const { t } = useI18n();
  if (pictures.length === 0) return null;
  return (
    <svg
      data-testid="picture-layer"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
    >
      {pictures.map((g) => {
        const name = t.ui.pictures.names[g.kind];
        const spots = [...g.byDot.values()].map(posFor);
        const bottom = Math.max(...spots.map((p) => p.y));
        const middle = (Math.min(...spots.map((p) => p.x)) + Math.max(...spots.map((p) => p.x))) / 2;
        const done = g.filled === g.total;
        return (
          <g key={g.id} data-picture={g.kind} data-percent={g.percent}>
            {pictureFills(g).map((ns, i) => (
              <polygon
                key={`fill-${i}`}
                points={ns.map((n) => `${posFor(n).x},${posFor(n).y}`).join(" ")}
                fill={g.def.color}
                fillOpacity={0.02 + 0.14 * (g.filled / g.total)}
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
            <text
              x={middle}
              y={bottom + 150}
              textAnchor="middle"
              fontSize={26}
              fontWeight={done ? 700 : 600}
              fill={done ? g.def.color : "var(--color-ink-soft)"}
            >
              {done ? t.ui.pictures.done(name) : t.ui.pictures.progress(name, g.percent)}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

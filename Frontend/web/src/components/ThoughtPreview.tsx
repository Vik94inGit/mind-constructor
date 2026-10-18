import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { ROOT_ID, orderParentsFirst } from "../utils/thoughtFlow";
import { shapeTree } from "../utils/shapeLayout";
import type { Thought } from "../utils/thoughtFlow";
import type { NodeType } from "../types";

const W = 320;
const H = 240;
// One step (node to child) at most this many pixels; less when the tree needs it to fit.
const STEP = 62;
const PAD = 16;

interface Placed {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  type: NodeType;
  text: string;
}

// The map's shape in miniature: the same geometry the real map is built from
// (shapeTree — the first ring round a circle, a square or a triangle, each
// deeper level a step further out), scaled evenly to fit the box, so what's
// built looks like what's drawn here.
function placeTree(center: string, rootType: NodeType, thoughts: Thought[]): Placed[] {
  const ordered = orderParentsFirst(thoughts);
  const shape = shapeTree(ordered, ROOT_ID);
  const cx = W / 2;
  const cy = H / 2;
  const out: Placed[] = [{ id: ROOT_ID, parentId: null, x: cx, y: cy, type: rootType, text: center }];
  // The farthest a node reaches from the center, either way, sets the scale.
  let reachX = 0;
  let reachY = 0;
  for (const p of shape.values()) {
    reachX = Math.max(reachX, Math.abs(p.x));
    reachY = Math.max(reachY, Math.abs(p.y));
  }
  const scale = Math.min(STEP, (W / 2 - PAD) / Math.max(reachX, 1e-6), (H / 2 - PAD) / Math.max(reachY, 1e-6));
  const ids = new Set(ordered.map((t) => t.id));
  for (const t of ordered) {
    const parentId = ids.has(t.parentId) ? t.parentId : ROOT_ID;
    const p = shape.get(t.id) ?? { x: 0, y: -1 };
    out.push({ id: t.id, parentId, x: cx + p.x * scale, y: cy + p.y * scale, type: t.type, text: t.text });
  }
  return out;
}

export function ThoughtPreview({
  center,
  rootType,
  thoughts,
  title,
}: {
  center: string;
  rootType: NodeType;
  thoughts: Thought[];
  title: string;
}) {
  const placed = placeTree(center, rootType, thoughts.filter((t) => t.text.trim()));
  const byId = new Map(placed.map((p) => [p.id, p]));
  return (
    <figure className="m-0 rounded-card border border-line bg-surface p-4 shadow-card">
      <figcaption className="mb-2 text-[0.72rem] font-semibold tracking-[0.04em] text-ink-soft uppercase">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto max-h-[180px] w-full lg:max-h-none" role="img" aria-label={title}>
        {placed.map((p) => {
          const parent = p.parentId ? byId.get(p.parentId) : null;
          if (!parent) return null;
          return (
            <line
              key={`l-${p.id}`}
              x1={parent.x}
              y1={parent.y}
              x2={p.x}
              y2={p.y}
              stroke="var(--line)"
              strokeWidth={1.5}
              style={{ transition: "all 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          );
        })}
        {placed.map((p) => {
          const isRoot = p.id === ROOT_ID;
          return (
            <g
              key={p.id}
              style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              <g className="animate-thought-pop">
                <title>{p.text}</title>
                {isRoot && <circle r={17} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={center.trim() ? 0.5 : 0.25} />}
                <circle
                  r={isRoot ? 12 : 7}
                  fill={NODE_TYPE_COLORS[p.type]}
                  opacity={isRoot && !center.trim() ? 0.35 : 1}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </g>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

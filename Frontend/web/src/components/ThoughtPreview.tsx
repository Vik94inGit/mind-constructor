import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { ROOT_ID, branchAngles, orderParentsFirst } from "../utils/thoughtFlow";
import type { Thought } from "../utils/thoughtFlow";
import type { NodeType } from "../types";

const W = 320;
const H = 240;
const RING = 62;

interface Placed {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  type: NodeType;
  text: string;
}

// A radial tree: each branch gets a slice of the circle sized by how many
// leaves it has (branchAngles), and every level sits one ring further out.
// The real map is laid out from the same angles (layoutThoughts), so what's
// built keeps this shape; only the distances differ, to fit the box.
function placeTree(center: string, rootType: NodeType, thoughts: Thought[]): Placed[] {
  const ordered = orderParentsFirst(thoughts);
  const angles = branchAngles(thoughts);
  const cx = W / 2;
  const cy = H / 2;
  const out: Placed[] = [{ id: ROOT_ID, parentId: null, x: cx, y: cy, type: rootType, text: center }];
  const maxDepth = Math.max(1, ...ordered.map((t) => depthOf(t, ordered)));
  // Squeeze the rings so the deepest level still fits inside the box.
  const ring = Math.min(RING, (Math.min(W, H) / 2 - 16) / maxDepth);
  const ids = new Set(ordered.map((t) => t.id));
  for (const t of ordered) {
    const parentId = ids.has(t.parentId) ? t.parentId : ROOT_ID;
    const angle = angles.get(t.id) ?? 0;
    const r = ring * depthOf(t, ordered);
    // Ellipse instead of a circle: the box is wider than it's tall.
    out.push({ id: t.id, parentId, x: cx + r * Math.cos(angle) * 1.25, y: cy + r * Math.sin(angle), type: t.type, text: t.text });
  }
  return out;
}

function depthOf(t: Thought, all: Thought[]): number {
  const byId = new Map(all.map((x) => [x.id, x]));
  let d = 1;
  let cur = byId.get(t.parentId);
  while (cur && d < 50) {
    d++;
    cur = byId.get(cur.parentId);
  }
  return d;
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

import { useI18n } from "../../i18n/I18nContext";
import type { NodeDoc } from "../../types";
import { isDotDrawn, pictureGroups, pictureSegments, type PictureGroup } from "../../utils/pictures";

// A dot of a "Draw a picture" (Node.picture) opens on its picture: the dots
// as they sit on the map with this one marked (PictureDotsMap, above the
// text), and the picture's other dots in a list under the text
// (PictureDotsList). Either one opens another dot's panel.

/** The picture this node is a dot of, or null for any other node. */
export function pictureGroupOf(node: NodeDoc, nodes: NodeDoc[]): PictureGroup | null {
  const id = node.picture?.id;
  if (!id) return null;
  return pictureGroups(nodes).find((g) => g.id === id) ?? null;
}

/** What a dot reads as in the list: its title, text, question, or its number. */
export function dotLabel(n: NodeDoc, dotName: (n: number) => string): string {
  return n.title || n.text || n.prompt || dotName((n.picture?.dot ?? 0) + 1);
}

const W = 240;
const H = 150;
const PAD = 14;

interface Props {
  group: PictureGroup;
  nodeId: string;
  onSelect: (nodeId: string) => void;
}

export function PictureDotsMap({ group, nodeId, onSelect }: Props) {
  const { t } = useI18n();
  const s = t.ui.pictures.panel;
  const dots = [...group.byDot.values()];
  const xs = dots.map((n) => n.x ?? 0);
  const ys = dots.map((n) => n.y ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(1, Math.max(...xs) - minX);
  const spanY = Math.max(1, Math.max(...ys) - minY);
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const at = (n: NodeDoc) => ({ x: offX + ((n.x ?? 0) - minX) * scale, y: offY + ((n.y ?? 0) - minY) * scale });
  const color = group.def.color;
  const name = t.ui.pictures.names[group.kind];
  return (
    <div data-testid="picture-dots-map" className="mb-2 rounded-lg border border-line bg-surface-2 p-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto max-h-[150px] w-full" role="img" aria-label={s.map(name)}>
        {pictureSegments(group).map((seg) => {
          const a = at(seg.from);
          const b = at(seg.to);
          return (
            <line
              key={seg.key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={seg.drawn ? 2.5 : 1.5}
              strokeOpacity={seg.drawn ? 0.9 : 0.4}
              strokeDasharray={seg.drawn ? undefined : "2 4"}
              strokeLinecap="round"
            />
          );
        })}
        {dots.map((n) => {
          const p = at(n);
          const here = n.nodeId === nodeId;
          const drawn = isDotDrawn(n);
          const label = dotLabel(n, s.dot);
          return (
            <g
              key={n.nodeId}
              role="button"
              tabIndex={here ? -1 : 0}
              aria-label={s.open(label)}
              aria-current={here || undefined}
              className={here ? "" : "cursor-pointer"}
              onClick={() => !here && onSelect(n.nodeId)}
              onKeyDown={(e) => {
                if (!here && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(n.nodeId);
                }
              }}
            >
              <title>{label}</title>
              {/* A wider, invisible target so a finger can hit a small dot. */}
              <circle cx={p.x} cy={p.y} r={11} fill="transparent" />
              {here && <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="var(--accent)" strokeWidth={2.5} />}
              <circle cx={p.x} cy={p.y} r={here ? 5.5 : 4.5} fill={drawn ? color : "var(--surface)"} stroke={color} strokeWidth={1.5} opacity={drawn || here ? 1 : 0.6} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PictureDotsList({ group, nodeId, onSelect }: Props) {
  const { t } = useI18n();
  const s = t.ui.pictures.panel;
  const rest = [...group.byDot.entries()].sort((a, b) => a[0] - b[0]).filter(([, n]) => n.nodeId !== nodeId);
  if (rest.length === 0) return null;
  return (
    <div data-testid="picture-dots-list" className="mt-3">
      <div className="mb-1 text-[0.75rem] font-semibold text-ink-soft">{s.rest}</div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {rest.map(([dot, n]) => {
          const drawn = isDotDrawn(n);
          const label = dotLabel(n, s.dot);
          return (
            <li key={n.nodeId}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-2 py-[0.3rem] text-left text-[0.8rem] hover:bg-surface-2"
                onClick={() => onSelect(n.nodeId)}
                aria-label={s.open(label)}
              >
                <span
                  aria-hidden
                  className="inline-block h-[10px] w-[10px] shrink-0 rounded-full border-[1.5px]"
                  style={{ borderColor: group.def.color, background: drawn ? group.def.color : "transparent" }}
                />
                <span className="shrink-0 text-ink-soft">{dot + 1}</span>
                <span className={`min-w-0 truncate ${drawn ? "text-ink" : "text-ink-soft italic"}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

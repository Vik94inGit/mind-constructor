import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext";
import { ringPoints } from "./menuRing";

export interface MenuGhost {
  id: string;
  label: string;
  icon: ReactNode;
  /** The ghost's border, in the colour of a node type, as on the map's ring. */
  color: string;
  onClick: () => void;
}

interface Props {
  ghosts: MenuGhost[];
  /** Which ghost (or "center") is picked out — its panel shows under the ring. */
  active: string | null;
  onCenter: () => void;
  /** Ring size on screen; the ghosts sit on a circle inside it. */
  size?: number;
}

const GHOST = 58;
const CENTER = 104;

// The dashboard's main menu, drawn the way a thought is on the map: one node
// in the middle ("What's on your mind?") with a ring of faded ghosts round it,
// one per thing to do (last stop, quick note, unsorted notes, new map…). The
// same look as the map's quick-add ring, so the user learns one shape. Each
// ghost's name is always shown here, unlike on the map: this is a menu read
// once, not a ring flicked through while building.
export function MenuNode({ ghosts, active, onCenter, size = 320 }: Props) {
  const { t } = useI18n();
  const r = t.dashboard.ring;
  const points = ringPoints(ghosts.length, size / 2 - GHOST / 2 - 14);
  return (
    <nav aria-label={r.label} className="relative mx-auto" style={{ width: size, height: size }} data-testid="menu-node">
      {/* The ring's own faint line, linking every ghost to the node. */}
      <svg className="pointer-events-none absolute inset-0" width={size} height={size} aria-hidden>
        {points.map((p, i) => (
          <line
            key={ghosts[i].id}
            x1={size / 2}
            y1={size / 2}
            x2={size / 2 + p.x}
            y2={size / 2 + p.y}
            stroke="var(--line)"
            strokeWidth={1.5}
            strokeDasharray="4 5"
          />
        ))}
      </svg>
      <button
        type="button"
        aria-pressed={active === "center"}
        className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-[3px] border-accent bg-[var(--node-fill)] p-3 text-center text-[0.86rem] leading-[1.2] font-bold text-ink shadow-card transition-transform duration-150 hover:scale-[1.04]"
        style={{ left: size / 2, top: size / 2, width: CENTER, height: CENTER }}
        onClick={onCenter}
      >
        {r.center}
      </button>
      {ghosts.map((g, i) => {
        const p = points[i];
        const on = active === g.id;
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={on}
            data-testid={`menu-ghost-${g.id}`}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 animate-ghost-in cursor-pointer flex-col items-center border-0 bg-transparent p-0 transition-[opacity,transform] duration-150 hover:scale-[1.08] hover:opacity-100 focus-visible:opacity-100 ${
              on ? "scale-[1.08] opacity-100" : "opacity-80"
            }`}
            style={{ left: size / 2 + p.x, top: size / 2 + p.y, animationDelay: `${i * 60}ms`, touchAction: "manipulation" }}
            onClick={g.onClick}
          >
            <span
              className={`flex items-center justify-center rounded-full border-2 bg-[var(--node-fill)] text-[1.35rem] leading-none shadow-card ${
                on ? "" : "animate-quick-add-pulse"
              }`}
              style={{ width: GHOST, height: GHOST, borderColor: g.color, borderStyle: on ? "solid" : "dashed" }}
              aria-hidden
            >
              {g.icon}
            </span>
            {/* Under the ghost, out of the flow so the circle stays centred on its point. */}
            <span className="pointer-events-none absolute top-full left-1/2 mt-1 w-[6.5rem] -translate-x-1/2 text-center text-[0.72rem] leading-[1.15] font-semibold text-ink">
              {g.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

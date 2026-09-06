import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";

const RADIUS = 100;
const EDGE_MARGIN = 40;

interface Props {
  anchorPos: { x: number; y: number };
  /** The currently-visible rectangle of the canvas, in canvas coordinates — keeps ghosts from fanning out past the edge of the screen. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  onPick: (type: NodeType, pos: { x: number; y: number }) => void;
}

// Half-visible "ghost" previews fanned out around the selected node, one per
// node type. Clicking a ghost creates a real node of that type at the ghost's
// spot and auto-links it to the anchor — branching an argument tree becomes a
// single click instead of toolbar button -> modal -> manual placement.
export function QuickAddGhosts({ anchorPos, bounds, onPick }: Props) {
  return (
    <>
      {NODE_TYPES.map((type, i) => {
        const angle = (i / NODE_TYPES.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.min(
          bounds.maxX - EDGE_MARGIN,
          Math.max(bounds.minX + EDGE_MARGIN, anchorPos.x + RADIUS * Math.cos(angle)),
        );
        const y = Math.min(
          bounds.maxY - EDGE_MARGIN,
          Math.max(bounds.minY + EDGE_MARGIN, anchorPos.y + RADIUS * Math.sin(angle)),
        );
        return (
          <button
            key={type}
            type="button"
            // z-[33]: above MapPage's full-screen NodePanel backdrop
            // (z-30) — that backdrop dims the canvas and closes the panel
            // on any outside tap, and without outranking it here every tap
            // on a ghost landed on the backdrop instead, just closing the
            // panel (and the ghost ring with it) rather than picking a
            // type. See NodeCard's own zIndexClass for the rest of this
            // scheme (nodes at z-31/32, the pending-create card at z-33 too).
            className="absolute z-[33] flex h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-dashed border-accent bg-surface p-0 opacity-75 shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)] transition-[opacity,transform,border-color,border-style,box-shadow] duration-[150ms] ease-[ease] animate-quick-add-pulse hover:animate-none hover:translate-x-[-50%] hover:translate-y-[-50%] hover:scale-[1.15] hover:opacity-100 hover:border-solid hover:shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_30%,transparent)] focus-visible:animate-none focus-visible:translate-x-[-50%] focus-visible:translate-y-[-50%] focus-visible:scale-[1.15] focus-visible:opacity-100 focus-visible:border-solid focus-visible:shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
            style={{ left: x, top: y }}
            title={`Add ${type} node`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(type, { x, y });
            }}
          >
            {/* Same icon a node of this type will actually render with once
                created (see OutcomeBadge/ringKindFor) — "unknown" has no
                outcome framing, so it alone keeps the plain glyph. */}
            {ringKindFor(type) ? (
              <OutcomeBadge type={type as OutcomeType} size={30} />
            ) : (
              <NodeTypeIcon type={type} size={16} />
            )}
          </button>
        );
      })}
    </>
  );
}

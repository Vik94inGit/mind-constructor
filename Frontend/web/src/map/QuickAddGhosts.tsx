import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";
import { NodeCrown } from "./NodeCrown";

// Same 60px reference circle NodeCard's own icon uses (NodeCrown assumes
// it) — a ghost is a preview of what the real node is about to look like,
// so it borrows that circle wholesale: type-colored border, halo/horns
// crown, the same symbol/icon size — then GHOST_SCALE shrinks the whole
// thing back down again as one unit (a CSS transform, not smaller
// individual numbers), so the crown/border/symbol stay in exactly the
// proportions already tuned for the 60px version instead of needing
// separately-tuned small-size numbers that could drift out of sync with
// NodeCard's own version over time. Only the pulsing dashed-glow (see the
// className below) and the reduced opacity are ghost-specific beyond
// that, marking it as "not real yet."
const ICON_SIZE = 48;
const GHOST_SCALE = 0.65;
const RADIUS = 64;
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
  // The anchor itself used to be the ring's center, with each of the 7
  // points *independently* clamped into bounds afterward — fine when the
  // anchor sits well clear of every edge, but a node close enough to one
  // (a phone's own narrow/short visible strip makes "close enough" the
  // common case, not a rare one, and centerOnNode can only scroll a node
  // so close to the actual edge of the whole 2400x1600 canvas to begin
  // with — there's nothing further to scroll into) clamped every point
  // that would've landed past that edge to the *same* boundary value,
  // collapsing several ghosts on top of each other into a squashed line
  // instead of a ring. Centering the ring itself on a point nudged just
  // far enough inside `bounds` to fit the whole undistorted circle (rather
  // than clamping each point after the fact) keeps every ghost evenly
  // spaced and fully clickable regardless of where the node landed — it
  // just may not sit perfectly centered on the node itself in that case,
  // which is the unavoidable tradeoff once the node is right at the edge
  // of the map with nothing beyond it to make room from.
  const halfSpan = RADIUS + EDGE_MARGIN;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  // A viewport narrower/shorter than the ring itself (a tiny window, or a
  // zoomed-way-out canvas) has no safe zone to clamp into at all — center
  // the ring on bounds' own midpoint rather than letting min > max invert
  // the clamp below.
  const ringCenter =
    spanX >= halfSpan * 2 && spanY >= halfSpan * 2
      ? {
          x: Math.min(bounds.maxX - halfSpan, Math.max(bounds.minX + halfSpan, anchorPos.x)),
          y: Math.min(bounds.maxY - halfSpan, Math.max(bounds.minY + halfSpan, anchorPos.y)),
        }
      : { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  return (
    <>
      {NODE_TYPES.map((type, i) => {
        const angle = (i / NODE_TYPES.length) * Math.PI * 2 - Math.PI / 2;
        const x = ringCenter.x + RADIUS * Math.cos(angle);
        const y = ringCenter.y + RADIUS * Math.sin(angle);
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
            className="absolute z-[33] flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center border-0 bg-transparent p-0 opacity-75 transition-[opacity,transform] duration-[150ms] ease-[ease] hover:translate-x-[-50%] hover:translate-y-[-50%] hover:scale-[1.1] hover:opacity-100 focus-visible:translate-x-[-50%] focus-visible:translate-y-[-50%] focus-visible:scale-[1.1] focus-visible:opacity-100"
            style={{ left: x, top: y }}
            title={`Add ${type} node`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(type, { x, y });
            }}
          >
            <div
              className="relative"
              style={{ height: ICON_SIZE, width: ICON_SIZE, transform: `scale(${GHOST_SCALE})` }}
            >
              {/* Same halo/horns crown a real node of this type gets — see
                  NodeCrown's own doc comment. */}
              <NodeCrown type={type} />
              <div
                className="flex h-full w-full animate-quick-add-pulse items-center justify-center rounded-full border-2 bg-surface shadow-card"
                style={{ borderColor: NODE_TYPE_COLORS[type] }}
              >
                {/* Same icon a node of this type will actually render with
                    once created (see OutcomeBadge/ringKindFor) —
                    "unknown" has no outcome framing, so it alone keeps
                    the plain glyph. */}
                {ringKindFor(type) ? (
                  <OutcomeBadge type={type as OutcomeType} size={26} />
                ) : (
                  <NodeTypeIcon type={type} size={21} />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}

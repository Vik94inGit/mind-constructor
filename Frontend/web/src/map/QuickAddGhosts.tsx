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
// Smaller on mobile — not just a nicety, a real geometry fix. The ring's
// own safe-zone recentering below can always keep every ghost on-screen
// and non-overlapping, but *how far* it has to nudge the ring away from
// the node scales with RADIUS+EDGE_MARGIN, and mobile's visible strip
// above the bottom sheet is short (only ~1/3 of the screen — see
// panelReserveFrac in MapPage.tsx). At the old, flat 64+40, a node
// anywhere in the lower half of that already-short strip forced the ring
// so far upward to fit that all 7 ghosts ended up bunched into an arc
// above the node instead of surrounding it — exactly the "curvy row"
// this was reported as. Shrinking the ring itself for mobile means it
// usually fits right where the node already is, needing little or no
// recentering at all; icon size is left alone (unlike RADIUS) so the
// actual tap targets don't shrink, just how far apart their centers sit —
// still comfortably clear of each other at this radius.
const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 640;
const RADIUS = isMobileViewport ? 48 : 64;
const EDGE_MARGIN = isMobileViewport ? 24 : 40;

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
  // A viewport narrower/shorter than the ring itself has no safe zone to
  // clamp into at all without inverting the min/max clamp below — on
  // mobile this isn't the rare "zoomed-way-out canvas" case it sounds
  // like, it's the *routine* one: the bottom sheet's own 2/3-of-the-screen
  // reserve (panelReserveFrac in MapPage.tsx) plus this function's own pad
  // leaves less vertical room than halfSpan*2 on a typical phone, so
  // spanY fails this check for essentially every mobile selection, not
  // just ones near a canvas edge. Falling back to bounds' own plain
  // midpoint here (as this used to) is harmless *most* of the time only
  // because centerOnNode usually already parks the anchor there too — but
  // the one time anchorPos and the bounds midpoint actually diverge is
  // exactly the case this whole file exists for: a node close enough to
  // the real edge of the 2400x1600 canvas that centerOnNode couldn't pan
  // it all the way to center. In that case the bounds-midpoint fallback
  // used to strand the ring floating in the middle of the screen while
  // the node itself sat pinned against the edge, sometimes 100+px away —
  // "ghosts not centered around it" near a border, not a squashed ring.
  // Anchoring the fallback on anchorPos instead (still clamped into
  // `bounds`, just without the extra halfSpan inset) keeps the ring
  // visibly attached to its node even when it can't fully fit — a ring
  // that's a little clipped but clearly belongs to the node it's around
  // reads far better than one that's fully on-screen but detached from it.
  const ringCenter =
    spanX >= halfSpan * 2 && spanY >= halfSpan * 2
      ? {
          x: Math.min(bounds.maxX - halfSpan, Math.max(bounds.minX + halfSpan, anchorPos.x)),
          y: Math.min(bounds.maxY - halfSpan, Math.max(bounds.minY + halfSpan, anchorPos.y)),
        }
      : {
          x: Math.min(bounds.maxX, Math.max(bounds.minX, anchorPos.x)),
          y: Math.min(bounds.maxY, Math.max(bounds.minY, anchorPos.y)),
        };
  return (
    <>
      {NODE_TYPES.map((type, i) => {
        const angle = (i / NODE_TYPES.length) * Math.PI * 2 - Math.PI / 2;
        // Final per-point safety clamp into the raw bounds (not the
        // halfSpan-inset safe zone — that's already baked into ringCenter
        // on the branch where it applies). A no-op whenever the full ring
        // already fit — ringCenter was inset by halfSpan there, so every
        // point already lands inside `bounds` on its own. It only ever
        // moves a point on the fallback branch above (ringCenter.own doc
        // comment), where the ring is anchored on the node but may still
        // be too big to fully fit — this keeps that ring's outermost
        // points reachable/visible instead of scrolled off, at the cost of
        // occasionally bunching a couple of them toward the same edge in
        // that already-cramped case.
        const x = Math.min(bounds.maxX, Math.max(bounds.minX, ringCenter.x + RADIUS * Math.cos(angle)));
        const y = Math.min(bounds.maxY, Math.max(bounds.minY, ringCenter.y + RADIUS * Math.sin(angle)));
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

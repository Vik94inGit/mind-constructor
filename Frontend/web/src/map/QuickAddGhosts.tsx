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
// Bumped up from 0.65 — a ghost used to read as a noticeably smaller,
// harder-to-tap preview than the real node it's standing in for; bigger
// makes it easier to see and tap, and to actually recognize which type's
// icon it's previewing at a glance.
const GHOST_SCALE = 0.85;
// Smaller on mobile — not just a nicety, a real geometry fix. The ring's
// own safe-zone recentering below can always keep every ghost on-screen
// and non-overlapping, but *how far* it has to nudge the ring away from
// the node scales with RADIUS+EDGE_MARGIN, and mobile's visible strip
// above the bottom sheet is short (only ~1/3 of the screen — see
// panelReserveFrac in MapPage.tsx). At too big a radius, a node anywhere
// in the lower half of that already-short strip forces the ring so far
// upward to fit that all 7 ghosts end up bunched into an arc above the
// node instead of surrounding it — the "curvy row" this was reported as
// once already.
//
// The floor both numbers have to clear now: NodeWings (only drawn on this
// same selected node — see NodeCard) spreads a full ~124px wide, ~62px on
// each side of the node's own center, wider than the bare 48px icon this
// ring used to be sized against. A radius that only cleared the icon left
// the two side-ish ghosts landing right on top of the wingtips — the
// node reading as "half covered by its own ghosts" the instant it was
// selected, wings and all. RADIUS here has to clear that 62px wing
// half-width *plus* a ghost's own half-width (ICON_SIZE*GHOST_SCALE/2 —
// 20.4px at the scale above) with real margin to spare, on both mobile
// and desktop — wings don't shrink for mobile, so neither can this floor.
// Bumped up again from 88/106 — more breathing room between the node
// (crown/wings included) and the ring than the bare wing-clearance floor
// strictly requires, so the ring reads as clearly its own thing around the
// node rather than crowding right up against it.
const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 640;
const RADIUS = isMobileViewport ? 104 : 126;
const EDGE_MARGIN = isMobileViewport ? 38 : 58;

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
  // instead of a ring.
  //
  // ringCenter itself stays dead simple — just the anchor, clamped into
  // bounds — because the actual "does it fit" question is answered below by
  // rx/ry instead. An earlier version (a fixed halfSpan inset) pushed the
  // whole ring away from the node whenever it didn't fully fit; a plain
  // circular radius with a final per-point clamp did worse — clamping each
  // point independently flattened the cramped axis into a near-straight
  // line, several ghosts landing at the exact same clamped coordinate
  // instead of a curve.
  const ringCenter = {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, anchorPos.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, anchorPos.y)),
  };
  // Elliptical, not circular: rx/ry each shrink independently to whatever
  // room `bounds` actually has on their own axis (down to their own floor),
  // rather than sharing one radius that has to fit the *tightest* of all
  // four directions. A shorter/narrower ring that's still a smooth curve on
  // a cramped mobile screen reads as a real (if squashed) circle — one
  // whose tight axis got clamped point-by-point instead just reads as flat.
  //
  // The two floors aren't the same number on purpose. MIN_RX can't drop
  // below what NodeWings needs (see RADIUS's own doc comment — ~62px wing
  // half-width + a ghost's own ~20px half-width): the two side ghosts sit
  // at y = ringCenter.y exactly regardless of ry, so *only* rx protects
  // them from the wingtips, and horizontal room is rarely this tight in
  // practice anyway (a phone is narrow, not this narrow). MIN_RY only ever
  // has to clear the node's much shorter crown (NodeCrown's halo/horns,
  // ~16px tall) plus a ghost's own radius on the way up, and the node's own
  // icon/badges on the way down — both comfortably smaller than the wings.
  //
  // Both floors are still hard-capped at the *raw* distance to their own
  // edge of `bounds` (availX/availY below, no EDGE_MARGIN subtracted) — not
  // just floored, capped. A floor alone can't just be "big enough to look
  // round": pin it at a fixed value and the one time real available room
  // comes in under that (a genuinely short mobile strip), rx/ry themselves
  // end up *past* `bounds`, right back to the final per-point clamp
  // flattening several points onto the same edge value — the exact bug
  // this rewrite exists to avoid. Capping at the raw distance first means
  // the floor can stay ambitious (round whenever there's room) while this
  // axis's own Math.min below always still lands inside `bounds` on its
  // own, no clamp ever needed.
  const MIN_RX = 83;
  const MIN_RY = 60;
  const availLeft = ringCenter.x - bounds.minX;
  const availRight = bounds.maxX - ringCenter.x;
  // + UP_SLACK: `bounds`' own pad (baked in by MapPage's viewportBounds/
  // settledViewportBounds) is a generic safety margin shared with every
  // other placement purpose on the canvas — sized generously enough that
  // giving a little of it back is a far better trade, just for how close
  // *this* ring's topmost point is allowed to get to that edge, than
  // letting it overlap the node's own crown (NodeCrown's halo/horns,
  // which sits close enough above center — see RADIUS's own doc comment —
  // that the plain pad-limited availUp was cutting it a few px too close
  // on a short mobile screen: the ring's whole point is to surround the
  // node, not cover part of it). Only the *up* direction gets this — down/
  // left/right have no comparable "own decoration" to clear, and staying
  // capped there is what keeps the final per-point clamp from ever having
  // to flatten multiple points at once (see MIN_RX/MIN_RY's own doc
  // comment) — a single topmost point occasionally landing right at this
  // still-padded edge in a genuinely tiny viewport is a much smaller
  // artifact than that.
  const UP_SLACK = 12;
  const availUp = ringCenter.y - bounds.minY + UP_SLACK;
  const availDown = bounds.maxY - ringCenter.y;
  const rx = Math.min(RADIUS, availLeft, availRight, Math.max(MIN_RX, Math.min(availLeft, availRight) - EDGE_MARGIN));
  // Separate radii for the upper and lower half of the ring — not one
  // shared ry sized off whichever of availUp/availDown is smaller. That
  // was silently undoing UP_SLACK above whenever the *bottom* happened to
  // be the tighter side (routine on mobile — the panel reserve eats space
  // below the node too, often by a similar amount): ry would still clamp
  // to the smaller of the two, so the topmost points never actually got
  // the extra room UP_SLACK was meant to give them.
  const ryUp = Math.min(RADIUS, availUp, Math.max(MIN_RY, availUp - EDGE_MARGIN));
  const ryDown = Math.min(RADIUS, availDown, Math.max(MIN_RY, availDown - EDGE_MARGIN));
  return (
    <>
      {NODE_TYPES.map((type, i) => {
        // Back to a full 360° ring — the node's own caption is hidden
        // outright while it's selected now (see NodeCard), which was the
        // actual thing a half-circle was working around (ghosts overlapping
        // that text below it). With nothing there to overlap, there's no
        // reason left to give up the bottom half of the ring.
        const angle = (i / NODE_TYPES.length) * Math.PI * 2 - Math.PI / 2;
        // rx/ryUp/ryDown (not RADIUS) — see their own doc comment: already
        // sized to fit `bounds`, so this is normally a no-op. Kept as a
        // final safety net for the one case they can't fully cover
        // themselves — bounds narrower than even MIN_RX/MIN_RY (a
        // genuinely tiny viewport, not a real phone) — so a point still
        // can't render off-screen.
        const sinA = Math.sin(angle);
        // bounds.minY - UP_SLACK, not bare bounds.minY: has to match
        // availUp's own +UP_SLACK above, or this would just clamp the
        // topmost points straight back down to bare bounds.minY and undo
        // that slack for exactly the points it was meant to help. Only
        // applied above center (sinA < 0) — ryDown/the bottom half never
        // reads UP_SLACK at all.
        const x = Math.min(bounds.maxX, Math.max(bounds.minX, ringCenter.x + rx * Math.cos(angle)));
        const y = Math.min(
          bounds.maxY,
          Math.max(bounds.minY - (sinA < 0 ? UP_SLACK : 0), ringCenter.y + (sinA < 0 ? ryUp : ryDown) * sinA),
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

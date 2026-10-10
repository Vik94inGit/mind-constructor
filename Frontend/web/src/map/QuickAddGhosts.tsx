import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { isMobileViewport } from "../utils/canvasLayout";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";
import { NodeCrown } from "./NodeCrown";
import { useI18n } from "../i18n/I18nContext";

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
// 0.85, not smaller — a smaller scale reads as a noticeably smaller,
// harder-to-tap preview than the real node it's standing in for; this size
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
// each side of the node's own center, wider than the bare 48px icon alone.
// A radius that only cleared the icon would leave the two side-ish ghosts
// landing right on top of the wingtips — the node reading as "half covered
// by its own ghosts" the instant it was
// selected, wings and all. RADIUS here has to clear that 62px wing
// half-width *plus* a ghost's own half-width (ICON_SIZE*GHOST_SCALE/2 —
// 20.4px at the scale above) with real margin to spare, on both mobile
// and desktop — wings don't shrink for mobile, so neither can this floor.
// Bumped up again from 88/106 — more breathing room between the node
// (crown/wings included) and the ring than the bare wing-clearance floor
// strictly requires, so the ring reads as clearly its own thing around the
// node rather than crowding right up against it.
//
// RADIUS/EDGE_MARGIN themselves are computed inside the component body (see
// below), not here at module scope — a module-level `window.innerWidth`
// read is only ever evaluated once, at first import, so it never picks up a
// resize or rotation after the page first loads. isMobileViewport() (shared
// with getNodeMinDist/MapPage/NodePanel — see utils/canvasLayout.ts) is a
// plain function precisely so every call site can read it live instead.

interface Props {
  anchorPos: { x: number; y: number };
  /** The currently-visible rectangle of the canvas, in canvas coordinates — keeps ghosts from fanning out past the edge of the screen. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** `text` is set when a ghost template (a starter phrase) was clicked rather than the ghost itself; `emoji` when one was picked from the emoji ring first (see emojiFirst). */
  onPick: (type: NodeType, pos: { x: number; y: number }, text?: string, emoji?: string) => void;
  /** The viewer's "emoji first" mode (utils/emojiFace.ts): a ring of feeling emoji comes first, the types after. */
  emojiFirst?: boolean;
  /** Only the emoji ring, for a node already being made (MapPage's pending node): a pick goes here, and onPick is never called. */
  onPickEmoji?: (emoji: string) => void;
  /** An empty map's hint: the ghosts draw in one at a time — icon, then its name — instead of all being there at once. */
  intro?: boolean;
  /** The simplified view: no halo/horns on the ghosts. */
  compact?: boolean;
  /** The canvas zoom: the ghosts are drawn inside the zoomed canvas, so they shrink by it to stay one size on screen, as the nodes do. */
  zoom?: number;
}

// One step of the ghosts' sequence. In the intro each ghost takes two steps
// (icon, then its name); afterwards, and whenever a node is chosen, every
// icon is up and the name moves from one ghost to the next, one per step.
const STEP_MS = 1000;
// See stageAt below.
const STAGE_GUARD_MS = 350;
// The emoji ghosts' circle, on screen — a little smaller than a type ghost (48 × 0.85).
const EMOJI_GHOST_SIZE = 38;
/** The feelings the emoji ring offers, in ring order — names in t.ui.emoji.feelings, same order. */
export const FEELING_EMOJIS = ["😊", "🤩", "😌", "🤔", "😕", "😟", "😢", "😡"];

// Half-visible "ghost" previews fanned out around the selected node, one per
// node type. Clicking a ghost names its type and fans out a few ghost
// templates — starter phrases for that type — on the ring's outer side;
// clicking one opens the new node with that phrase, clicking the ghost again
// opens it blank. Either way it lands at the ghost's spot, linked to the
// anchor — branching an argument tree becomes two clicks instead of toolbar
// button -> modal -> manual placement.
export const QuickAddGhosts = memo(function QuickAddGhosts({
  anchorPos,
  bounds,
  onPick,
  intro = false,
  compact = false,
  zoom = 1,
  emojiFirst = false,
  onPickEmoji,
}: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), STEP_MS);
    return () => clearInterval(id);
  }, []);
  const count = NODE_TYPES.length;
  const introSteps = intro ? count * 2 : 0;
  const shownCount = step < introSteps ? Math.floor(step / 2) + 1 : count;
  // Which ghost's name is showing right now, -1 for none.
  const labelIndex =
    step < introSteps ? (step % 2 === 1 ? Math.floor(step / 2) : -1) : (step - introSteps) % count;
  // Which ghost a click has picked out — its type name shows only once
  // picked. The first click only tells you which type this is (a one-tap
  // create was easy to trigger by accident on a phone and impossible to
  // preview); a second click on that same ghost creates it.
  const [armed, setArmed] = useState<{ type: NodeType; x: number; y: number; angle: number } | null>(null);
  const armedType = armed?.type ?? null;
  // The emoji ring: before the types in emoji-first mode, or on its own
  // around a node already being made (onPickEmoji). The skip ghost picks "no
  // emoji".
  const [stage, setStage] = useState<"type" | "emoji">(onPickEmoji || emojiFirst ? "emoji" : "type");
  const [picked, setPicked] = useState<{ emoji: string } | null>(null);
  // A quick double tap on the last ghost of one round mustn't land on the
  // ghost that has just appeared in the same spot in the next.
  const stageAt = useRef(0);
  function pickType(type: NodeType, pos: { x: number; y: number }, text?: string) {
    onPick(type, pos, text, picked?.emoji || undefined);
  }
  function pickEmoji(emoji: string) {
    if (Date.now() - stageAt.current < STAGE_GUARD_MS) return;
    if (onPickEmoji) return onPickEmoji(emoji);
    setPicked({ emoji });
    setStage("type");
    stageAt.current = Date.now();
  }
  const pickedEmoji = picked?.emoji ?? "";
  // Read live, every render — see the doc comment above RADIUS/EDGE_MARGIN's
  // old module-level home for why this can't be hoisted back out to module
  // scope.
  const mobile = isMobileViewport();
  // Everything below is in canvas units, so on-screen sizes are divided by zoom.
  const k = 1 / zoom;
  const RADIUS = (mobile ? 104 : 126) * k;
  const EDGE_MARGIN = (mobile ? 38 : 58) * k;
  // The ring is always centered on the chosen node itself — it's tied to
  // that node, never slid away from it to fit the screen. centerOnNode parks
  // the node in the middle of the part of the screen the panel leaves clear,
  // so a full ring fits around it; on a cramped screen the radius shrinks
  // (down to MIN_RADIUS) rather than the ring moving or flattening.
  const ringCenter = anchorPos;
  // One shared radius — a genuine circle, not an ellipse. A previous
  // version here let rx/ry shrink independently on their own axis (use
  // whatever room each direction actually has), reasoning that a shorter,
  // still-round-looking curve beats a full circle clamped flat on its tight
  // axis. In practice it read badly the one time it actually mattered: the
  // bottom sheet reserves a big chunk of screen height (see
  // panelReserveFrac — 1/2 on mobile, was 2/3), so vertical room is
  // routinely much tighter than horizontal. rx stayed close to its own
  // floor while ry got
  // squeezed far below it, stretching the "ring" into a flat, wide oval
  // that read as a row of ghosts, not a circle. A single radius, capped by
  // whichever of the four directions has the least room, can't do that —
  // it comes out smaller on a cramped screen, but it's always round.
  //
  // MIN_RADIUS matches the old MIN_RX, not MIN_RY: with one shared radius,
  // the same number places the left/right ghosts too (at y = ringCenter.y
  // exactly), so it still has to clear NodeWings' ~62px half-width + a
  // ghost's own ~20px half-width (see RADIUS's own doc comment) — the more
  // restrictive of the two old floors, now the only one. And it's a *real*
  // floor, not just floored-then-capped-at-the-raw-distance advice the way
  // the old rx/ry were: R never drops below it, even when the raw room
  // available is smaller still. That raw-distance cap sounded safe (never
  // exceed `bounds`) but had its own failure mode, worse than the
  // flattened-row bug it replaced — on a short screen with a tall panel
  // open, the tightest available direction could come in at just a few px,
  // pulling R down toward zero and collapsing every ghost onto nearly the
  // same point instead of a ring at all. A little deliberate overflow past
  // `bounds` (handled by the final per-point clamp below, same as ever)
  // reads far better than that: a few extreme points sit right at the edge
  // instead of every point bunching together in the middle.
  // Raised from 83: a circle parent draws at 130%, so its wings reach ~80px
  // out — at 83 the side ghosts (a ghost's own half-width is ~20px) sat right
  // on the wingtips whenever a cramped viewport forced R down to this floor.
  const MIN_RADIUS = 100 * k;
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
  // left/right have no comparable "own decoration" to clear.
  const UP_SLACK = 12 * k;
  const availUp = ringCenter.y - bounds.minY + UP_SLACK;
  const availDown = bounds.maxY - ringCenter.y;
  const tightest = Math.min(availLeft, availRight, availUp, availDown);
  const R = Math.min(RADIUS, Math.max(MIN_RADIUS, tightest - EDGE_MARGIN));
  if (stage === "emoji") {
    const n = FEELING_EMOJIS.length + 1;
    const borderColor = "var(--line)";
    return (
      <>
        <div
          className="pointer-events-none absolute z-[33] -translate-x-1/2 -translate-y-full rounded-[3px] bg-surface px-[0.4rem] py-[0.1rem] text-[0.68rem] font-semibold whitespace-nowrap text-ink shadow-card"
          style={{ left: ringCenter.x, top: ringCenter.y - R - 34 * k, transform: `scale(${k})`, transformOrigin: "50% 100%" }}
        >
          {t.ui.emoji.ringPrompt}
        </div>
        {[...FEELING_EMOJIS, ""].map((emoji, i) => {
          const angle = (-i / n) * Math.PI * 2 - Math.PI / 2;
          const x = ringCenter.x + R * Math.cos(angle);
          const y = ringCenter.y + R * Math.sin(angle);
          const name = emoji ? t.ui.emoji.feelings[i] : t.ui.emoji.skip;
          return (
            <button
              key={emoji || "skip"}
              type="button"
              className="absolute z-[33] flex -translate-x-1/2 -translate-y-1/2 cursor-pointer animate-ghost-in flex-col items-center border-0 bg-transparent p-0 opacity-85 transition-[opacity,transform] duration-[150ms] ease-[ease] hover:translate-x-[-50%] hover:translate-y-[-50%] hover:scale-[1.12] hover:opacity-100 focus-visible:scale-[1.12] focus-visible:opacity-100"
              style={{ left: x, top: y, touchAction: "manipulation", animationDelay: `${i * 40}ms` }}
              title={name}
              aria-label={name}
              data-testid="emoji-ghost"
              onClick={(e) => {
                e.stopPropagation();
                pickEmoji(emoji);
              }}
            >
              <div
                className={`flex items-center justify-center rounded-full border-2 bg-[var(--node-fill)] shadow-card ${emoji ? "animate-quick-add-pulse" : "border-dashed"}`}
                style={{ height: EMOJI_GHOST_SIZE * k, width: EMOJI_GHOST_SIZE * k, borderColor }}
              >
                <span aria-hidden className="leading-none" style={{ fontSize: (emoji ? 22 : 14) * k }}>
                  {emoji || "✕"}
                </span>
              </div>
              <div
                className={`pointer-events-none absolute left-1/2 top-full -translate-x-1/2 rounded-[3px] bg-surface px-[0.3rem] py-[0.1rem] text-[0.62rem] leading-[1.2] font-semibold whitespace-nowrap text-ink shadow-card transition-opacity duration-500 ${
                  step % n === i ? "opacity-100" : "opacity-0"
                }`}
                style={{ marginTop: 4 * k, transform: `scale(${k})`, transformOrigin: "50% 0" }}
              >
                {name}
              </div>
            </button>
          );
        })}
      </>
    );
  }
  return (
    <>
      {NODE_TYPES.map((type, i) => {
        if (i >= shownCount) return null;
        // Back to a full 360° ring — the node's own caption is hidden
        // outright while it's selected now (see NodeCard), which was the
        // actual thing a half-circle was working around (ghosts overlapping
        // that text below it). With nothing there to overlap, there's no
        // reason left to give up the bottom half of the ring.
        //
        // Negated i: NODE_TYPES' own order reads counter-clockwise from the
        // top (was clockwise) — the first type still lands straight up
        // (i=0 keeps angle at -90°), only the direction the rest of the
        // list sweeps around the circle flips.
        const angle = (-i / NODE_TYPES.length) * Math.PI * 2 - Math.PI / 2;
        const x = ringCenter.x + R * Math.cos(angle);
        const y = ringCenter.y + R * Math.sin(angle);
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
            className={`absolute z-[33] flex -translate-x-1/2 -translate-y-1/2 cursor-pointer animate-ghost-in flex-col items-center border-0 bg-transparent p-0 transition-[opacity,transform] duration-[150ms] ease-[ease] hover:translate-x-[-50%] hover:translate-y-[-50%] hover:scale-[1.1] hover:opacity-100 focus-visible:translate-x-[-50%] focus-visible:translate-y-[-50%] focus-visible:scale-[1.1] focus-visible:opacity-100 ${
              armedType === type ? "scale-[1.1] opacity-100" : "opacity-75"
            }`}
            // touchAction: manipulation — stops a quick second tap being
            // claimed by the browser as double-tap-to-zoom on a phone.
            style={{ left: x, top: y, touchAction: "manipulation" }}
            title={armedType === type ? `${t.ui.types[type]} — ${t.ui.node.ghostAgain}` : t.ui.types[type]}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - stageAt.current < STAGE_GUARD_MS) return;
              if (armedType === type) pickType(type, { x, y });
              else setArmed({ type, x, y, angle });
            }}
          >
            <div className="relative" style={{ height: ICON_SIZE * k, width: ICON_SIZE * k }}>
              <div
                className="absolute top-1/2 left-1/2"
                style={{ height: ICON_SIZE, width: ICON_SIZE, transform: `translate(-50%, -50%) scale(${GHOST_SCALE * k})` }}
              >
              {/* Same halo/horns crown a real node of this type gets — see
                  NodeCrown's own doc comment. */}
              {!compact && <NodeCrown type={type} />}
              <div
                // bg-[var(--node-fill)], not bg-surface: same fill the real
                // node this previews will actually render with (see index.css's
                // own --node-fill comment and NodeCard's matching usage) —
                // a ghost is a preview, so it should look like the thing it
                // is standing in for, not a lighter/different stand-in.
                className="flex h-full w-full animate-quick-add-pulse items-center justify-center rounded-full border-2 bg-[var(--node-fill)] shadow-card"
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
              {pickedEmoji && (
                // Emoji first: the feeling already picked rides along on every type.
                <span aria-hidden className="absolute -top-1 -right-2 text-[18px] leading-none">
                  {pickedEmoji}
                </span>
              )}
              </div>
            </div>
            {/* Always mounted and faded (not added/removed) so the names
                cross-fade instead of popping, and absolutely placed under the
                icon so showing one never shifts the icon itself. Shows for
                the ghost a click has picked out (with the "click again"
                hint), otherwise for whichever ghost the sequence has reached — a hover tooltip never shows at all on
                a touch device, which is exactly where a bare icon is hardest
                to identify. Same small-chip-over-clutter styling NodeCard's
                own caption uses, so it reads clearly against the canvas
                behind it. whitespace-nowrap: these sit close enough together
                around the ring that a wrapped two-line label would start
                overlapping its neighbors', worse than one line running a
                little wide. */}
            <div
              className={`pointer-events-none absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center rounded-[3px] bg-surface px-[0.3rem] py-[0.1rem] leading-[1.2] whitespace-nowrap text-ink shadow-card transition-opacity duration-500 ease-in-out ${
                armedType === type || labelIndex === i ? "opacity-100" : "opacity-0"
              }`}
              style={{ marginTop: 4.8 * k, transform: `scale(${k})`, transformOrigin: "50% 0" }}
            >
              <span className="text-[0.66rem] font-semibold">{t.ui.types[type]}</span>
              {armedType === type && <span className="text-[0.55rem] text-ink-soft">{t.ui.node.ghostAgain}</span>}
            </div>
          </button>
        );
      })}
      {armed && (
        <GhostTemplates
          key={armed.type}
          type={armed.type}
          pos={{ x: armed.x, y: armed.y }}
          angle={armed.angle}
          zoom={zoom}
          phrases={t.ui.node.ghostTemplates[armed.type]}
          title={t.ui.node.ghostTemplatesTitle}
          onPick={(text) => pickType(armed.type, { x: armed.x, y: armed.y }, text)}
        />
      )}
    </>
  );
});

// How far (on screen) the phrase column starts from the ghost's center: past
// the ghost itself sideways, and past its name chip too when it hangs below.
const TEMPLATE_SIDE_GAP = 34;
const TEMPLATE_BELOW_GAP = 64;
const TEMPLATE_ABOVE_GAP = 40;

// The picked ghost's starter phrases, stacked on the side of the ghost that
// faces away from the anchor node, so they never cover the node or the ring.
function GhostTemplates({
  type,
  pos,
  angle,
  zoom,
  phrases,
  title,
  onPick,
}: {
  type: NodeType;
  pos: { x: number; y: number };
  angle: number;
  zoom: number;
  phrases: string[];
  title: string;
  onPick: (text: string) => void;
}) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // A side ghost gets its column beside it; a top/bottom ghost above/below it.
  const sideways = Math.abs(cos) > 0.5;
  const place: CSSProperties = sideways
    ? {
        left: cos > 0 ? TEMPLATE_SIDE_GAP : -TEMPLATE_SIDE_GAP,
        top: 0,
        transform: `translate(${cos > 0 ? "0" : "-100%"}, -50%)`,
        alignItems: cos > 0 ? "flex-start" : "flex-end",
      }
    : {
        left: 0,
        top: sin > 0 ? TEMPLATE_BELOW_GAP : -TEMPLATE_ABOVE_GAP,
        transform: `translate(-50%, ${sin > 0 ? "0" : "-100%"})`,
        alignItems: "center",
      };
  return (
    // Drawn in screen pixels: the wrapper undoes the canvas zoom, the same
    // way the ghosts themselves stay one size on screen.
    <div
      className="pointer-events-none absolute z-[34]"
      style={{ left: pos.x, top: pos.y, transform: `scale(${1 / (zoom || 1)})`, transformOrigin: "0 0" }}
    >
      <div className="absolute flex flex-col gap-[0.3rem]" style={place}>
        {phrases.map((phrase, i) => (
          <button
            key={phrase}
            type="button"
            className="pointer-events-auto max-w-[11rem] animate-ghost-in cursor-pointer rounded-full border border-dashed bg-surface px-[0.55rem] py-[0.2rem] text-left text-[0.66rem] leading-[1.25] font-medium whitespace-nowrap text-ink opacity-85 shadow-card transition-[opacity,transform] duration-150 hover:scale-[1.05] hover:opacity-100 focus-visible:opacity-100"
            style={{ borderColor: NODE_TYPE_COLORS[type], animationDelay: `${i * 70}ms`, touchAction: "manipulation" }}
            title={title}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPick(phrase);
            }}
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  );
}

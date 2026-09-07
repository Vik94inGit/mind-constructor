import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { NODE_TYPE_COLORS, cycleAttackNodeType, cycleNodeType } from "../utils/nodeType";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";
import { NodeCrown } from "./NodeCrown";
import { NodeWings } from "./NodeWings";
import { NodeTypeIcon } from "./NodeTypeIcon";
import {
  burstParticles,
  ANGEL_PARTICLE_COLORS,
  DEVIL_PARTICLE_COLORS,
  DEFAULT_PARTICLE_COLORS,
  WEAPON_PARTICLE_COLORS,
} from "../utils/particles";
import type { AttackIndicator, NodeDoc, NodeType } from "../types";

// A stable "which direction did this weapon fly in from" per node, derived
// from its id so it doesn't change across re-renders without needing to be
// stored anywhere — same trick MapPage's hashOffset uses for weapon-node
// placement jitter.
function flightOffset(seed: string): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100003;
  const angle = (h % 360) * (Math.PI / 180);
  const distance = 140 + (h % 60);
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

// A tiny seeded PRNG (mulberry32-ish) so a node's drift waypoints/timing are
// stable across re-renders without storing anything — the node's real x/y
// (what the backend has) never changes for this; only the drawn position
// wobbles around it, purely via CSS. Same "hash the id" trick as
// flightOffset/hashOffset elsewhere in this file/MapPage, just needing more
// than one independent number out of one seed.
function seededRandoms(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = Math.sin(h + i * 999.317) * 43758.5453;
    out.push(v - Math.floor(v)); // fract() — always in [0, 1)
  }
  return out;
}

// OutcomeBadge is just a symbol now (see its own doc comment) — sized
// close to NodeTypeIcon's own 26px so an outcome-type node and an
// "unknown" one read as the same *kind* of glyph inside the same bordered
// circle, just a filled bold shape instead of a thin-stroke line icon.
const OUTCOME_BADGE_SIZE = 32;

// CSS custom properties driving the .chaotic keyframes below: three small
// waypoints plus a randomized duration/negative-delay, so several drifting
// nodes never move in lockstep — a shared clock with the same waypoints
// would read as one synchronized wobble, not "chaotic".
const CHAOS_AMPLITUDE_PX = 10;
function chaosStyle(seed: string): CSSProperties {
  const [rx1, ry1, rx2, ry2, rx3, ry3, rDuration, rDelay] = seededRandoms(seed, 8);
  const wp = (rx: number, ry: number) => ({
    x: (rx * 2 - 1) * CHAOS_AMPLITUDE_PX,
    y: (ry * 2 - 1) * CHAOS_AMPLITUDE_PX,
  });
  const w1 = wp(rx1, ry1);
  const w2 = wp(rx2, ry2);
  const w3 = wp(rx3, ry3);
  const duration = 2.6 + rDuration * 2.2; // 2.6s–4.8s
  return {
    "--chaos-x1": `${w1.x}px`,
    "--chaos-y1": `${w1.y}px`,
    "--chaos-x2": `${w2.x}px`,
    "--chaos-y2": `${w2.y}px`,
    "--chaos-x3": `${w3.x}px`,
    "--chaos-y3": `${w3.y}px`,
    animationDuration: `${duration}s`,
    animationDelay: `-${rDelay * duration}s`, // negative: starts mid-cycle, not all at t=0
  } as CSSProperties;
}

interface Props {
  node: NodeDoc;
  x: number;
  y: number;
  /** MapPage's own canvas zoom (see its zoom state) — this node's own visual content (icon, health ring, caption) counter-scales by 1/zoom so it renders at a constant on-screen size regardless of zoom level; only its *position* moves with the rest of the canvas. See the inverseScaleStyle wrapper below for why that's a separate inner element rather than folded into this node's own transform. */
  zoom: number;
  selected: boolean;
  dragging: boolean;
  canDrag: boolean;
  groupSentiment?: "positive" | "negative";
  indicator?: AttackIndicator;
  linkModeActive: boolean;
  /** Map.discussionMode — hides the health ring until hover instead of showing it always. See ringStyle below. */
  discussionMode?: boolean;
  /** True for exactly one render: the moment this node was created in this session. */
  celebrate?: boolean;
  /** Dimmed because some other node's quick-add ghosts are active — still clickable. */
  muted?: boolean;
  /** Someone is currently dragging another node close enough to this one to drop-and-join its circle — "valid" (would succeed) or "invalid" (blocked, e.g. sentiment mismatch). */
  dropHighlight?: "valid" | "invalid";
  /** Swaps the caption for an autofocused text input and makes the icon clickable to cycle type — set by double-click/"Update"/the side panel's Edit button. */
  inlineEditing?: boolean;
  /** Weapon nodes only: the direction (in px, already scaled to the desired flight distance) it should appear to fly in from — the vector from its target's position to its own resting spot, so the entrance animation reads as "launched from what it hit". Falls back to a random per-node direction (flightOffset below) when there's no resolvable target. */
  flightVector?: { x: number; y: number };
  /** Fired once on blur/Enter with a non-empty, actually-changed draft. */
  onInlineConfirm?: (text: string, type: NodeType) => void;
  /** Fired on Escape, or on blur/Enter when the draft is empty or unchanged. */
  onInlineCancel?: () => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onClick: () => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
}

export function NodeCard({
  node,
  x,
  y,
  zoom,
  selected,
  dragging,
  canDrag,
  groupSentiment,
  indicator,
  linkModeActive,
  discussionMode,
  celebrate,
  muted,
  dropHighlight,
  inlineEditing,
  flightVector,
  onInlineConfirm,
  onInlineCancel,
  onPointerDown,
  onClick,
  onContextMenu,
}: Props) {
  const particlesRef = useRef<HTMLDivElement | null>(null);

  // Fires once, the instant a freshly-created node mounts — every type gets
  // the burst, not just Success/Fail. NodeCard stays mounted across
  // re-renders (stable `key`), so this never replays on later updates, and
  // never fires at all for nodes that were already on the map when it loaded.
  // Every non-"unknown" type is now an outcome badge (see OutcomeBadge.tsx)
  // — halo-ring types read as the positive framing, horns-ring as negative.
  // Deliberately off the node's *persisted* type, not the live edit draft
  // below — the burst is a one-time creation effect, unrelated to editing.
  const burstRing = ringKindFor(node.type);

  useEffect(() => {
    if (!celebrate || node.isWeapon) return;
    if (burstRing === "halo") burstParticles(particlesRef.current, ANGEL_PARTICLE_COLORS, 16, 65);
    else if (burstRing === "horns") burstParticles(particlesRef.current, DEVIL_PARTICLE_COLORS, 20, 85);
    else burstParticles(particlesRef.current, DEFAULT_PARTICLE_COLORS, 14, 55);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft state for inline editing — reset from the node's real text/type
  // every time editing turns on, so re-opening it after a cancel (or after
  // someone else's edit landed) always starts from what's actually saved.
  const [draftText, setDraftText] = useState(node.text);
  const [draftType, setDraftType] = useState<NodeType>(node.type);
  // Escape needs to blur the input *without* the resulting blur treating
  // that as a confirm — this flag is the one thing both handlers share, so
  // there's a single place (handleBlur) that actually decides what happens,
  // regardless of which path (Enter, Escape, clicking away) triggered it.
  const cancelingRef = useRef(false);

  useEffect(() => {
    if (inlineEditing) {
      setDraftText(node.text);
      setDraftType(node.type);
      cancelingRef.current = false;
    }
  }, [inlineEditing, node.text, node.type]);

  const style: CSSProperties = { left: x, top: y };

  // A weapon/attack node carries a real type now (Problem/Problematic
  // option/Fail — the attacker's actual objection), so it renders through
  // the exact same icon+ring+caption markup as any other node, with a
  // small weapon badge added below to mark where it came from — same
  // horns framing any other node of that type gets, fitting for an attack.
  // While editing, the icon reflects the live draft type (so cycling it is
  // actually visible); otherwise it's just the node's real type.
  const displayType = inlineEditing ? draftType : node.type;
  const ring = ringKindFor(displayType);
  const isOutcome = !!ring;
  // In a circle (groupSentiment set — a node with 2+ direct parentId-
  // children, or one of those children) but not the one currently chosen
  // (node.locked) — the "unchosen circle" case: free to drift. A node in no
  // circle at all, or in the chosen one, or mid-drag, stays put — once a
  // circle is stabilized there's nothing left to click out to, so freezing
  // it there for good is exactly what's wanted, not just "until next drag".
  // Same "nothing to click out to" reasoning applies one level down, per
  // node: once *this* node is the one chosen (selected, panel open) or
  // being typed into (inlineEditing), it stops drifting too, circle
  // stabilized or not — reading or editing a node that keeps sliding out
  // from under the cursor/panel is exactly the annoyance stabilizing a
  // whole circle was already meant to avoid. Weapon nodes never carry a
  // groupSentiment (they're never anyone's parentId child), so this never
  // applies to one.
  const chaotic = !!groupSentiment && !node.locked && !dragging && !selected && !inlineEditing;
  const readonly = !canDrag;
  // Opacity/cursor each have one property multiple states could set — CSS
  // cascade resolves that per-property, not per-modifier, so it's resolved
  // the same way here: state precedence follows the order these used to be
  // declared in the stylesheet (later declaration wins when more than one
  // state applies at once), not which condition happens to be checked
  // first. defeated > dragging > muted for opacity; readonly > dragging for
  // cursor. Filter (grayscale) is muted's alone — nothing else ever touched
  // that property, so it doesn't participate in the opacity precedence at all.
  const opacityClass = node.defeated ? "opacity-55" : dragging ? "opacity-85" : muted ? "opacity-32" : "";
  const filterClass = muted ? "grayscale-[35%]" : "";
  const cursorClass = readonly ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab";
  // Position updates (left/top, applied via inline style) need to be
  // instant while actively dragging — only once released does the
  // transform itself (used by the chaotic-drift/fly-in animations, and by
  // a released circle's "drifts back to its real spot" ease) get a
  // transition at all.
  //
  // `[transition:...]` (an arbitrary CSS *property*), not Tailwind's own
  // `transition-[...]` utility — that utility only ever sets
  // `transition-property`, which only accepts bare property names. Handing
  // it "opacity 0.15s ease" (property+duration+easing together) makes that
  // one declaration invalid, so the browser drops it and transition-property
  // falls back to its initial value: `all`. With that, this element's
  // `left`/`top` — updated via inline style on every pointer-move while
  // dragging — started transitioning too instead of jumping instantly,
  // which is exactly what read as "drag has a delay". Root cause, not
  // guessed: confirmed via computed style (`transitionProperty: "all"`)
  // before this fix.
  const transitionClass = dragging
    ? "[transition:opacity_0.15s_ease,filter_0.15s_ease]"
    : "[transition:opacity_0.15s_ease,filter_0.15s_ease,transform_0.4s_ease]";
  // Single resolution point for this node's own stacking, same reasoning as
  // opacityClass/cursorClass above — exactly one z-index utility ever
  // applies, never two stacked in the same class list (whichever Tailwind
  // happened to generate first in the stylesheet would silently win over
  // the other otherwise). z-31 baseline keeps every node (and the
  // quick-add ghosts/pending-create card, z-33) painting *above*
  // MapPage's full-screen NodePanel backdrop (z-30) — added there to dim
  // the canvas and close the panel on an outside tap, which without this
  // otherwise also swallows every tap meant for a node, a ghost, or the
  // pending-create input while a node is selected. z-32 while actively
  // dragged keeps the dragged node above every other node too, same as
  // before.
  const zIndexClass = dragging ? "z-[32]" : "z-[31]";
  const classes = [
    // Plain `transform: translate(-50%, -50%)` via an arbitrary value, not
    // Tailwind's -translate-x-1/2 utility — Tailwind v4's translate
    // utilities set the separate CSS `translate` property, not `transform`.
    // That's harmless on its own, but this element's chaotic-drift and
    // weapon-fly-in keyframes (registered in index.css) both write a raw
    // `transform: translate(...)`, and `translate`/`transform` are
    // independent properties that both apply and compose — so with the
    // Tailwind utility, an animated node would get centered twice (once by
    // each property), landing it visibly offset from its real x/y. Writing
    // the plain property here instead means only one thing is ever doing
    // the centering, matching what the animations' own keyframes assume.
    //
    // touch-none (touch-action: none): without it, starting a drag with a
    // finger on a phone is ambiguous to the browser between "the page's JS
    // is handling this pointer sequence" and "the user is panning the
    // scrollable canvas wrapper" — the browser is free to take over as a
    // native scroll (canceling the drag with a pointercancel) the moment it
    // sees touch movement, even though onPointerDown already called
    // setPointerCapture. That's what made dragging a node on a phone just
    // scroll the canvas out from under your finger instead. touch-none
    // opts this element out of that native gesture so the pointermove
    // handler in MapPage's onNodePointerDown gets every event instead.
    "group absolute flex w-[92px] touch-none [transform:translate(-50%,-50%)] select-none flex-col items-center",
    zIndexClass,
    transitionClass,
    cursorClass,
    opacityClass,
    filterClass,
    chaotic && "animate-node-chaos-drift",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = (e: ReactMouseEvent) => {
    // Without this, the click bubbles to .map-canvas's own onClick, which
    // deselects on any click reaching it — so selecting a node and
    // immediately un-selecting it happened in the same tick, and clicking
    // a node looked like it did nothing at all.
    e.stopPropagation();
    onClick();
  };

  const handleContextMenu = (e: ReactMouseEvent) => {
    // Same stopPropagation reasoning as clicks: without it this also
    // reaches .map-canvas's own onContextMenu, which closes everything —
    // right-clicking a node should open its menu, not dismiss it.
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e);
  };

  // Single resolution point for the inline editor, however it was reached.
  function resolveInlineEdit() {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      onInlineCancel?.();
      return;
    }
    const trimmed = draftText.trim();
    if (!trimmed || (trimmed === node.text && draftType === node.type)) {
      onInlineCancel?.();
      return;
    }
    onInlineConfirm?.(trimmed, draftType);
  }

  // celebrate fires exactly once, the moment a weapon node lands from its
  // attack — same contract regular nodes use for their particle burst on
  // creation, borrowed here for "fly in from a direction, then spark on
  // impact" instead. NodeCard's stable key means the class only ever
  // applies once, so the CSS animation only ever plays once too.
  const flying = node.isWeapon && !!celebrate;
  const flightStyle = flying
    ? (() => {
        // Prefer the real target-relative direction (see flightVector's own
        // doc comment) — the random hash fallback only ever fires if a
        // target can't be resolved (deleted mid-flight, say).
        const { x: fx, y: fy } = flightVector ?? flightOffset(node.nodeId);
        return { "--fly-x": `${fx}px`, "--fly-y": `${fy}px` } as CSSProperties;
      })()
    : undefined;

  // Health only ever shows for the chosen (selected) node — every other
  // node keeps it hidden, discussion mode/circle membership or not: a
  // whole map's worth of health rings all visible at once read as noise,
  // and a circle's own halo/horns backdrop already communicates its
  // members' status anyway. Applies uniformly to every node type — this
  // div's own ring is health's one and only home.
  const showHealth = selected;

  // Ring is a conic-gradient read off CSS custom properties, so the health
  // sweep and its color are just two variables — no per-type CSS needed.
  // Normally `background` is set right here (not a class), for the same
  // reason the two custom properties are — this whole value only ever
  // varies per-instance.
  //
  // When hidden it's deliberately left unset instead: an inline style
  // always wins over a class, hover included, so putting the real gradient
  // there would make it impossible for a group-hover class below to reveal
  // it only on hover. The two custom properties stay inline either way — a
  // class-based rule can still read them via var(), cascade only decides
  // who wins for the *background* property itself.
  // transparent, not var(--surface-2) — the "used up" portion of this ring
  // (past the health-colored arc) used to fill gray, which on a damaged
  // node read as a distinct gray zone sitting between the badge's own dark
  // fill and its colored outline. Leaving it transparent instead means the
  // ring only ever shows the *actual* health-colored arc; the "missing"
  // health is communicated by that arc simply being shorter, not by a
  // second, separately-colored fill for what isn't there any more.
  const healthGradient =
    "conic-gradient(var(--ring-color, var(--success)) calc(var(--health, 100) * 3.6deg), transparent 0deg)";
  const ringStyle: CSSProperties = {
    "--health": Math.max(0, Math.min(100, node.health)),
    "--ring-color": node.defeated ? "var(--danger)" : "var(--success)",
    ...(showHealth ? { background: healthGradient } : {}),
    // No separate dashed circle-membership outline any more — the group
    // backdrop's own color already says which circle (if any) a node
    // belongs to, and the spotlight dim/full-opacity split says whether
    // it's the chosen one, so a per-node ring here was a third, redundant
    // way of saying the same two things. Selection is still its own
    // distinct signal (this is the one you clicked), so it keeps its ring.
    outline: selected ? "2px solid var(--accent)" : undefined,
    outlineOffset: 2,
  } as CSSProperties;
  // Invisible until selected, then a plain fade-in — no more hover reveal:
  // that let every node's health show one at a time on hover, which was
  // still a whole map's worth of rings competing for attention as the
  // cursor passed over them. Selecting a node is already the map's one
  // "I'm looking at this one specifically" signal (see the outline above),
  // so health rides along with that instead of its own separate trigger.
  // This used to fall back to a flat bg-surface-2 fill instead of nothing,
  // which read as a plain gray circle sitting around every node's icon
  // rather than "nothing to see here, select it if you want it".
  const healthVisibilityClass = "bg-transparent transition-[background] duration-150 ease-[ease]";

  const chaosCss = chaotic ? chaosStyle(node.nodeId) : undefined;

  // One glow effect wins when more than one could apply at once — same
  // precedence the old stylesheet gave them by declaration order: a
  // drag-drop highlight (valid/invalid) beats the plain inline-editing glow.
  const ringStateClass =
    dropHighlight === "valid"
      ? "[--drop-glow:var(--success)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--drop-glow)_45%,transparent)] animate-drop-target-pulse"
      : dropHighlight === "invalid"
        ? "[--drop-glow:var(--danger)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--drop-glow)_45%,transparent)] animate-drop-target-pulse"
        : inlineEditing
          ? "shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
          : "";

  // Every node gets the same plain circular border now, outcome types
  // included — OutcomeBadge is just a symbol (no ring of its own any
  // more; its own halo/horns "crown" decoration is drawn separately, see
  // above), so there's nothing left for "outcome types skip the border
  // entirely" to have been protecting.
  const circleBorderClass = "overflow-hidden border-2 shadow-card";
  // under-fire (indicator) wins over the type's own color when both could
  // apply. This used to be a Tailwind class (border-danger) instead, which
  // an *unconditional* inline `borderColor` a few lines down silently
  // overrode every single time — an inline style always beats a class for
  // the same CSS property, so that red under-fire border could never
  // actually render, indicator or not. Deciding the color in JS instead,
  // so whichever one applies is really what gets set.
  const circleBorderColor = indicator ? "var(--danger)" : NODE_TYPE_COLORS[displayType];

  // Counter-scales this node's own visual content against MapPage's canvas
  // zoom, so icons/captions stay a constant size on screen while zooming —
  // only the canvas's own spacing (everything's x/y) actually grows or
  // shrinks. Applied on its own inner wrapper (see the JSX below) rather
  // than folded into this element's own `classes`/`style` transform,
  // specifically because that outer transform isn't always this element's
  // own inline style to begin with — the chaotic-drift and weapon-fly-in
  // *keyframe animations* (registered in index.css) each set `transform`
  // directly while they're playing, which fully replaces the computed
  // transform value rather than composing with it. Baking a zoom
  // counter-scale into that same property would make it vanish for the
  // exact duration of either animation, popping the node to the "wrong"
  // (zoom-scaled) size and back. A separate inner element's own transform
  // is never touched by either keyframe, so it stays in effect regardless
  // of what the outer positioning div's transform is doing at any moment.
  const inverseScaleStyle: CSSProperties = { transform: `scale(${1 / zoom})` };

  return (
    <div
      className={`${classes} ${flying ? "animate-weapon-fly-in" : ""}`}
      style={{ ...style, ...flightStyle, ...chaosCss }}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onAnimationEnd={() => {
        if (flying) burstParticles(particlesRef.current, WEAPON_PARTICLE_COLORS, 10, 40);
      }}
      title={node.text}
    >
      {/* See inverseScaleStyle's own comment above for why this is a
          separate element from the outer positioning div rather than
          folded into its own transform. */}
      <div className="flex w-full flex-col items-center" style={inverseScaleStyle}>
      <div className="relative h-[60px] w-[60px]">
        {indicator && (
          <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-danger text-[0.65rem] font-bold text-white">
            {indicator.incomingNegativeEdges}
          </div>
        )}
        {/* Halo/horns — see NodeCrown's own doc comment; shared with
            QuickAddGhosts so a ghost previews this too, not just the bare
            symbol. */}
        <NodeCrown type={displayType} />
        {/* Wings — see NodeWings's own doc comment for why this is a
            separate, never-resized overlay rather than living inside
            OutcomeBadge. Placed before the bordered circle below in DOM
            order (both z-index:auto) so the circle paints over the
            wings' own base, same "flanking the head, not stamped on top
            of it" look the wings always had. */}
        <NodeWings type={displayType} show={selected} />
        {/* No more weapon-type badge here — which weapon landed used to
            show as a little corner label on the objection node itself.
            That's dropped in favor of the pointer MapPage draws between
            this node and its target (see the weapon-mark <g> there): an
            attack node otherwise renders exactly like any other node of
            its type, and the pointer alone carries "this is an attack,
            aimed at that". */}
        <div className="pointer-events-none absolute inset-0 z-[5] overflow-visible" ref={particlesRef} />
        <div
          className={`flex h-full w-full items-center justify-center rounded-full p-[3px] transition-transform duration-150 ease-[ease] group-hover:scale-[1.06] ${healthVisibilityClass} ${ringStateClass}`}
          style={ringStyle}
          title={showHealth ? undefined : "Select to see health"}
        >
          {inlineEditing ? (
            <button
              type="button"
              className={`flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-surface p-0 font-[inherit] hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_35%,transparent)] ${circleBorderClass}`}
              style={{ borderColor: circleBorderColor }}
              title="Click to change type"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setDraftType(node.isWeapon ? cycleAttackNodeType : cycleNodeType);
              }}
            >
              {isOutcome ? (
                <OutcomeBadge
                  type={displayType as OutcomeType}
                  size={OUTCOME_BADGE_SIZE}
                  symbolOverride={node.symbolOverride}
                />
              ) : (
                <NodeTypeIcon type={displayType} size={26} />
              )}
            </button>
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center rounded-full bg-surface ${circleBorderClass}`}
              style={{ borderColor: circleBorderColor }}
            >
              {isOutcome ? (
                <OutcomeBadge
                  type={displayType as OutcomeType}
                  size={OUTCOME_BADGE_SIZE}
                  symbolOverride={node.symbolOverride}
                />
              ) : (
                <NodeTypeIcon type={displayType} size={26} />
              )}
            </div>
          )}
        </div>
      </div>
      {inlineEditing ? (
        <input
          className="mt-[0.35rem] w-full rounded-[4px] border-[1.5px] border-accent bg-surface px-[0.25rem] py-[0.1rem] text-center text-[0.72rem] leading-[1.25] font-[inherit] text-ink focus:outline-none focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
          autoFocus
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelingRef.current = true;
              e.currentTarget.blur();
            }
          }}
          onBlur={resolveInlineEdit}
        />
      ) : (
        <div className="mt-[0.35rem] line-clamp-2 text-center text-[0.72rem] leading-[1.25] break-words text-ink">
          {node.text}
        </div>
      )}
      {linkModeActive && (
        <div className="mt-[0.1rem] text-[0.65rem] font-semibold text-accent">link?</div>
      )}
      </div>
    </div>
  );
}

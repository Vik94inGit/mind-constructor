import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { NODE_TYPE_COLORS, ZONE_COLORS, cycleAttackNodeType, cycleNodeType } from "../utils/nodeType";
import type { Sentiment } from "../utils/nodeType";
import type { Feeling } from "../utils/feeling";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import { NodeCrown } from "./NodeCrown";
import { NodeWings } from "./NodeWings";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { nodeEmojiFace } from "../utils/emojiFace";
import type { TypeEmoji } from "../utils/emojiFace";
import { shapeRoundClass } from "./nodeShape";
import { StickerCard } from "./StickerCard";
import { NodeBadges } from "./nodeCard/NodeBadges";
import { NodeFace } from "./nodeCard/NodeFace";
import { MAX_NODE_TEXT } from "../utils/nodeText";
import { CAPTION_WIDTH, nodeZoomScale } from "../utils/canvasLayout";
import { useI18n } from "../i18n/I18nContext";
import {
  burstParticles,
  ANGEL_PARTICLE_COLORS,
  DEVIL_PARTICLE_COLORS,
  DEFAULT_PARTICLE_COLORS,
  WEAPON_PARTICLE_COLORS,
} from "../utils/particles";
import { chaosStyle, flightOffset } from "./nodeCardMotion";
import { useInlineEditDraft } from "./useInlineEditDraft";
import type { AttackIndicator, NodeDoc, NodeType } from "../types";
import { nodeSizeMultiplier } from "../utils/nodePriority";
import { imageSrc } from "../utils/images";
import { chompMouth } from "../utils/pacman";
import type { ChompMove } from "../utils/pacman";
import type { ReadingMode } from "../utils/readingMode";
import { isEditableTarget } from "../utils/editable";


// Reading modes (see utils/readingMode.ts). A puzzle card is as wide
// as its text wants up to this — far past the 148px caption chip, since the
// point of the mode is reading whole nodes — and only a selected node
// (whose ghost ring and panel already surround it) is held to the compact one.
const PUZZLE_MAX_WIDTH = 240;
const NO_TYPE_EMOJI: TypeEmoji = {};
const PUZZLE_SELECTED_MAX_WIDTH = 180;
// A puzzle card shows about this many characters of its text on the canvas
// (a node holds up to 1000); the rest scrolls inside the card. At the card's
// text size about 36 characters fit a line, so this is its height in lines.
export const PUZZLE_VISIBLE_CHARS = 500;
const PUZZLE_TEXT_MAX_LINES = Math.ceil(PUZZLE_VISIBLE_CHARS / 36);
// The "+N" / "−" pill that packs and opens a parent's branch (the step number takes the left).
// Beside a round icon; on a card's top edge near its right corner (its right
// side has its link tab and, selected, the ring's ghost), sitting on the edge
// so it stays within the gap to the row of cards above.
const PACK_PILL_NEXT = "top-1/2 left-[calc(100%+4px)] -translate-y-1/2";
const PACK_PILL_ABOVE = "top-0 right-3 -translate-y-1/2";
const PACK_PILL_CLASS =
  "pointer-events-auto absolute z-[7] flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-full border-2 bg-surface px-[0.35rem] text-[0.7rem] leading-none font-bold whitespace-nowrap shadow-card hover:bg-surface-2";
// iconText captions: a little wider and taller than the default chip.
const ICON_TEXT_CAPTION_WIDTH = 176;
// A picture card (NodeDoc.cardImage) in place of the icon, on screen.
const CARD_IMAGE_WIDTH = 120;
const CARD_IMAGE_MAX_HEIGHT = 120;
// Smaller while selected, so the quick-add ghosts ringing the node stay clear of it.
const CARD_IMAGE_SELECTED_SIZE = 72;


interface Props {
  node: NodeDoc;
  /** The viewer's "emoji first" mode: every node shows an emoji face up (its own, or its type's), its type on the back (see utils/emojiFace.ts). */
  emojiFirst?: boolean;
  /** The viewer's own emoji per type, over the defaults (utils/emojiFace.ts). */
  typeEmoji?: TypeEmoji;
  /** Each new non-zero value turns the emoji card over once and back — MapPage's chosen-zone sequence (see useFlipSequence). */
  flipToken?: number;
  x: number;
  y: number;
  /** MapPage's own canvas zoom (see its zoom state) — this node's own visual content (icon, health ring, caption) counter-scales by 1/zoom so it renders at a constant on-screen size regardless of zoom level; only its *position* moves with the rest of the canvas. See the inverseScaleStyle wrapper below for why that's a separate inner element rather than folded into this node's own transform. */
  zoom: number;
  selected: boolean;
  /** In the current group (multi-)selection — a lighter-weight, dashed version of `selected`'s ring; several nodes can carry this at once, unlike `selected`. See MapPage's multiSelectIds. */
  multiSelected?: boolean;
  dragging: boolean;
  canDrag: boolean;
  groupSentiment?: Sentiment;
  /** Set only for a circle's own root/parent node (MapPage's circleRootSentimentByNode) — draws the small crown badge below, colored by the circle's majority pos/neg/neutral vote. Undefined for every other node, root or not part of any circle. Also the one thing (besides `inChosenCircle`) that keeps this node's own caption showing by default — see `showCaption` below. */
  parentCrownSentiment?: Sentiment;
  /** This node belongs to the currently-chosen circle (MapPage's `map.selectedCircle`, via chosenCircleMemberIds) — shows its caption too, root or not, so a studied cluster reads with every member's text visible at once instead of just its parent's. */
  inChosenCircle?: boolean;
  indicator?: AttackIndicator;
  /** MapPage's choose mode is on — unchosen nodes show a small "choose?" hint under them. */
  chooseModeActive: boolean;
  /** How this viewer reads the map — see utils/readingMode.ts. Omitted means "actual" (the default look). */
  readingMode?: ReadingMode;
  /** Owner only: this node is in a branch hidden from invited members — shows a small crossed-eye badge. */
  hiddenBranch?: boolean;
  /** The simplified view (see utils/readingMode.ts): a smaller icon, and no halo/horns or wings. */
  compact?: boolean;
  /** MapPage's isDiscussionMode (Map.discussionMode !== false) — Personal mode (explicit false) hides the health ring outright, selected or not. Omitted/undefined defaults to true (Discussion), never coerced with `!!`. See showHealth below. */
  discussionMode?: boolean;
  /** True for exactly one render: the moment this node was created in this session. */
  celebrate?: boolean;
  /** Dimmed because some other node's quick-add ghosts are active — still clickable. */
  muted?: boolean;
  /** Has a visible child (utils/nodePriority.ts) — paints above every non-parent node, so nothing a child draws covers it. */
  isParent?: boolean;
  /** A child nobody is looking at right now — drawn faded so its parent reads first; full strength again on hover. */
  quiet?: boolean;
  /** This node's caption would lie over a parent's caption, so it's left out. */
  hideCaption?: boolean;
  /** The node the time-lapse has just brought back: its caption shows its title and text, up to 5 rows, whatever else would hide it. */
  replayCaption?: boolean;
  /** How many nodes are currently packed into this one (MapPage's packedCountByContainer) — undefined/0 renders no badge. See the corner-badge markup below. */
  packedCount?: number;
  /** Auto-pack (utils/autoPack.ts): how many nodes this parent has tucked in — a "+N" pill on its right that opens them again (onUnfold). */
  foldedCount?: number;
  onUnfold?: () => void;
  /** Set on an open parent: a "−" pill in the same spot as "+N" that packs its branch in. Shows while the node is selected, or under a mouse pointer. */
  onFold?: () => void;
  /** True for a Problem-type node with no Success/Option/Solution child yet — nothing proposed against it. Pulses a persistent danger-colored ring (see index.css's own unsolved-problem-pulse) until that changes. Ignored for every other type. */
  unsolved?: boolean;
  /** A Success that solved a Problem or reached a goal (see computeSolved): always wears its wings and halo, even in the simplified view. */
  triumphant?: boolean;
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
  /** Receives the raw click event (not just fired) so callers can read modifier keys — a Shift+click toggles group selection instead of the normal single-select/center behavior. See MapPage's handleNodeClick. */
  onClick: (e: ReactMouseEvent) => void;
  /** Double-click/double-tap — starts inline text/type editing (see MapPage's startInlineEdit); the only thing double-clicking a node does. */
  onDoubleClick?: () => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  /** Cards only: set when the viewer may resize this card — the new size, in canvas units (Node.cardW/cardH). */
  onCardResize?: (size: { w: number; h: number }) => void;
  /** Cards only: the viewer's own fill for this card (utils/cardFill.ts). */
  cardFill?: string;
  /** The viewer's own feeling about this thought (utils/feeling.ts): a small badge, the card stays where it is. */
  feeling?: Feeling;
  /** Zoomed far out (MapPage's DOT_ZOOM): drawn as a small dot in its type's color, nothing else. */
  dotted?: boolean;
  /** Puzzle cards only: dragging out of one of this piece's tabs starts a connection to another piece (MapPage's startPuzzleConnect). Unset when this viewer can't link from this node. */
  onConnectStart?: (e: ReactPointerEvent) => void;
  /** Cards only: set on the viewer's own selected card — its + button adds a branch (MapPage's addBranchFromCard). */
  onAddBranch?: () => void;
  /** Puzzle cards only: locked by its owner (utils/blockLock.ts). */
  blockLocked?: boolean;
  /** Puzzle cards only: locks/unlocks this block. Unset when it isn't this viewer's to lock. */
  onToggleBlockLock?: () => void;
  /** Asks for this node's text to be loaded (it loads lazily) — fired when hovering a node that shows no caption, so its hover label has something to say. */
  onHoverText?: () => void;
  /** The pointer (not a finger) came onto or left this node's icon — a strong attack's Pac-Man run listens (see utils/pacman.ts). */
  onIconHover?: (hovered: boolean) => void;
  /** This strong attack is off on its Pac-Man run: the node itself runs this far toward what it hit, the empty part of its health ring opening as a mouth, and comes back (utils/pacman.ts). */
  chomp?: ChompMove;
}

export const NodeCard = memo(function NodeCard({
  node,
  emojiFirst = false,
  typeEmoji = NO_TYPE_EMOJI,
  flipToken,
  x,
  y,
  zoom,
  selected,
  multiSelected,
  dragging,
  canDrag,
  groupSentiment,
  parentCrownSentiment,
  inChosenCircle,
  indicator,
  chooseModeActive,
  readingMode = "actual",
  compact = false,
  hiddenBranch = false,
  discussionMode,
  celebrate,
  muted,
  isParent,
  quiet,
  hideCaption,
  replayCaption = false,
  packedCount,
  foldedCount,
  onUnfold,
  onFold,
  unsolved,
  triumphant = false,
  dropHighlight,
  inlineEditing,
  flightVector,
  onInlineConfirm,
  onInlineCancel,
  onPointerDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  onCardResize,
  cardFill,
  feeling,
  dotted = false,
  onConnectStart,
  onAddBranch,
  blockLocked = false,
  onToggleBlockLock,
  onHoverText,
  onIconHover,
  chomp,
}: Props) {
  const { t } = useI18n();
  const particlesRef = useRef<HTMLDivElement | null>(null);

  // Once, when a newly created node mounts (the card keeps a stable key, so
  // never again, and never for nodes already on the map when it loaded): a
  // burst in the colors of its persisted type's halo or horns.
  const burstRing = ringKindFor(node.type);

  useEffect(() => {
    if (!celebrate || node.isWeapon) return;
    if (burstRing === "halo") burstParticles(particlesRef.current, ANGEL_PARTICLE_COLORS, 16, 65);
    else if (burstRing === "horns") burstParticles(particlesRef.current, DEVIL_PARTICLE_COLORS, 20, 85);
    else burstParticles(particlesRef.current, DEFAULT_PARTICLE_COLORS, 14, 55);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft state for inline editing — see useInlineEditDraft.
  const { draftText, setDraftText, draftType, setDraftType, resolveInlineEdit, markCanceling } = useInlineEditDraft({
    node,
    inlineEditing,
    onInlineConfirm,
    onInlineCancel,
  });
  // The inline text field grows with the text, a row per line or wrap.
  const inlineFieldRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = inlineFieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draftText, inlineEditing]);

  // A circle's parent always draws at the biggest size tier (display only,
  // never saved), so "what the circle radiates from" holds at a glance.
  const isCircleParent = !!parentCrownSentiment;
  // The circle parent at the top of a tree wears the crown; a circle parent
  // that itself hangs from another node is a variant of it and wears a helmet.
  const isVariantParent = isCircleParent && !!node.parentId;
  const isNamedZone = isCircleParent && !!node.zoneName;
  // The positioning box grows with the size tier too, so a bigger node's
  // icon and caption stay clickable.
  const sizeMultiplier = nodeSizeMultiplier(node, isCircleParent, compact);
  const style: CSSProperties = { left: x, top: y, width: 74 * sizeMultiplier };

  // An attack node has a real type and draws like any other node; while
  // editing, the icon shows the live draft type.
  const displayType = inlineEditing ? draftType : node.type;
  const ring = ringKindFor(displayType);
  const isOutcome = !!ring;
  // A member of a circle that isn't the chosen one drifts. Nothing drifts that
  // is in no circle, in the chosen one, a circle's parent (the anchor its
  // children gather around), being dragged, selected or edited.
  const chaotic =
    !!groupSentiment &&
    !isCircleParent &&
    !node.locked &&
    !dragging &&
    !selected &&
    !multiSelected &&
    !inlineEditing &&
    // Puzzle cards hold still, so pieces clicked together stay fitted.
    !(readingMode === "puzzle" && !dotted);
  const readonly = !canDrag;
  // Captions show for a circle's parent, a node in no circle (nothing else
  // says what it is) and every member of the chosen circle; other members let
  // their zone speak. "Icons + text" shows every caption; puzzle cards have
  // none (the card is the node); the mixed mode draws only a circle's parent
  // as a card. A node being edited goes back to icon + input.
  const mixed = readingMode === "mixed";
  const puzzle = (readingMode === "puzzle" || (mixed && !!parentCrownSentiment)) && !inlineEditing;
  const iconText = readingMode === "iconText";
  const showCaption =
    (replayCaption && !puzzle) ||
    (!hideCaption && !puzzle && (mixed || iconText || !groupSentiment || !!parentCrownSentiment || !!inChosenCircle));
  // The caption: the title, else the start of the text (the chip's
  // line-clamp cuts it), else a ghost's prompt in a quieter style.
  const ghost = !!node.ghost && !node.text?.trim();
  const ghostPrompt = ghost && !node.title?.trim() ? (node.prompt?.trim() ?? "") : "";
  const captionLabel = node.title?.trim() || node.text || ghostPrompt;
  // An icon with no caption shows its text in a small label on hover (not
  // while selected or editing). Mounted only while hovered.
  const hoverLabel = !showCaption && !puzzle && !selected && !inlineEditing;
  const [hovered, setHovered] = useState(false);
  const requestText = () => {
    if (!node.text) onHoverText?.();
  };
  const trimmedTitle = node.title?.trim() ?? "";
  const healthPct = Math.max(0, Math.min(100, node.health));
  // One opacity per node, by precedence: defeated > dragging > muted > ghost >
  // quiet. The fades are index.css's node-fade-* classes, scaled by how much
  // fading the viewer wants (utils/nodeFade.ts).
  const opacityClass = node.defeated
    ? "opacity-55"
    : dragging
      ? "opacity-85"
      : muted
        ? "node-fade-muted"
        : ghost
          ? "node-fade-ghost"
          : quiet
            ? "node-fade-quiet"
            : "";
  const cursorClass = readonly ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab";
  // left/top must follow the pointer instantly while dragging; only the
  // transform (drift, fly-in, easing back) is transitioned after release.
  // Written as `[transition:...]`: Tailwind's transition-[...] only sets
  // transition-property, so a value with durations was dropped and fell back to
  // `all`, which animated left/top and made drags lag.
  const transitionClass = dragging
    ? "[transition:opacity_0.15s_ease,filter_0.15s_ease]"
    : "[transition:opacity_0.5s_ease,filter_0.15s_ease,transform_1.8s_cubic-bezier(0.4,0,0.2,1)]";
  // Exactly one z-index: z-31 keeps nodes above the panel backdrop (z-30), a
  // parent sits one layer up (z-32) so its children never paint over it, and a
  // dragged node (z-33) is above everything.
  const zIndexClass = dragging ? "z-[33]" : isParent ? "z-[32]" : "z-[31]";
  const classes = [
    // Centered with a plain `transform`, not Tailwind's translate utility (which
    // sets the separate `translate` property and would compose with the drift and
    // fly-in keyframes, centering twice). touch-none only on a node that will
    // drag, so the browser doesn't take the finger as a pan; any other node lets
    // a swipe pan the map. pointer-events-none: only the icon takes the pointer
    // (handlers still fire by bubbling), so packed captions don't cover the zone
    // underneath.
    "group pointer-events-none absolute flex w-[74px] [transform:translate(-50%,-50%)] select-none [-webkit-touch-callout:none] flex-col items-center",
    canDrag && "touch-none",
    zIndexClass,
    transitionClass,
    cursorClass,
    opacityClass,
    chaotic && "animate-node-chaos-drift",
    // A hovered dot's title (see the dotted branch below) sits above its neighbours.
    "has-[[data-dot]:hover]:z-[55]",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = (e: ReactMouseEvent) => {
    // Without this, the click bubbles to .map-canvas's own onClick, which
    // deselects on any click reaching it — so selecting a node and
    // immediately un-selecting it happened in the same tick, and clicking
    // a node looked like it did nothing at all.
    e.stopPropagation();
    onClick(e);
  };

  // What the last press on this node was made with — see handleDoubleClick.
  const lastPointerType = useRef<string>("mouse");
  const handlePointerDown = (e: ReactPointerEvent) => {
    lastPointerType.current = e.pointerType;
    onPointerDown?.(e);
  };

  const handleDoubleClick = (e: ReactMouseEvent) => {
    // Same stopPropagation reasoning as click/contextmenu — a double-click
    // is preceded by two ordinary clicks (already handled above), so this
    // only needs to keep the *dblclick* event itself from reaching the
    // canvas, which has no use for it anyway.
    e.stopPropagation();
    // Only a mouse double-click starts editing. Safari on iPhone/iPad turns
    // two quick taps into a dblclick, so tapping a node to get its menu
    // opened the text editor instead; on touch, editing stays behind the
    // panel's own Edit button.
    if (lastPointerType.current !== "mouse") return;
    onDoubleClick?.();
  };

  const handleContextMenu = (e: ReactMouseEvent) => {
    // Same stopPropagation reasoning as clicks: without it this also
    // reaches .map-canvas's own onContextMenu, which closes everything —
    // right-clicking a node should open its menu, not dismiss it.
    e.stopPropagation();
    // A long press in the caption's own text field is the tablet's
    // Paste/Select bubble: left to the browser.
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    // A finger held on a node is already the long press (multi-select, or a
    // puzzle card's menu, see useNodeDragAndDrop); the phone's own
    // contextmenu for the same hold would select the node over it.
    if (lastPointerType.current === "touch") return;
    onContextMenu?.(e);
  };


  // A weapon node flies in once when it lands (celebrate), from its target's
  // direction, or a hashed one if the target is gone, then sparks.
  const flying = node.isWeapon && !!celebrate;
  const flightStyle = flying
    ? (() => {
        const { x: fx, y: fy } = flightVector ?? flightOffset(node.nodeId);
        return { "--fly-x": `${fx}px`, "--fly-y": `${fy}px` } as CSSProperties;
      })()
    : undefined;

  // Health shows only on the selected node, and never on a Personal map (it's
  // a combat idea). discussionMode undefined means Discussion.
  const showHealth = discussionMode !== false && selected;
  // A Personal map is a calm place to think: no halo/horns, wings or crown
  // badge — just the node's own icon and text.
  const calm = discussionMode === false;

  // The health ring is a conic gradient over two custom properties. When hidden
  // the background is left unset (an inline style would beat any class). The
  // missing part is transparent, so only the health arc itself shows.
  const healthGradient =
    "conic-gradient(var(--ring-color, var(--success)) calc(var(--health, 100) * 3.6deg), transparent 0deg)";
  const ringStyle: CSSProperties = {
    "--health": Math.max(0, Math.min(100, node.health)),
    "--ring-color": node.defeated ? "var(--danger)" : "var(--success)",
    ...(showHealth ? { background: healthGradient } : {}),
    // Selected: a solid accent outline; part of a group selection: dashed.
    outline: selected ? "2px solid var(--accent)" : multiSelected ? "2px dashed var(--accent)" : undefined,
    outlineOffset: 2,
  } as CSSProperties;
  // Invisible until selected, then a fade-in (no hover reveal, which would
  // light up rings one by one across the map).
  const healthVisibilityClass = "bg-transparent transition-[background] duration-150 ease-[ease]";

  const chaosCss = chaotic ? chaosStyle(node.nodeId) : undefined;

  // A strong attack's Pac-Man run (index.css's pacman-node-run and
  // pacman-mouth): the whole node slides out and back, and its own round
  // icon, ring and all, loses a wedge facing the target that starts as the
  // empty part of its health ring and opens wider on the way in.
  const chompRunStyle = chomp
    ? ({
        "--chomp-dx": `${chomp.dx}px`,
        "--chomp-dy": `${chomp.dy}px`,
        "--chomp-lx": `${chomp.lx}px`,
        "--chomp-ly": `${chomp.ly}px`,
      } as CSSProperties)
    : undefined;
  const chompMask = "conic-gradient(from calc(var(--chomp-angle) + 90deg + var(--mouth) / 2), #000 calc(360deg - var(--mouth)), transparent 0)";
  const chompMouthStyle = chomp
    ? ({
        "--chomp-angle": `${chomp.angle}deg`,
        "--mouth-base": `${chompMouth(node.health)}deg`,
        // The whole ring shows while it runs; the mouth is its empty part.
        background: "var(--ring-color, var(--success))",
        maskImage: chompMask,
        WebkitMaskImage: chompMask,
      } as CSSProperties)
    : undefined;

  // One glow wins: a drop highlight, then the inline-editing glow, then the
  // unsolved-problem pulse.
  const ringStateClass =
    dropHighlight === "valid"
      ? "[--drop-glow:var(--success)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--drop-glow)_45%,transparent)] animate-drop-target-pulse"
      : dropHighlight === "invalid"
        ? "[--drop-glow:var(--danger)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--drop-glow)_45%,transparent)] animate-drop-target-pulse"
        : inlineEditing
          ? "shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
          : unsolved
            ? "animate-unsolved-pulse"
            : "";

  // The border color is decided here, not by a class (the inline borderColor
  // would beat it): under fire, then a check/cross override, then the type.
  const circleBorderColor = indicator
    ? "var(--danger)"
    : node.symbolOverride === "check"
      ? ZONE_COLORS.positive
      : node.symbolOverride === "cross"
        ? ZONE_COLORS.negative
        : NODE_TYPE_COLORS[displayType];

  // Counter-scales the node's content against the canvas zoom (constant size
  // when zoomed in, shrinking when zoomed out, nodeZoomScale) times its size
  // tier. On its own inner wrapper because the drift and fly-in keyframes own
  // the outer transform. Cards in the cards view are stickers in canvas units
  // and scale with the zoom instead (utils/cardGlue.ts).
  const canvasCard = puzzle && readingMode === "puzzle";
  const inverseScaleStyle: CSSProperties = { transform: canvasCard ? "none" : `scale(${sizeMultiplier * nodeZoomScale(zoom)})` };

  // A picture card (NodeDoc.cardImage) takes the round icon's place, so the
  // node shows one picture rather than a card stacked over an icon, selected
  // or not. Editing the node inline brings the icon back, since clicking it
  // there cycles the type.
  const showPictureCard = !!node.cardImage && !puzzle && !inlineEditing;
  const cardWidth = selected ? CARD_IMAGE_SELECTED_SIZE : CARD_IMAGE_WIDTH;
  const cardMaxHeight = selected ? CARD_IMAGE_SELECTED_SIZE : CARD_IMAGE_MAX_HEIGHT;

  return (
    <div
      className={`${classes} ${flying ? "animate-weapon-fly-in" : ""} ${chomp ? "pacman-node-run" : ""}`}
      style={{ ...style, ...flightStyle, ...chaosCss, ...chompRunStyle }}
      // The map's entrance (see applyEntranceFrame) grows this node in
      // through the individual CSS `scale` property, which composes with the
      // `transform` the centering and the chaos-drift/fly-in keyframes own.
      data-reveal-node={node.nodeId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onAnimationEnd={() => {
        if (flying) burstParticles(particlesRef.current, WEAPON_PARTICLE_COLORS, 10, 40);
      }}
      title={hoverLabel || dotted ? undefined : node.text}
    >
      {/* relative: the caption, edit input and labels hang off the icon's bottom
      (top-full) rather than in flow, so a node's x/y is always its icon's
      center, captioned or not. */}
      <div className="relative flex w-full flex-col items-center" style={inverseScaleStyle}>
      {dotted && !inlineEditing ? (
        // Zoomed far out: just a point in the node's type color — at that
        // distance icons, cards and badges are only noise, and the dots
        // still show where everything is and what kind it is.
        // The selected node too, ringed by its selection outline.
        // Hovering a dot shows the node's title above it, so a zoomed-out
        // map can still be read point by point.
        <div className="group/dot relative flex justify-center" onPointerEnter={requestText}>
          <div
            data-dot
            className="pointer-events-auto h-3 w-3 rounded-full border border-surface"
            style={{ background: circleBorderColor, outline: ringStyle.outline, outlineOffset: 2 }}
          />
          {captionLabel && (
            <div className="pointer-events-none absolute bottom-[calc(100%+6px)] hidden max-w-[220px] truncate rounded-md border border-line bg-surface px-2 py-[0.15rem] text-[0.75rem] font-semibold whitespace-nowrap text-ink shadow-card group-hover/dot:block">
              {captionLabel}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* The one part of the node that takes the pointer; handlers are on the outer div. */}
      <div
        className={`pointer-events-auto relative ${puzzle || showPictureCard ? "" : "h-[48px] w-[48px]"}`}
        onPointerEnter={(e) => {
          if (e.pointerType === "touch") return;
          onIconHover?.(true);
          if (!hoverLabel) return;
          setHovered(true);
          requestText();
        }}
        onPointerLeave={() => {
          setHovered(false);
          onIconHover?.(false);
        }}
      >
        {!!foldedCount && !dotted && (
          // Auto-packed: the branch tucked into this parent, on the icon's
          // right middle (the step number takes the left), or on a card's top edge.
          <button
            type="button"
            data-testid="auto-pack-count"
            className={`${PACK_PILL_CLASS} ${puzzle ? PACK_PILL_ABOVE : PACK_PILL_NEXT} border-accent text-accent-ink`}
            title={t.ui.autoPack.open(foldedCount)}
            aria-label={t.ui.autoPack.open(foldedCount)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onUnfold?.();
            }}
          >
            +{foldedCount}
          </button>
        )}
        {!foldedCount && onFold && !dotted && !inlineEditing && (
          // An open parent: the same pill packs its branch in (docs/gestures/pack-children.md).
          // Selected, it always shows; otherwise only a mouse hovering the node
          // brings it up, and it lingers a moment so the pointer can cross the
          // gap from the icon to it. A finger never hovers, so on touch it's
          // there only once the node is tapped.
          <button
            type="button"
            data-testid="auto-pack-fold"
            className={`${PACK_PILL_CLASS} ${puzzle ? PACK_PILL_ABOVE : PACK_PILL_NEXT} border-line text-ink-soft ${
              selected ? "" : "invisible transition-[visibility] delay-300 group-hover:visible group-hover:delay-0"
            }`}
            title={t.ui.autoPack.pack}
            aria-label={t.ui.autoPack.pack}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onFold();
            }}
          >
            −
          </button>
        )}
        {hoverLabel && hovered && captionLabel && (
          <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-[6] max-w-[220px] -translate-x-1/2 truncate rounded-md border border-line bg-surface px-2 py-[0.15rem] text-[0.75rem] font-semibold whitespace-nowrap text-ink shadow-card">
            {captionLabel}
          </div>
        )}
        <NodeBadges
          node={node}
          indicator={indicator}
          feeling={feeling}
          packedCount={packedCount}
          parentCrownSentiment={parentCrownSentiment}
          isVariantParent={isVariantParent}
          hiddenBranch={hiddenBranch}
          calm={calm}
        />
        {/* Halo/horns (NodeCrown), shared with QuickAddGhosts. */}
        {!puzzle && !showPictureCard && !calm && (!compact || triumphant) && <NodeCrown type={displayType} symbolOverride={node.symbolOverride} />}
        {/* Wings, before the circle in DOM order so the circle paints over their base. */}
        {!puzzle && !showPictureCard && !calm && (!compact || triumphant) && (
          <NodeWings type={displayType} show={selected || triumphant} symbolOverride={node.symbolOverride} />
        )}
        {/* No weapon badge: the pointer MapPage draws to the target says it's an attack. */}
        <div className="pointer-events-none absolute inset-0 z-[5] overflow-visible" ref={particlesRef} />
        {puzzle ? (
          // Puzzle cards: no icon — a jigsaw piece with the node's whole
          // text (and title), outlined in its type's color. The halo stands
          // in for the round icon's selection outline and drop/unsolved
          // glows, which as box-shadows wouldn't follow the piece's cut. A
          // thin health bar shows for the selected node in place of the
          // round health ring.
          <StickerCard
            // Its type at a glance, as the icon would show it: the emoji in
            // emoji first (its own, else its type's), else the type's symbol.
            typeIcon={(() => {
              const face = nodeEmojiFace(node, emojiFirst, typeEmoji);
              return face.emoji && face.emojiUp ? (
                <span aria-hidden className="text-[13px] leading-none">{face.emoji}</span>
              ) : (
                <NodeTypeSymbol type={displayType} size={13} />
              );
            })()}
            typeLabel={t.ui.types[displayType]}
            color={circleBorderColor}
            fill={cardFill}
            shape={node.cardShape}
            width={node.cardW}
            height={node.cardH}
            fontSize={node.cardFont}
            screenScale={canvasCard ? zoom : sizeMultiplier}
            onResize={onCardResize}
            resizeHint={t.ui.display.resizeCard}
            onConnectStart={onConnectStart}
            connectHint={t.ui.link.dragToConnect}
            onAddBranch={canvasCard ? onAddBranch : undefined}
            addBranchHint={t.ui.contextMenu.createBranch}
            locked={blockLocked}
            onToggleLock={onToggleBlockLock}
            lockLabel={
              onToggleBlockLock
                ? blockLocked
                  ? t.ui.display.unlockBlock
                  : t.ui.display.lockBlock
                : t.ui.display.blockLocked
            }
            minWidth={96}
            maxWidth={selected ? PUZZLE_SELECTED_MAX_WIDTH : PUZZLE_MAX_WIDTH}
            halo={
              dropHighlight === "valid"
                ? { color: "var(--success)", pulse: true }
                : dropHighlight === "invalid"
                  ? { color: "var(--danger)", pulse: true }
                  : selected
                    ? { color: "var(--accent)" }
                    : multiSelected
                      ? { color: "var(--accent)", dashed: true }
                      : unsolved
                        ? { color: "var(--danger)", pulse: true }
                        : null
            }
          >
            {node.cardImage && (
              // The picture card, at the top of the puzzle piece.
              <img src={imageSrc(node.cardImage)} alt="" className="mb-[0.3rem] block max-h-[110px] w-full rounded-[4px] object-cover" draggable={false} />
            )}
            {trimmedTitle && (
              <div className={`text-[1.08em] leading-[1.3] font-semibold break-words ${cardFill ? "" : "text-ink"}`}>{trimmedTitle}</div>
            )}
            <div
              data-testid="puzzle-card-text"
              className={`min-h-0 leading-[1.35] break-words whitespace-pre-wrap ${cardFill ? "" : "text-ink"} ${
                selected && !node.cardH ? "line-clamp-3" : "flex-1 overflow-y-auto overscroll-contain pr-[2px]"
              }`}
              // Longer text scrolls inside the card (a card sized by its
              // owner scrolls within that size); overscroll-contain keeps the
              // wheel from scrolling the canvas once it reaches the end.
              style={selected || node.cardH ? undefined : { maxHeight: `${(PUZZLE_TEXT_MAX_LINES * 1.35).toFixed(2)}em` }}
            >
              {node.text || (trimmedTitle ? "" : "…")}
            </div>
            {showHealth && (
              <div className="mt-[0.35rem] h-[3px] overflow-hidden rounded-[2px] bg-surface-2">
                <div
                  className="h-full"
                  style={{ width: `${healthPct}%`, background: node.defeated ? "var(--danger)" : "var(--success)" }}
                />
              </div>
            )}
          </StickerCard>
        ) : showPictureCard ? (
          // The picture card, in the icon's place: framed in the type's color,
          // with the selection outline and glows the round icon would carry.
          // Undoes the size tier, so it's one size on screen.
          <div
            className={`overflow-hidden rounded-md border-2 bg-surface shadow-card transition-transform duration-150 ease-[ease] group-hover:scale-[1.04] ${ringStateClass}`}
            style={{
              width: cardWidth / sizeMultiplier,
              borderColor: circleBorderColor,
              outline: ringStyle.outline,
              outlineOffset: 2,
            }}
            data-testid="node-picture-card"
          >
            <img
              src={imageSrc(node.cardImage!)}
              alt=""
              className="block w-full object-cover"
              style={{ maxHeight: cardMaxHeight / sizeMultiplier }}
              draggable={false}
            />
          </div>
        ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${shapeRoundClass(node.shape)} p-[3px] transition-transform duration-150 ease-[ease] group-hover:scale-[1.06] ${healthVisibilityClass} ${ringStateClass} ${chomp ? "pacman-mouth" : ""}`}
          style={chompMouthStyle ? { ...ringStyle, ...chompMouthStyle } : ringStyle}
          title={showHealth || hoverLabel ? undefined : t.ui.node.selectToSeeHealth}
        >
          <NodeFace
            node={node}
            displayType={displayType}
            color={circleBorderColor}
            editing={!!inlineEditing}
            onCycleType={() => setDraftType(node.isWeapon ? cycleAttackNodeType : cycleNodeType)}
            emojiFirst={emojiFirst}
            typeEmoji={typeEmoji}
            selected={selected}
            flipToken={flipToken}
          />
        </div>
        )}
      </div>
      {inlineEditing ? (
        <textarea
          ref={inlineFieldRef}
          rows={1}
          maxLength={MAX_NODE_TEXT}
          // Same width as the node; a long text makes it taller (up to
          // max-h, then it scrolls), never wider.
          className="pointer-events-auto absolute top-full left-0 mt-[0.6rem] block select-text [-webkit-touch-callout:default] max-h-[200px] w-full resize-none overflow-y-auto rounded-[4px] border-[1.5px] border-accent bg-surface px-[0.25rem] py-[0.1rem] text-center text-[0.68rem] leading-[1.3] font-medium font-[inherit] text-ink focus:outline-none focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
          autoFocus
          value={draftText}
          placeholder={node.prompt || undefined}
          onChange={(e) => setDraftText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Enter confirms; Shift+Enter adds a row.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              markCanceling();
              e.currentTarget.blur();
            }
          }}
          onBlur={resolveInlineEdit}
        />
      ) : selected || !showCaption || !captionLabel ? null : (
        <div
          // An opaque chip, so lines and zones behind don't cut through the text.
          // CAPTION_WIDTH wide, overhanging the node evenly, and not clickable so it
          // doesn't cover the zone. scale(1/sizeMultiplier) undoes the size tier, so a
          // circle's parent doesn't get a caption wide enough to run into its children.
          className={`absolute top-full left-1/2 ${isNamedZone && !puzzle && !compact ? "mt-[1.3rem]" : "mt-[0.6rem]"} rounded-[3px] bg-surface px-[0.2rem] text-center text-[0.68rem] leading-[1.3] ${ghostPrompt ? "font-normal text-ink-soft italic" : "font-medium text-ink"} ${replayCaption ? "z-10 line-clamp-5 break-words" : iconText ? "line-clamp-4 break-words" : mixed ? "truncate whitespace-nowrap" : "line-clamp-2 break-words"}`}
          style={{
            width: iconText || replayCaption ? ICON_TEXT_CAPTION_WIDTH : CAPTION_WIDTH,
            // translateX(-50%) centers it under the icon (left-1/2 puts its
            // left edge there); scale undoes the size tier, about its top
            // center so it doesn't drift sideways or up into the icon.
            transform: `translateX(-50%) scale(${1 / sizeMultiplier})`,
            transformOrigin: "50% 0",
          }}
        >
          {(iconText || replayCaption) && trimmedTitle && node.text ? (
            <>
              <span className="font-semibold">{trimmedTitle}</span> {node.text}
            </>
          ) : (
            captionLabel
          )}
        </div>
      )}
      {isNamedZone && !puzzle && !compact && !selected && !inlineEditing && (
        // The zone's name sits right under the parent's icon, with the caption
        // pushed below it (see the caption's own top margin). Undoes the size
        // tier the same way the caption does, so it stays a constant size on
        // screen.
        <div
          className="canvas-halo-text absolute top-full left-1/2 mt-[0.15rem] max-w-[10rem] overflow-hidden rounded-[3px] px-[0.3rem] text-[0.6rem] leading-[1.3] font-semibold tracking-[0.04em] text-ellipsis whitespace-nowrap uppercase"
          style={{
            color: ZONE_COLORS[parentCrownSentiment!],
            transform: `translateX(-50%) scale(${1 / sizeMultiplier})`,
            transformOrigin: "50% 0",
          }}
        >
          {node.zoneName}
        </div>
      )}
      {chooseModeActive && !multiSelected && (
        // Absolute like the caption (see the wrapper's own comment) — pushed
        // clear of it when one's showing, since both hang off the icon's
        // bottom edge.
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 text-[0.65rem] font-semibold whitespace-nowrap text-accent"
          style={{ marginTop: !inlineEditing && !selected && showCaption && captionLabel ? "3.4rem" : "0.6rem" }}
        >
          {t.ui.node.chooseHint}
        </div>
      )}
      </>
      )}
      </div>
    </div>
  );
});

import type { NodeType, SymbolOverride } from "../types";
import { NODE_TYPE_COLORS } from "../utils/nodeType";

// Just a colored symbol (check/cross/goal/play/pause) — one per outcome
// NodeType, drawn in that type's own NODE_TYPE_COLORS shade, the same
// color scheme every other border/border-color in this app already uses.
// "unknown" alone keeps the plain NodeTypeIcon glyph instead; there's no
// outcome-specific symbol to give it.
//
// This used to also carry a halo/horns ring around the symbol, wings, and
// the node's own health rendered as that ring's own border — all removed:
// too many separately-colored, separately-positioned pieces sharing one
// SVG canvas kept leaving a visible gap (or, for wings specifically, an
// outright deformed render — see NodeWings's own doc comment) between
// whichever two were least aligned, no matter how each individual gap got
// closed. NodeCard draws its own plain border (same treatment "unknown"
// nodes already had) around whichever glyph — this symbol or
// NodeTypeIcon's — sits inside it, plus its own separate NodeCrown
// (halo/horns) and NodeWings decorations, both straddling/flanking that
// border from *outside* this component entirely — health is NodeCard's
// own single conic-gradient ring around that same border, uniformly for
// every node type. This component's own canvas now stays a single, fixed,
// tightly-cropped size no matter what — nothing about selection, health,
// or anything else ever changes its own scale, which is the whole fix for
// the deformation wings caused: a symbol that never resizes can't deform.
export type OutcomeType = Exclude<NodeType, "unknown">;

export const OUTCOME_TYPES: readonly OutcomeType[] = [
  "Problem",
  "Problematic option",
  "Solution",
  "Option",
  "Success",
  "Fail",
];

// "ring" here is a classification (positive/halo vs negative/horns
// framing) — read by NodeCard's own isOutcome check, NodeCrown, NodeWings,
// its particle-burst color choice, MapPage's own sentiment grouping, and
// WeaponMark's own bow color.
export function ringKindFor(type: NodeType): "halo" | "horns" | undefined {
  return type === "unknown" ? undefined : OUTCOME_CONFIG[type as OutcomeType]?.ring;
}

interface SymbolProps {
  color: string;
}

function CheckSymbol({ color }: SymbolProps) {
  return (
    <polyline
      points="178,152 194,168 224,132"
      fill="none"
      stroke={color}
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function CrossSymbol({ color }: SymbolProps) {
  return (
    <g stroke={color} strokeWidth="10" strokeLinecap="round">
      <line x1="180" y1="130" x2="220" y2="170" />
      <line x1="220" y1="130" x2="180" y2="170" />
    </g>
  );
}

// Option and Problematic option both use this — a choice/branch point,
// framed positively for one and as a risk for the other.
function PlaySymbol({ color }: SymbolProps) {
  return <polygon points="188,128 188,172 226,150" fill={color} />;
}

// Problem: paused, not yet resolved either way.
function PauseSymbol({ color }: SymbolProps) {
  return (
    <g stroke={color} strokeWidth="10" strokeLinecap="round">
      <line x1="185" y1="128" x2="185" y2="172" />
      <line x1="215" y1="128" x2="215" y2="172" />
    </g>
  );
}

// Solution: a target — what the solution is aimed at.
function GoalSymbol({ color }: SymbolProps) {
  return (
    <g stroke={color} strokeWidth="6" fill="none">
      <circle cx="200" cy="150" r="26" />
      <circle cx="200" cy="150" r="14" />
      <circle cx="200" cy="150" r="3" fill={color} stroke="none" />
    </g>
  );
}

const OUTCOME_CONFIG: Record<
  OutcomeType,
  {
    ring: "halo" | "horns";
    Symbol: (p: SymbolProps) => JSX.Element;
  }
> = {
  Success: { ring: "halo", Symbol: CheckSymbol },
  Fail: { ring: "horns", Symbol: CrossSymbol },
  Problem: { ring: "horns", Symbol: PauseSymbol },
  "Problematic option": { ring: "horns", Symbol: PlaySymbol },
  Solution: { ring: "halo", Symbol: GoalSymbol },
  Option: { ring: "halo", Symbol: PlaySymbol },
};

// Every symbol above is drawn within roughly this box (checked against
// each one's own coordinates, plus their stroke widths) — tight enough
// that the glyph actually fills the space it's given instead of sitting
// in a much wider canvas reserved for a ring/wings that live outside this
// component entirely now.
const CONTENT_VIEWBOX = "170 120 60 60";

export function OutcomeBadge({
  type,
  size = 32,
  symbolOverride,
}: {
  type: OutcomeType;
  size?: number;
  /** Manually forces the symbol to a check or a cross regardless of `type` — see Node.symbolOverride. Omit/null for the type's own default. */
  symbolOverride?: SymbolOverride | null;
}) {
  const config = OUTCOME_CONFIG[type];
  const color = NODE_TYPE_COLORS[type];
  const Symbol =
    symbolOverride === "check" ? CheckSymbol : symbolOverride === "cross" ? CrossSymbol : config.Symbol;

  return (
    <svg viewBox={CONTENT_VIEWBOX} width={size} height={size} style={{ display: "block" }} aria-hidden="true">
      <Symbol color={color} />
    </svg>
  );
}

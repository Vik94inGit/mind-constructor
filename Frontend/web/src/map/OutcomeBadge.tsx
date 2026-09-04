import { useId } from "react";
import type { NodeType, SymbolOverride } from "../types";

// Replaces the old bespoke AngelIcon/DevilIcon illustrations with one shared
// badge: a circular shell + a ring (halo or horns) + wings + a swappable
// inner symbol. Every non-"unknown" NodeType gets one now — the negative
// framing (horns) for Fail/Problem/Problematic option, positive (halo) for
// Success/Solution/Option — with the symbol as the one thing that actually
// varies per type. "unknown" alone keeps the plain NodeTypeIcon glyph;
// there's no outcome to frame it as.
export type OutcomeType = Exclude<NodeType, "unknown">;

// So callers (NodeCard's glow class, the "is this an outcome badge" check)
// don't have to duplicate the classification OUTCOME_CONFIG already encodes.
export const OUTCOME_TYPES: readonly OutcomeType[] = [
  "Problem",
  "Problematic option",
  "Solution",
  "Option",
  "Success",
  "Fail",
];
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
// framed positively (halo) for one and as a risk (horns) for the other.
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

// Halo/Horns both need one of these behind them (id supplied by the
// caller's own idFor, so many badges on one page never collide).
function RingGlowFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  );
}

function Halo({ idFor, color }: { idFor: (name: string) => string; color: string }) {
  return (
    <ellipse
      cx="200"
      cy="82"
      rx="42"
      ry="11"
      fill="none"
      stroke={color}
      strokeWidth="7"
      filter={`url(#${idFor("ring-glow")})`}
    />
  );
}

function Horns({ idFor, color }: { idFor: (name: string) => string; color: string }) {
  return (
    <g fill={color} filter={`url(#${idFor("ring-glow")})`}>
      <path d="M 160 108 C 148 88 150 66 166 52 C 158 72 160 92 172 106 Z" />
      <path d="M 240 108 C 252 88 250 66 234 52 C 242 72 240 92 228 106 Z" />
    </g>
  );
}

// Simple, flat-shape wings — not the original AngelIcon/DevilIcon's
// feather-by-feather illustrations (too much detail to read at icon size),
// just enough silhouette to say "wings" at a glance. Rendered behind the
// face/ring so they read as flanking it, not overlapping it. Angel wings
// are smooth curves; devil wings are angular, bat-membrane-like — same
// distinction the original illustrations made, simplified.
function Wings({ color, kind }: { color: string; kind: "angel" | "devil" }) {
  if (kind === "angel") {
    return (
      <g fill={color} fillOpacity="0.85">
        <path d="M 150,150.2 C 137.4,143.5 124,136.8 109.7,126.7 C 96.2,117.4 85.3,105.7 77.8,92.2 C 75.2,88 71.9,88.9 71.9,93.9 C 72.7,105.7 77.8,118.3 86.2,129.2 C 79.4,126.7 72.7,122.5 66.8,116.6 C 63.5,113.2 60.1,114.9 61.8,119.1 C 66.8,130.9 75.2,141 86.2,148.5 C 80.3,147.7 74.4,145.2 69.4,141.8 C 66,139.3 62.6,141.8 65.2,145.2 C 72.7,154.4 83.6,161.1 96.2,164.5 C 92,165.3 87.8,164.5 83.6,162.8 C 80.3,161.1 77.8,164.5 81.1,167 C 91.2,173.7 103.8,176.2 115.6,173.7 C 125.6,171.2 134.9,165.3 141.6,157.8 C 145,154.4 147.5,151.9 150,150.2 Z" />
        <path d="M 250,150.2 C 262.6,143.5 276,136.8 290.3,126.7 C 303.8,117.4 314.7,105.7 322.2,92.2 C 324.8,88 328.1,88.9 328.1,93.9 C 327.3,105.7 322.2,118.3 313.8,129.2 C 320.6,126.7 327.3,122.5 333.2,116.6 C 336.5,113.2 339.9,114.9 338.2,119.1 C 333.2,130.9 324.8,141 313.8,148.5 C 319.7,147.7 325.6,145.2 330.6,141.8 C 334,139.3 337.4,141.8 334.8,145.2 C 327.3,154.4 316.4,161.1 303.8,164.5 C 308,165.3 312.2,164.5 316.4,162.8 C 319.7,161.1 322.2,164.5 318.9,167 C 308.8,173.7 296.2,176.2 284.4,173.7 C 274.4,171.2 265.1,165.3 258.4,157.8 C 255,154.4 252.5,151.9 250,150.2 Z" />
      </g>
    );
  }
  return (
    <g fill={color} fillOpacity="0.85">
      <path d="M 150,150 L 75,90 Q 104.9,124.7 61,118 Q 100.5,140.7 59,148 Q 105.2,155.8 78,173 Q 105,164.4 150,150 Z" />
      <path d="M 250,150 L 325,90 Q 295.1,124.7 339,118 Q 299.5,140.7 341,148 Q 294.8,155.8 322,173 Q 295,164.4 250,150 Z" />
    </g>
  );
}

// Wings get their own color, independent of the type's ringColor/faceColor
// (which stay whatever the type's own framing calls for — red for a
// negative type's face/horns, say) — angel wings are always dark blue,
// devil wings are always dark gray, regardless of which specific type
// they're on.
const WING_COLOR: Record<"angel" | "devil", string> = {
  angel: "#1e3a8a",
  devil: "#3f3f46",
};

const OUTCOME_CONFIG: Record<
  OutcomeType,
  {
    ring: "halo" | "horns";
    wings: "angel" | "devil";
    ringColor: string;
    faceColor: string;
    Symbol: (p: SymbolProps) => JSX.Element;
  }
> = {
  Success: { ring: "halo", wings: "angel", ringColor: "#ffd54f", faceColor: "#00b0ff", Symbol: CheckSymbol },
  Fail: { ring: "horns", wings: "devil", ringColor: "#ff3d00", faceColor: "#ff3d00", Symbol: CrossSymbol },
  Problem: { ring: "horns", wings: "devil", ringColor: "#ff3d00", faceColor: "#ff3d00", Symbol: PauseSymbol },
  "Problematic option": { ring: "horns", wings: "devil", ringColor: "#ff3d00", faceColor: "#ff3d00", Symbol: PlaySymbol },
  Solution: { ring: "halo", wings: "angel", ringColor: "#ffd54f", faceColor: "#00b0ff", Symbol: GoalSymbol },
  Option: { ring: "halo", wings: "angel", ringColor: "#ffd54f", faceColor: "#00b0ff", Symbol: PlaySymbol },
};

// The halo/horns/face art was drawn for a spacious rectangular card, so it
// only fills the middle of its 400x300 canvas — fine at card scale, but at
// icon scale most of that box was empty and the badge read as a blank dot.
// This viewBox is cropped to the actual content — wider than a tight crop
// around just the face would need, on purpose, to leave room for wings
// flanking it without clipping them.
const CONTENT_VIEWBOX = "56 44 288 168";
const CONTENT_ASPECT = 168 / 288;

export function OutcomeBadge({
  type,
  size = 80,
  symbolOverride,
}: {
  type: OutcomeType;
  size?: number;
  /** Manually forces the inner symbol to a check or a cross regardless of `type` — see Node.symbolOverride. Omit/null for the type's own default. */
  symbolOverride?: SymbolOverride | null;
}) {
  const uid = useId();
  const idFor = (name: string) => `${uid}${name}`;
  const config = OUTCOME_CONFIG[type];
  const Symbol =
    symbolOverride === "check" ? CheckSymbol : symbolOverride === "cross" ? CrossSymbol : config.Symbol;

  return (
    <svg
      viewBox={CONTENT_VIEWBOX}
      width={size}
      height={size * CONTENT_ASPECT}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <RingGlowFilter id={idFor("ring-glow")} />
        <filter id={idFor("face-glow")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <Wings color={WING_COLOR[config.wings]} kind={config.wings} />

      {config.ring === "halo" ? (
        <Halo idFor={idFor} color={config.ringColor} />
      ) : (
        <Horns idFor={idFor} color={config.ringColor} />
      )}

      <circle cx="200" cy="150" r="54" fill="#111" stroke={config.faceColor} strokeWidth="4" filter={`url(#${idFor("face-glow")})`} />
      <circle cx="200" cy="150" r="44" fill="none" stroke={config.faceColor} strokeOpacity="0.35" strokeWidth="2" />

      <Symbol color={config.faceColor} />
    </svg>
  );
}

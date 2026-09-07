import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { WEAPON_ARROW_COUNT } from "../utils/nodeType";
import type { WeaponIcon } from "../types";

// How often a landed attack re-fires at its target on its own, with no
// click needed — was 3s, bumped up (shorter interval = more frequent) since
// that read as too sparse for a map with several attacks going at once.
const AUTO_SHOT_INTERVAL_MS = 1500;

// NodeCard's own icon is a 60px-diameter circle (see its `h-[60px] w-[60px]`
// container) — half that, plus a small gap, is how far off the weapon
// node's own center the bow needs to sit to read as *next to* that node
// instead of drawn on top of/inside its icon. It's drawn on its own SVG
// layer above every node (see MapPage) specifically to be visible at all;
// centering it exactly on the node it belongs to just traded "hidden
// behind the icon" for "stamped on top of it" instead of actually landing
// beside it.
const NODE_ICON_RADIUS = 30;
const BOW_GAP = 26;

interface Props {
  /** The weapon node's own position — the bow is drawn just outside this, offset toward the target, always facing it. */
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  weaponIcon: WeaponIcon | undefined;
  /** The bow and its arrows both draw in this color — var(--danger) (red) for an ordinary attack, but a *positive*-claim retaliation (see Backend's attackAbl.ts — a weapon node can carry any outcome type now, not just the negative-framed ones) reads oddly in red, so callers pass a blue instead when the weapon node's own type is halo-classified. See MapPage's own weapon-mark rendering for which. */
  color: string;
  /** True once, the instant this attack lands this session — same contract
   * NodeCard's own `celebrate` prop uses: only the value at first mount
   * matters (see the useState below), so the arrows' initial flight plays
   * exactly once even though the flag itself (MapPage's celebrateIds) stays
   * true forever after, on every later re-render. */
  celebrate: boolean;
  /** Bumped to a new value to replay the flight on demand — clicking either
   * end of this attack (see triggerWeaponShot in MapPage.tsx). 0 means "no
   * replay requested". */
  replayNonce: number;
}

// One consistent bow-and-arrows mark for every landed attack, replacing the
// old per-weapon icon (sword/axe/spear) and its always-on pointer: the bow
// itself is the only permanent fixture (which way this attack is aimed),
// and the arrow count — not a different shape — is what tells nitpick,
// counterpoint and fatal flaw apart (see WEAPON_ARROW_COUNT). The arrows
// themselves are transient: they fly from the bow to the target and fade
// out right as they arrive, not a permanent connecting line.
export function WeaponMark({ x, y, targetX, targetY, weaponIcon, color, celebrate, replayNonce }: Props) {
  const fullDx = targetX - x;
  const fullDy = targetY - y;
  const fullDist = Math.hypot(fullDx, fullDy) || 1;
  const angle = (Math.atan2(fullDy, fullDx) * 180) / Math.PI;
  // Offset along the same line toward the target, capped so a weapon node
  // sitting unusually close to it still leaves the bow between the two
  // rather than overshooting past the target altogether.
  const offset = Math.min(NODE_ICON_RADIUS + BOW_GAP, fullDist * 0.4);
  const bowX = x + (fullDx / fullDist) * offset;
  const bowY = y + (fullDy / fullDist) * offset;
  const dist = fullDist - offset;
  const arrowCount = WEAPON_ARROW_COUNT[weaponIcon ?? "sword"];

  // One key for "the arrows are currently playing, with this identity" —
  // three independent things can set it, each just needing a genuinely new
  // value to force the arrow elements to remount (which is what actually
  // restarts a CSS animation; an unchanged className wouldn't):
  //   1. Mount, but only if `celebrate` was already true right then — read
  //      from the live prop on every render instead, this would replay the
  //      flight on every unrelated update, since celebrateIds never
  //      actually clears an id once added.
  //   2. A click on either end of this attack (replayNonce, from MapPage).
  //   3. A standing loop, below (AUTO_SHOT_INTERVAL_MS) — every attack
  //      keeps re-firing at its target on its own, not just the moment it
  //      lands or gets clicked.
  const [playKey, setPlayKey] = useState<string | null>(() => (celebrate ? "mount" : null));
  const prevNonce = useRef(replayNonce);
  useEffect(() => {
    if (replayNonce && replayNonce !== prevNonce.current) {
      prevNonce.current = replayNonce;
      setPlayKey(`shot-${replayNonce}`);
    }
  }, [replayNonce]);
  useEffect(() => {
    const id = setInterval(() => setPlayKey(`auto-${Date.now()}`), AUTO_SHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <g
      style={{
        transform: `translate(${bowX}px, ${bowY}px) rotate(${angle}deg)`,
        transition: "transform 0.35s ease",
      }}
    >
      {/* The bow: static, always visible, facing the target — this attack's
          launcher. Drawn as a simple arc + string rather than any of the
          old per-weapon icons. */}
      <path d="M -2,-11 Q 7,0 -2,11" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <line x1={-2} y1={-11} x2={-2} y2={11} stroke={color} strokeWidth={1} opacity={0.6} />
      {playKey !== null &&
        Array.from({ length: arrowCount }, (_, i) => (
          <g
            key={`${playKey}-${i}`}
            className="animate-weapon-arrow-fly"
            style={{ "--arrow-dist": `${dist}px`, animationDelay: `${i * 110}ms` } as CSSProperties}
          >
            <path d="M -3,-3 L 6,0 L -3,3 Z" fill={color} />
          </g>
        ))}
    </g>
  );
}

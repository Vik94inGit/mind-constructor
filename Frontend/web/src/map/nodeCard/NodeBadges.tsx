import { ZONE_COLORS } from "../../utils/nodeType";
import type { Sentiment } from "../../utils/nodeType";
import { FEELING_COLOR, FEELING_EMOJI } from "../../utils/feeling";
import type { Feeling } from "../../utils/feeling";
import { KnightHelmet } from "../KnightHelmet";
import { useI18n } from "../../i18n/I18nContext";
import type { AttackIndicator, NodeDoc } from "../../types";

interface Props {
  node: NodeDoc;
  indicator?: AttackIndicator;
  feeling?: Feeling;
  packedCount?: number;
  parentCrownSentiment?: Sentiment;
  /** A circle parent that itself hangs from another node: a helmet, not a crown. */
  isVariantParent: boolean;
  hiddenBranch: boolean;
  /** A Personal map: no crown. */
  calm: boolean;
}

/**
 * The small badges around a node's round icon. Each has its own spot so
 * several can show at once: under fire top-right, crown top-left, packed
 * count bottom-right, shield bottom-left, step number (or the hidden-branch
 * eye) left middle, the viewer's feeling right middle, and the imitated
 * opponent's flag on the top edge.
 */
export function NodeBadges({ node, indicator, feeling, packedCount, parentCrownSentiment, isVariantParent, hiddenBranch, calm }: Props) {
  const { t } = useI18n();
  return (
    <>
    {indicator && (
      <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-danger text-[0.65rem] font-bold text-white">
        {indicator.incomingNegativeEdges}
      </div>
    )}
    {node.order != null && (
      <div
        className="absolute top-1/2 -left-3 z-[6] flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[0.65rem] leading-none font-bold text-white"
        title={t.ui.node.orderBadge(node.order)}
      >
        {node.order}
      </div>
    )}
    {feeling && (
      <div
        className="absolute top-1/2 -right-3 z-[6] flex h-[1.4rem] w-[1.4rem] -translate-y-1/2 items-center justify-center rounded-full border-2 text-[0.8rem] leading-none"
        style={{ borderColor: FEELING_COLOR[feeling], background: `color-mix(in srgb, ${FEELING_COLOR[feeling]} 22%, var(--surface, #fff))` }}
        title={t.ui.feelings.badge(t.ui.feelings.names[feeling])}
        data-testid="feeling-badge"
      >
        <span key={feeling} aria-hidden="true" className="inline-block animate-feeling-pop">
          {FEELING_EMOJI[feeling]}
        </span>
        <span className="sr-only">{t.ui.feelings.badge(t.ui.feelings.names[feeling])}</span>
      </div>
    )}
    {!!packedCount && (
      <div className="absolute -right-2 -bottom-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-accent text-[0.65rem] font-bold text-white">
        {packedCount}
      </div>
    )}
    {parentCrownSentiment && !calm && (
      <div
        className="absolute -top-2.5 -left-2.5 flex h-[1.45rem] w-[1.45rem] items-center justify-center rounded-full border-[1.5px] bg-surface text-[0.8rem] leading-none"
        style={{ color: ZONE_COLORS[parentCrownSentiment], borderColor: ZONE_COLORS[parentCrownSentiment] }}
        title={(isVariantParent ? t.ui.node.variantParent : t.ui.node.circleParent)(t.ui.sentiments[parentCrownSentiment])}
      >
        {isVariantParent ? <KnightHelmet size={17} sentiment={parentCrownSentiment} /> : "👑"}
      </div>
    )}
    {hiddenBranch && (
      <div
        className="absolute top-1/2 -left-3 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-soft"
        title={t.ui.visibility.badge}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1.5 8 C3.2 4.8 5.4 3.4 8 3.4 C10.6 3.4 12.8 4.8 14.5 8 C12.8 11.2 10.6 12.6 8 12.6 C5.4 12.6 3.2 11.2 1.5 8 Z" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <circle cx="8" cy="8" r="1.9" fill="currentColor" />
          <path d="M2.5 13.5 L13.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    )}
    {node.byOpponent && (
      <div
        className="absolute -top-2.5 left-1/2 z-[6] flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-surface bg-danger text-[0.65rem] text-white"
        title={t.ui.siege.finish.opponentMove}
      >
        ⚑
      </div>
    )}
    {node.isProtection && (
      <div className="absolute -bottom-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface text-[0.7rem]">
        🛡️
      </div>
    )}
    </>
  );
}

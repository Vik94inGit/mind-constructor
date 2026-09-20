import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPES } from "../types";
import { NodeTypeSymbol } from "./NodeTypeSymbol";

// The strip along the bottom of the map: every node type's symbol, plus what
// the green/red zone colors mean.
//
// whitespace-nowrap on every item: without it, a long label ("Problematic
// option", "negative circle / under fire") had nothing stopping it from
// wrapping *inside* its own flex item on a narrow screen — text breaking
// mid-phrase while the icon/dot sat oddly on its own line above it — instead
// of flex-wrap doing its actual job of moving the *whole* item down to the
// next row. Tighter gap/padding/font too, so more items fit per row before
// any wrapping is needed at all.
export function MapLegend() {
  const { t } = useI18n();
  const item = "flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft";
  const dot = "mr-[0.3rem] inline-block h-2 w-2 flex-shrink-0 rounded-full";
  return (
    <div className="flex flex-wrap gap-[0.3rem] border-t border-line bg-surface px-3 py-[0.45rem]">
      {NODE_TYPES.map((nt) => (
        <span key={nt} className={item}>
          <NodeTypeSymbol type={nt} size={13} />
          {nt}
        </span>
      ))}
      <span className={item}>
        <span className={dot} style={{ background: "var(--success)" }} />
        {t.map.legend.positiveCircle}
      </span>
      <span className={item}>
        <span className={dot} style={{ background: "var(--danger)" }} />
        {t.map.legend.negativeCircle}
      </span>
    </div>
  );
}

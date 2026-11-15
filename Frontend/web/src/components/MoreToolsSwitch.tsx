import { useI18n } from "../i18n/I18nContext";
import { useMoreTools } from "../hooks/useMoreTools";

// The "More tools" switch (utils/moreTools.ts): shows every tool, or only the
// basics. One small text button, the same on the dashboard and the map.
export function MoreToolsSwitch({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { moreTools, setMoreTools } = useMoreTools();
  const s = t.ui.moreTools;
  return (
    <button
      type="button"
      data-testid="more-tools"
      aria-pressed={moreTools}
      title={moreTools ? s.hideTitle : s.showTitle}
      onClick={() => setMoreTools(!moreTools)}
      className={`inline-flex min-h-7 cursor-pointer items-center justify-center rounded-md border border-line bg-transparent px-2 text-[0.72rem] leading-[1.15] font-semibold text-ink hover:bg-surface-2 ${className}`}
    >
      {moreTools ? s.hide : s.show}
    </button>
  );
}

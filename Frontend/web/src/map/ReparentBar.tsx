import { useI18n } from "../i18n/I18nContext";

// Same bottom-sheet slot NodePanel and PackPickerPanel use, kept short so the
// map above it stays free for tapping: while a node's parent is being changed
// it says which node, and that the next node tapped becomes its parent.
const PANEL_CLASS =
  "fixed inset-x-0 bottom-0 z-[46] w-full rounded-t-2xl border-t border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]";

interface Props {
  childName: string;
  error: string | null;
  onCancel: () => void;
}

export function ReparentBar({ childName, error, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <div className={PANEL_CLASS} data-reparent-bar>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[0.95rem] font-bold text-ink">{t.ui.canvas.reparentPick(childName)}</p>
          <p className="m-0 mt-[0.15rem] text-[0.78rem] text-ink-soft">{t.ui.canvas.reparentHint}</p>
        </div>
        <button
          type="button"
          className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent px-[0.7rem] py-[0.35rem] text-[0.8rem] font-semibold text-ink hover:bg-surface-2"
          onClick={onCancel}
        >
          {t.ui.common.cancel}
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.6rem] text-[0.85rem] text-danger">{error}</div>
      )}
    </div>
  );
}

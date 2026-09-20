import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { SelectionMenu } from "./SelectionMenu";

interface Props {
  count: number;
  /** Choose mode is on (tap nodes to add them) rather than a plain marquee/shift selection. */
  chooseMode: boolean;
  onLink: () => void;
  onNumber: () => void;
  onClearNumbers: () => void;
  onCopy: () => void;
  onCopyText: () => void;
  onGroupCircle: () => void;
  onDelete: () => void;
  /** Done (choose mode) / Deselect — drops the whole selection. */
  onDone: () => void;
}

const btn =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

// Group selection takes over the bottom-sheet slot instead of NodePanel — a
// single node's panel doesn't make sense once this mode is active (even with
// just one node caught by a small marquee: MapPage's marquee always clears
// `selectedId` once it resolves, size 1 or more, so NodePanel would never
// mount for it either way). Move (drag any selected node) plus the Actions
// dropdown (see SelectionMenu) and Deselect; per-node editing/attacking
// still needs dropping back to a single selection first.
export function SelectionBar({ count, chooseMode, onLink, onNumber, onClearNumbers, onCopy, onCopyText, onGroupCircle, onDelete, onDone }: Props) {
  const { t } = useI18n();
  // The "Actions" dropdown's own open/closed state.
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const then = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[46] flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className="text-[0.88rem] font-semibold text-ink">
          {count === 0 ? t.ui.selection.tapToChoose : chooseMode ? t.ui.selection.chosen(count) : t.ui.selection.selected(count)}
        </span>
        {chooseMode && <span className="hidden text-[0.72rem] text-ink-soft md:inline">{t.ui.selection.finishHint}</span>}
        <div className="relative">
          <button className={btn} disabled={count === 0} onClick={() => setMenuOpen((v) => !v)}>
            {t.ui.selection.actions}
          </button>
          {menuOpen && (
            <SelectionMenu
              count={count}
              canGroupCircle={count >= 2}
              canLink={count >= 2}
              onLink={then(onLink)}
              onNumber={then(onNumber)}
              onClearNumbers={then(onClearNumbers)}
              onClose={close}
              onCopy={then(onCopy)}
              onCopyText={then(onCopyText)}
              onGroupCircle={then(onGroupCircle)}
              onDelete={then(onDelete)}
            />
          )}
        </div>
      </div>
      <button className={btn} onClick={onDone} title={chooseMode ? t.ui.selection.finishHint : undefined}>
        {chooseMode ? t.ui.common.done : t.ui.selection.deselect}
      </button>
    </div>
  );
}

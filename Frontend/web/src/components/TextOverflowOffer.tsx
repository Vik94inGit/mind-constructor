import { MAX_NODE_TEXT, splitNodeText } from "../utils/nodeText";
import { useI18n } from "../i18n/I18nContext";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold transition-[background-color] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The offer shown when pasted text runs past a node's MAX_NODE_TEXT
 * (utils/nodeText.ts pasteKeepingOverflow): put the rest in a new node (or
 * as many as it takes) carrying on from this one, or leave it out. Where the
 * node doesn't exist yet (NewNodePanel, QuickNote), accepting only marks the
 * rest to go along once it's made, and `accepted` shows that with an undo.
 */
export function TextOverflowOffer({
  rest,
  accepted = false,
  busy = false,
  className = "",
  onCarry,
  onLeave,
  onUndo,
}: {
  rest: string;
  accepted?: boolean;
  busy?: boolean;
  className?: string;
  onCarry: () => void;
  onLeave: () => void;
  onUndo?: () => void;
}) {
  const { t } = useI18n();
  const s = t.ui.textOverflow;
  const nodes = splitNodeText(rest).length;
  return (
    <div
      role="status"
      data-testid="text-overflow-offer"
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface px-[0.8rem] py-[0.55rem] text-[0.82rem] text-ink ${className}`}
    >
      <span className="min-w-[12rem] flex-1">{accepted ? s.willCarry(nodes) : s.message(rest.length, MAX_NODE_TEXT)}</span>
      <span className="ml-auto flex flex-wrap items-center gap-1">
        {accepted ? (
          <button type="button" className={`${btn} border-line bg-transparent text-ink hover:bg-surface-2`} disabled={busy} onClick={onUndo}>
            {s.undo}
          </button>
        ) : (
          <>
            <button type="button" className={`${btn} border-accent bg-accent text-white`} disabled={busy} onClick={onCarry}>
              {s.carry(nodes)}
            </button>
            <button type="button" className={`${btn} border-transparent bg-transparent text-ink hover:bg-surface-2`} disabled={busy} onClick={onLeave}>
              {s.leave}
            </button>
          </>
        )}
      </span>
    </div>
  );
}

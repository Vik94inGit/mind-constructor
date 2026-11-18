import { useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { useDismiss } from "../../hooks/useDismiss";
import type { CopyScope } from "../../utils/copyScopes";

interface Props {
  copied: boolean;
  /** What else this node can copy besides its own text: the zone it heads or sits in, the tree above it. */
  scopes?: { zone: boolean; above: boolean };
  onCopy: (scope: CopyScope) => void;
}

const BUTTON =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

// The Info tab's Copy button. A node alone in its branch copies its own text
// straight away; one in a zone or under a parent opens a short list first:
// this node, the whole zone, or the tree above it. It opens upward, over the
// text, so the bottom of a phone's panel never cuts it off.
export function CopyMenu({ copied, scopes, onCopy }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useDismiss(wrapRef, () => setOpen(false), { enabled: open });
  const hasMore = !!scopes && (scopes.zone || scopes.above);

  const pick = (scope: CopyScope) => {
    setOpen(false);
    onCopy(scope);
  };
  const item =
    "block w-full cursor-pointer rounded-md px-3 py-2 text-left text-[0.82rem] text-ink hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        data-copy-text
        className={BUTTON}
        aria-haspopup={hasMore ? "menu" : undefined}
        aria-expanded={hasMore ? open : undefined}
        onClick={() => (hasMore ? setOpen((v) => !v) : onCopy("node"))}
      >
        {copied ? t.ui.common.copied : t.ui.common.copy}
        {hasMore && <span aria-hidden>▾</span>}
      </button>
      {open && hasMore && (
        <div
          role="menu"
          aria-label={t.ui.node.copyWhat}
          data-copy-menu
          className="absolute bottom-full left-0 z-30 mb-1 min-w-[11rem] rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          <button type="button" role="menuitem" data-copy-scope="node" className={item} onClick={() => pick("node")}>
            {t.ui.node.copyNode}
          </button>
          {scopes!.zone && (
            <button type="button" role="menuitem" data-copy-scope="zone" className={item} title={t.ui.node.copyZoneTitle} onClick={() => pick("zone")}>
              {t.ui.node.copyZone}
            </button>
          )}
          {scopes!.above && (
            <button type="button" role="menuitem" data-copy-scope="above" className={item} title={t.ui.node.copyAboveTitle} onClick={() => pick("above")}>
              {t.ui.node.copyAbove}
            </button>
          )}
        </div>
      )}
    </span>
  );
}

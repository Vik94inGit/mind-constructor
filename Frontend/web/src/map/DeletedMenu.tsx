import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { useKeepOnScreen } from "../hooks/useKeepOnScreen";
import type { DeletedEntry } from "../hooks/useDeletedNodes";
import { useDismiss } from "../hooks/useDismiss";

interface Props {
  entries: DeletedEntry[];
  onRestore: (id: number) => void;
  side?: "below" | "right";
  buttonClass: string;
}

// The toolbar's 🗑 button, shown once something was deleted on this map since
// it was opened: a list of those deletions, newest first, each with Restore.
// Kept until the map is closed (see hooks/useDeletedNodes.ts).
export function DeletedMenu({ entries, onRestore, side = "below", buttonClass }: Props) {
  const { t } = useI18n();
  const s = t.ui.deleted;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onScreen = useKeepOnScreen(menuRef);

  useDismiss(ref, () => setOpen(false), { enabled: open });

  useEffect(() => {
    if (entries.length === 0) setOpen(false);
  }, [entries.length]);

  if (entries.length === 0) return null;
  const count = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`${buttonClass} relative`}
        title={s.button(count)}
        aria-label={s.button(count)}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🗑
        <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-accent px-[0.2rem] text-[0.6rem] leading-[1rem] text-white">
          {count}
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          style={onScreen}
          className={`absolute ${side === "right" ? "left-[calc(100%+0.5rem)] top-0" : "left-0 top-[calc(100%+0.4rem)]"} z-[60] flex w-[min(260px,calc(100vw-2rem))] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card`}
        >
          <div className="px-[0.5rem] pb-[0.2rem] pt-[0.3rem] text-[0.72rem] text-ink-soft">{s.hint}</div>
          <ul className="flex max-h-[50vh] flex-col gap-[0.15rem] overflow-y-auto">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-[6px] px-[0.5rem] py-[0.35rem] hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate text-[0.82rem] text-ink">
                  {e.label || s.untitled}
                  {e.count > 1 && <span className="text-ink-soft"> {s.more(e.count - 1)}</span>}
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-md border border-line bg-transparent px-[0.5rem] py-[0.2rem] text-[0.75rem] font-semibold text-ink hover:bg-surface"
                  onClick={() => onRestore(e.id)}
                >
                  {s.restore}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

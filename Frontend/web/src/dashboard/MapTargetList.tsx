import { useI18n } from "../i18n/I18nContext";
import type { MapDoc } from "../types";
import { MapIcon } from "./LibraryTile";
import { secondaryBtn } from "./FolderModal";

// The list of maps to move something to, and the Cancel row under it, shared
// by "Move to a map" on an Inbox note and the cards view's "Move N to another
// map". `list` is null while the maps are still loading.
export function MapTargetList({
  list,
  targets,
  loadFailed,
  busy,
  emptyText,
  listClassName = "",
  onPick,
  onCancel,
}: {
  list: MapDoc[] | null;
  targets: MapDoc[];
  loadFailed: boolean;
  busy: boolean;
  /** Shown when the maps have loaded and none of them can take it. */
  emptyText?: string;
  listClassName?: string;
  onPick: (target: MapDoc) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const s = t.ui.inbox;
  return (
    <>
      {!list && !loadFailed && <p className="text-[0.85rem] text-ink-soft">{s.loading}</p>}
      {list && targets.length === 0 && emptyText && <p className="text-[0.85rem] text-ink-soft">{emptyText}</p>}
      <div className={`flex flex-col gap-1 ${listClassName}`}>
        {targets.map((m) => (
          <button
            key={m.mapId}
            type="button"
            disabled={busy}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-[0.9rem] text-ink hover:bg-surface-2 disabled:cursor-wait"
            onClick={() => onPick(m)}
          >
            <MapIcon color={m.color} />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-[1.2rem] flex items-center justify-end gap-3">
        {busy && <span className="text-[0.8rem] text-ink-soft">{s.moving}</span>}
        <button type="button" className={secondaryBtn} onClick={onCancel}>
          {s.cancel}
        </button>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import * as mapsApi from "../api/maps";
import { Modal } from "../components/Modal";
import { ApiRequestError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { moveNoteToMap, moveTargets } from "../utils/inbox";
import type { MapDoc, NodeDoc } from "../types";
import { MapIcon } from "./LibraryTile";
import { secondaryBtn } from "./FolderModal";

// "Move to a map" on an Inbox note: pick the map, one tap moves the note (and
// anything hanging from it) there. `maps` is the dashboard's list when it has
// one; the canvas leaves it out and the list is fetched here.
export function MoveNoteModal({
  inboxId,
  noteId,
  noteText,
  maps,
  onClose,
  onMoved,
}: {
  inboxId: string;
  noteId: string;
  noteText: string;
  maps?: MapDoc[];
  onClose: () => void;
  onMoved: (target: MapDoc, created: NodeDoc[]) => void;
}) {
  const { t } = useI18n();
  const s = t.ui.inbox;
  const [list, setList] = useState<MapDoc[] | null>(maps ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (maps) return;
    mapsApi
      .listMaps("all")
      .then(setList)
      .catch(() => setError(s.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function move(target: MapDoc) {
    setError(null);
    setBusy(true);
    try {
      const created = await moveNoteToMap(inboxId, noteId, target);
      onMoved(target, created);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : s.moveError);
      setBusy(false);
    }
  }

  const targets = list ? moveTargets(list, inboxId) : [];

  return (
    <Modal title={s.moveTitle} onClose={onClose}>
      <p className="mb-3 line-clamp-3 text-[0.85rem] text-ink-soft">{noteText.trim() || s.untitled}</p>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      {!list && !error && <p className="text-[0.85rem] text-ink-soft">{s.loading}</p>}
      {list && targets.length === 0 && <p className="text-[0.85rem] text-ink-soft">{s.noTargets}</p>}
      <div className="flex flex-col gap-1">
        {targets.map((m) => (
          <button
            key={m.mapId}
            type="button"
            disabled={busy}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-[0.9rem] text-ink hover:bg-surface-2 disabled:cursor-wait"
            onClick={() => move(m)}
          >
            <MapIcon color={m.color} />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-[1.2rem] flex items-center justify-end gap-3">
        {busy && <span className="text-[0.8rem] text-ink-soft">{s.moving}</span>}
        <button type="button" className={secondaryBtn} onClick={onClose}>
          {s.cancel}
        </button>
      </div>
    </Modal>
  );
}

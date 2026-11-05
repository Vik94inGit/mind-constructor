import { useEffect, useState } from "react";
import * as mapsApi from "../api/maps";
import { ApiRequestError } from "../api/client";
import { Modal } from "../components/Modal";
import { MapIcon } from "../dashboard/LibraryTile";
import { primaryBtn, secondaryBtn } from "../dashboard/FolderModal";
import { useI18n } from "../i18n/I18nContext";
import { moveNoteToMap, moveTargets } from "../utils/inbox";
import type { MapDoc } from "../types";

// The cards view's "Move N to another map" (utils/cardFit.ts): the top cards
// past what fits the screen go, each with its branch, to a map picked here or
// to a new one made for them. Moved one at a time, each only taken off this
// map once it's all on the other, so a failure never loses a card.
export function MoveCardsModal({
  map,
  rootIds,
  onClose,
  onMoved,
}: {
  map: MapDoc;
  rootIds: string[];
  onClose: () => void;
  onMoved: (movedRootIds: string[], target: MapDoc) => void;
}) {
  const { t } = useI18n();
  const s = t.ui.inbox;
  const c = t.ui.cardFit;
  const [list, setList] = useState<MapDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mapsApi
      .listMaps("all")
      .then(setList)
      .catch(() => setError(s.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveTo(pick: () => Promise<MapDoc>) {
    setError(null);
    setBusy(true);
    const moved: string[] = [];
    let target: MapDoc | null = null;
    try {
      target = await pick();
      for (const id of rootIds) {
        await moveNoteToMap(map.mapId, id, target);
        moved.push(id);
      }
      onMoved(moved, target);
    } catch (err) {
      if (target && moved.length > 0) onMoved(moved, target);
      setError(err instanceof ApiRequestError ? err.message : s.moveError);
      setBusy(false);
    }
  }

  function newMap() {
    return mapsApi.createMap({
      name: c.newMapName(map.name),
      ownerColor: "#22c55e",
      color: map.color,
      discussionMode: map.discussionMode !== false,
    });
  }

  const targets = list ? moveTargets(list, map.mapId) : [];

  return (
    <Modal title={c.moveTitle(rootIds.length)} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <button type="button" disabled={busy} className={`${primaryBtn} mb-3 w-full`} onClick={() => void moveTo(newMap)}>
        {c.newMap}
      </button>
      {!list && !error && <p className="text-[0.85rem] text-ink-soft">{s.loading}</p>}
      <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
        {targets.map((m) => (
          <button
            key={m.mapId}
            type="button"
            disabled={busy}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-[0.9rem] text-ink hover:bg-surface-2 disabled:cursor-wait"
            onClick={() => void moveTo(async () => m)}
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

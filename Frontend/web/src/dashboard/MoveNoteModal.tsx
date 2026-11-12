import { useEffect, useState } from "react";
import * as mapsApi from "../api/maps";
import { Modal } from "../components/Modal";
import { ApiRequestError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { moveNoteToMap, moveTargets } from "../utils/inbox";
import type { MapDoc, NodeDoc } from "../types";
import { MapTargetList } from "./MapTargetList";
import { ErrorBanner } from "../components/ErrorBanner";

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
      <ErrorBanner message={error} />
      <MapTargetList
        list={list}
        targets={targets}
        loadFailed={!!error && !list}
        busy={busy}
        emptyText={s.noTargets}
        onPick={(m) => void move(m)}
        onCancel={onClose}
      />
    </Modal>
  );
}

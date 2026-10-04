import { useState } from "react";
import * as foldersApi from "../api/folders";
import { Modal } from "../components/Modal";
import { ApiRequestError } from "../api/client";
import type { FolderDoc, MapDoc } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { FolderIcon } from "./LibraryTile";
import { folderOfMap } from "./library";
import { secondaryBtn } from "./FolderModal";

// Pick which of your folders a map goes in — or none. One tap moves it.
export function MoveToFolderModal({
  map,
  folders,
  onClose,
  onMoved,
}: {
  map: MapDoc;
  folders: FolderDoc[];
  onClose: () => void;
  onMoved: (mapId: string, folderId: string | null) => void;
}) {
  const { t } = useI18n();
  const copy = t.dashboard.library;
  const current = folderOfMap(folders, map.mapId)?.folderId ?? null;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(folderId: string | null) {
    if (folderId === current) return onClose();
    setError(null);
    setBusy(true);
    try {
      await foldersApi.moveMapToFolder(map.mapId, folderId);
      onMoved(map.mapId, folderId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : copy.moveModal.error);
      setBusy(false);
    }
  }

  const options: { id: string | null; name: string }[] = [
    { id: null, name: copy.moveModal.noFolder },
    ...[...folders].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ id: f.folderId, name: f.name })),
  ];

  return (
    <Modal title={copy.moveModal.title(map.name)} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <button
            key={o.id ?? "none"}
            type="button"
            disabled={busy}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left text-[0.9rem] hover:bg-surface-2 disabled:cursor-wait ${
              o.id === current ? "border-accent bg-accent-soft text-accent-ink" : "border-transparent text-ink"
            }`}
            onClick={() => move(o.id)}
          >
            <FolderIcon className="h-6 w-6 shrink-0" muted={o.id === null} />
            <span className="truncate">{o.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-[1.2rem] flex justify-end">
        <button type="button" className={secondaryBtn} onClick={onClose}>
          {copy.folderModal.cancel}
        </button>
      </div>
    </Modal>
  );
}

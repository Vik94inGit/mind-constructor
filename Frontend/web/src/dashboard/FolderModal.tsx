import { useState } from "react";
import type { FormEvent } from "react";
import * as foldersApi from "../api/folders";
import { Modal } from "../components/Modal";
import { ApiRequestError } from "../api/client";
import type { FolderDoc } from "../types";
import { useI18n } from "../i18n/I18nContext";

// Create a folder, or rename `folder` when one is given.
export function FolderModal({
  folder,
  onClose,
  onSaved,
}: {
  folder?: FolderDoc;
  onClose: () => void;
  onSaved: (folder: FolderDoc) => void;
}) {
  const { t } = useI18n();
  const copy = t.dashboard.library.folderModal;
  const [name, setName] = useState(folder?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSaved(folder ? await foldersApi.renameFolder(folder.folderId, trimmed) : await foldersApi.createFolder(trimmed));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={folder ? copy.renameTitle : copy.createTitle} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="folder-name" className="text-[0.8rem] font-semibold text-ink-soft">
            {copy.name}
          </label>
          <input
            id="folder-name"
            required
            autoFocus
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
          />
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            {copy.cancel}
          </button>
          <button type="submit" className={primaryBtn} disabled={busy || !trimmed || trimmed === folder?.name}>
            {folder ? copy.save : copy.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export const secondaryBtn =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
export const primaryBtn =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

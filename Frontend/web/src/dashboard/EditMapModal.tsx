import { useState } from "react";
import type { FormEvent } from "react";
import * as mapsApi from "../api/maps";
import { Modal } from "../components/Modal";
import { ColorPicker } from "../components/ColorPicker";
import { ApiRequestError } from "../api/client";
import type { MapDoc } from "../types";
import { useI18n } from "../i18n/I18nContext";

// Rename the map / change its board color — the first real UI on top of
// PATCH /api/:mapId (updateMap), which until now had no caller anywhere in
// the app. Only name/color are exposed here; x/y are the canvas's own
// concern, not something a form should let you hand-edit.
export function EditMapModal({
  map,
  onClose,
  onSaved,
}: {
  map: MapDoc;
  onClose: () => void;
  onSaved: (map: MapDoc) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(map.name);
  const [color, setColor] = useState(map.color || "#e08a3e");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedName = name.trim();
  const dirty = trimmedName !== map.name || color !== (map.color || "#e08a3e");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updates: Partial<Pick<MapDoc, "name" | "color">> = {};
      if (trimmedName !== map.name) updates.name = trimmedName;
      if (color !== (map.color || "#e08a3e")) updates.color = color;
      const updated = await mapsApi.updateMap(map.mapId, updates);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.dashboard.editModal.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t.dashboard.editModal.title(map.name)} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="edit-map-name" className="text-[0.8rem] font-semibold text-ink-soft">
            {t.dashboard.editModal.name}
          </label>
          <input
            id="edit-map-name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
          />
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">{t.dashboard.editModal.boardColor}</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            {t.dashboard.editModal.cancel}
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !trimmedName || !dirty}
          >
            {busy ? t.dashboard.editModal.submitting : t.dashboard.editModal.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import * as mapsApi from "../api/maps";
import { Modal } from "../components/Modal";
import { ColorPicker } from "../components/ColorPicker";
import { ApiRequestError } from "../api/client";
import type { MapDoc, MapKind } from "../types";
import { seedMapKind } from "../utils/seedMap";
import { useI18n } from "../i18n/I18nContext";

// Mirrors the backend's MAP_TEMPLATES keys (see abl/mapAbl.ts) — the
// label/description pairs shown in CreateMapModal's "Starting point"
// picker below, now read from the active translation (t.dashboard.
// createModal.templates) instead of a hardcoded English pair, so this list
// only has to know the *order* and which value maps to which translation
// key.
const MAP_KIND_KEYS: MapKind[] = ["problem", "decision", "goal", "retro"];

export function CreateMapModal({ onClose, onCreated }: { onClose: () => void; onCreated: (map: MapDoc) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [ownerColor, setOwnerColor] = useState("#22c55e");
  const [color, setColor] = useState("#e08a3e");
  const [kind, setKind] = useState<MapKind>("problem");
  // Discussion (battle) or Personal (creating) — the owner can switch it later on the map itself.
  const [discussionMode, setDiscussionMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const map = await mapsApi.createMap({ name, ownerColor, color, kind, discussionMode });
      await seedMapKind(map.mapId, kind, t.ui.templates.nodes);
      onCreated(map);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.dashboard.createModal.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t.dashboard.createModal.title} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="map-name" className="text-[0.8rem] font-semibold text-ink-soft">
            {t.dashboard.createModal.name}
          </label>
          <input
            id="map-name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
          />
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">{t.dashboard.createModal.ownerColor}</label>
          <ColorPicker value={ownerColor} onChange={setOwnerColor} />
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">{t.dashboard.createModal.boardColor}</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">{t.dashboard.createModal.startingPoint}</label>
          <div className="grid grid-cols-2 gap-[0.5rem]">
            {MAP_KIND_KEYS.map((value) => {
              const label = t.dashboard.createModal.templates[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={`cursor-pointer rounded-lg border px-[0.7rem] py-[0.55rem] text-left transition-[background-color,border-color] duration-[120ms] ${
                    kind === value ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className={`text-[0.82rem] font-semibold ${kind === value ? "text-accent-ink" : "text-ink"}`}>
                    {label.label}
                  </div>
                  <div className="mt-[0.1rem] text-[0.72rem] text-ink-soft">{label.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">{t.dashboard.createModal.mode.label}</label>
          <div className="grid grid-cols-2 gap-[0.5rem]">
            {([true, false] as const).map((isDiscussion) => {
              const label = isDiscussion ? t.dashboard.createModal.mode.discussion : t.dashboard.createModal.mode.personal;
              return (
                <button
                  key={String(isDiscussion)}
                  type="button"
                  onClick={() => setDiscussionMode(isDiscussion)}
                  className={`cursor-pointer rounded-lg border px-[0.7rem] py-[0.55rem] text-left transition-[background-color,border-color] duration-[120ms] ${
                    discussionMode === isDiscussion ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div
                    className={`text-[0.82rem] font-semibold ${discussionMode === isDiscussion ? "text-accent-ink" : "text-ink"}`}
                  >
                    {label.label}
                  </div>
                  <div className="mt-[0.1rem] text-[0.72rem] text-ink-soft">{label.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            {t.dashboard.createModal.cancel}
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !name}
          >
            {busy ? t.dashboard.createModal.submitting : t.dashboard.createModal.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from "react";
import { Modal } from "../components/Modal";
import { CheckInForm, EMPTY_CHECK_IN } from "../components/CheckInForm";
import type { CheckInValue } from "../components/CheckInForm";
import * as stateApi from "../api/state";
import { useI18n } from "../i18n/I18nContext";
import { FEELING_EMOJI, checkInEntry } from "../utils/feeling";
import type { CheckIn, CheckInEntry } from "../utils/feeling";
import type { MapDoc } from "../types";
import { primaryBtn, secondaryBtn } from "./FolderModal";

// "How do you feel now?" from a map's menu on the dashboard: the after of the
// map's check-in (utils/feeling.ts), for a map whose canvas prompt was waved
// off, or to check in again.
export function CheckInModal({
  map,
  before,
  onClose,
  onSaved,
}: {
  map: MapDoc;
  before: CheckInEntry;
  onClose: () => void;
  onSaved: (checkIn: CheckIn) => void;
}) {
  const { t } = useI18n();
  const tf = t.ui.feelings;
  const [value, setValue] = useState<CheckInValue>(EMPTY_CHECK_IN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value.feeling) return;
    const checkIn: CheckIn = { before, after: checkInEntry(value.feeling, value.strength) };
    setBusy(true);
    setError(null);
    try {
      await stateApi.saveMapViewState(map.mapId, { checkIn });
      onSaved(checkIn);
    } catch {
      setError(tf.checkInFailed);
      setBusy(false);
    }
  }

  return (
    <Modal title={map.name} onClose={onClose}>
      <CheckInForm
        question={tf.after}
        hint={`${tf.beforeWas(`${FEELING_EMOJI[before.feeling]} ${before.strength}`)} · ${tf.afterHint}`}
        value={value}
        onChange={setValue}
      />
      {error && <p className="mt-3 mb-0 text-[0.85rem] text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={secondaryBtn} onClick={onClose}>
          {tf.notNow}
        </button>
        <button type="button" className={primaryBtn} disabled={!value.feeling || busy} onClick={save}>
          {tf.save}
        </button>
      </div>
    </Modal>
  );
}

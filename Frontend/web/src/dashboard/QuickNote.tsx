import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiRequestError } from "../api/client";
import { addQuickNote } from "../utils/inbox";
import { MAX_NODE_TEXT } from "../utils/nodeText";
import type { MapDoc } from "../types";

// A box on the dashboard for a thought that has no map yet: it goes to the
// Inbox map (utils/inbox.ts) in one step. The installed app's "Quick note"
// shortcut opens the dashboard with this box focused (?note=1).
export function QuickNote({ maps, autoFocus, onSaved }: { maps: MapDoc[]; autoFocus?: boolean; onSaved: (map: MapDoc, created: boolean) => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const s = t.dashboard.quickNote;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<MapDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const note = text.trim();
    if (!note || !user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { map, created } = await addQuickNote(note, maps, user._id, s.inboxName);
      setText("");
      setSaved(map);
      onSaved(map, created);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : s.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-2" aria-label={s.title}>
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          maxLength={MAX_NODE_TEXT}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void onSubmit(e);
          }}
          placeholder={s.placeholder}
          aria-label={s.title}
          className="min-h-[2.8rem] flex-1 resize-y rounded-lg border border-line bg-surface px-[0.8rem] py-[0.5rem] text-[0.9rem] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 cursor-pointer rounded-lg border border-accent bg-accent px-[0.9rem] py-[0.55rem] text-[0.85rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s.save}
        </button>
      </div>
      {error && <p className="m-0 text-[0.8rem] text-danger">{error}</p>}
      {saved && (
        <p className="m-0 text-[0.8rem] text-ink-soft">
          {s.saved}{" "}
          <Link to={`/maps/${saved.mapId}`} className="font-semibold text-accent-ink">
            {s.open(saved.name)}
          </Link>
        </p>
      )}
    </form>
  );
}

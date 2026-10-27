import { useState } from "react";
import { Link } from "react-router-dom";
import * as nodesApi from "../api/nodes";
import * as mapsApi from "../api/maps";
import { useI18n } from "../i18n/I18nContext";
import { unsortedNotes } from "../utils/inbox";
import type { MapDoc, NodeDoc } from "../types";
import { MoveNoteModal } from "./MoveNoteModal";

// Under the quick note box: how many notes wait in the Inbox, and — opened —
// each of them with "Move to a map", so the Inbox can be sorted without
// leaving the dashboard. Hidden while the Inbox is empty.
export function InboxTray({
  inbox,
  maps,
  onMoved,
}: {
  inbox: MapDoc;
  maps: MapDoc[];
  /** A note left the Inbox: `count` nodes went with it to `target`. */
  onMoved: (target: MapDoc, count: number) => void;
}) {
  const { t } = useI18n();
  const s = t.ui.inbox;
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NodeDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<NodeDoc | null>(null);
  const [moved, setMoved] = useState<MapDoc | null>(null);
  const count = inbox.nodeCount ?? 0;

  async function load() {
    setError(null);
    try {
      const list = unsortedNotes(await nodesApi.listNodes(inbox.mapId));
      // The node list leaves each note's text out.
      const text = list.length ? await mapsApi.getNodesText(inbox.mapId, list.map((n) => n.nodeId)) : {};
      setNotes(list.map((n) => ({ ...n, text: text[n.nodeId] ?? n.text })));
    } catch {
      setError(s.loadError);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    setMoved(null);
    if (next) void load();
  }

  if (count === 0 && !moved) return null;

  return (
    <div className="mb-6 rounded-card border border-line bg-surface p-3 shadow-card" data-inbox-tray>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[0.85rem] font-semibold text-ink">
          📥 {inbox.name} · <span data-inbox-count>{s.unsorted(count)}</span>
        </span>
        {count > 0 && (
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg border border-line px-[0.7rem] py-[0.3rem] text-[0.8rem] font-semibold text-ink hover:bg-surface-2"
            aria-expanded={open}
            onClick={toggle}
          >
            {open ? s.hide : s.sort}
          </button>
        )}
      </div>
      {moved && (
        <p className="m-0 mt-2 text-[0.8rem] text-ink-soft">
          {s.moved(moved.name)}{" "}
          <Link to={`/maps/${moved.mapId}`} className="font-semibold text-accent-ink">
            {s.openMap(moved.name)}
          </Link>
        </p>
      )}
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          {error && <p className="m-0 text-[0.8rem] text-danger">{error}</p>}
          {!notes && !error && <p className="m-0 text-[0.8rem] text-ink-soft">{s.loading}</p>}
          {notes?.map((n) => (
            <div key={n.nodeId} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
              <span className="min-w-0 flex-1 truncate text-[0.85rem] text-ink">{n.text.trim() || n.title || s.untitled}</span>
              <button
                type="button"
                className="shrink-0 cursor-pointer rounded-md border border-line px-2 py-[0.2rem] text-[0.75rem] font-semibold text-accent-ink hover:bg-surface"
                onClick={() => setMoving(n)}
              >
                {s.moveToMap}
              </button>
            </div>
          ))}
          <Link to={`/maps/${inbox.mapId}`} className="mt-1 self-start text-[0.8rem] font-semibold text-accent-ink">
            {s.open} →
          </Link>
        </div>
      )}
      {moving && (
        <MoveNoteModal
          inboxId={inbox.mapId}
          noteId={moving.nodeId}
          noteText={moving.text}
          maps={maps}
          onClose={() => setMoving(null)}
          onMoved={(target, created) => {
            setNotes((prev) => prev?.filter((x) => x.nodeId !== moving.nodeId) ?? null);
            setMoving(null);
            setMoved(target);
            onMoved(target, created.length);
          }}
        />
      )}
    </div>
  );
}

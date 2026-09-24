import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { buildNodeClipboard, writeNodeClipboard } from "../utils/nodeClipboard";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";
import { ColorPicker } from "../components/ColorPicker";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { MapSummaryModal } from "../components/MapSummaryModal";
import { MapPeopleModal } from "../components/MapPeopleModal";
import { CardMenu } from "../components/CardMenu";
import { ApiRequestError } from "../api/client";
import type { MapDoc, MapKind } from "../types";
import { seedMapKind } from "../utils/seedMap";
import { useI18n } from "../i18n/I18nContext";
import type { Translation } from "../i18n/translations";

type Filter = mapsApi.MapFilter;

// Mirrors the backend's MAP_TEMPLATES keys (see abl/mapAbl.ts) — the
// label/description pairs shown in CreateMapModal's "Starting point"
// picker below, now read from the active translation (t.dashboard.
// createModal.templates) instead of a hardcoded English pair, so this list
// only has to know the *order* and which value maps to which translation
// key.
const MAP_KIND_KEYS: MapKind[] = ["problem", "decision", "goal", "retro"];

export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [maps, setMaps] = useState<MapDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A confirmation (e.g. "Copied 12 nodes…") — shown until the next action.
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteMap, setInviteMap] = useState<MapDoc | null>(null);
  const [editMap, setEditMap] = useState<MapDoc | null>(null);
  const [summaryMap, setSummaryMap] = useState<MapDoc | null>(null);
  // Which card's Members / Owner button was pressed. Both popups read what
  // the maps list already carries (see the backend's getMapsDao), so they open
  // instantly — nothing is fetched on click.
  const [people, setPeople] = useState<{ map: MapDoc; view: "members" | "owner" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const loaded = await mapsApi.listMaps(filter);
      setMaps(loaded);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.dashboard.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // "Copy map content": puts every node of the map (with the connections among
  // them) on the app's clipboard — open another map and paste it there.
  async function handleCopyMap(map: MapDoc) {
    setError(null);
    setNotice(null);
    try {
      const [mapNodes, mapEdges] = await Promise.all([nodesApi.listNodes(map.mapId), edgesApi.listEdges(map.mapId)]);
      if (mapNodes.length === 0) {
        setNotice(t.ui.clipboard.mapEmpty(map.name));
        return;
      }
      // The node list leaves each node's own text out (see the backend's
      // getNodesByMapDao); one bulk request fills it in.
      const textById = await mapsApi.getNodesText(map.mapId, mapNodes.map((n) => n.nodeId));
      const clipboard = buildNodeClipboard(
        map.mapId,
        mapNodes.map((n) => ({ ...n, text: n.text ?? "" })),
        null,
        textById,
        mapEdges,
      );
      if (!clipboard) {
        setNotice(t.ui.clipboard.mapEmpty(map.name));
      } else if (!writeNodeClipboard(clipboard)) {
        setError(t.ui.clipboard.storeFailed);
      } else {
        setNotice(t.ui.clipboard.mapCopied(clipboard.nodes.length, map.name));
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.clipboard.copyFailed);
    }
  }

  async function handleDelete(map: MapDoc) {
    if (!confirm(t.dashboard.deleteConfirm(map.name))) return;
    await mapsApi.deleteMap(map.mapId);
    setMaps((prev) => prev.filter((m) => m.mapId !== map.mapId));
  }

  const filterLabels: Record<Filter, string> = {
    all: t.dashboard.filter.all,
    owned: t.dashboard.filter.owned,
    shared: t.dashboard.filter.shared,
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">{t.dashboard.title}</h1>
          <p className="mt-[0.2rem] mb-0 text-[0.9rem] text-ink-soft">{t.dashboard.subtitle}</p>
        </div>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setShowCreate(true)}
        >
          {t.dashboard.newMap}
        </button>
      </div>

      <div className="mb-5 flex gap-[0.4rem]">
        {(["all", "owned", "shared"] as Filter[]).map((f) => (
          <button
            key={f}
            className={`cursor-pointer rounded-[20px] border border-transparent px-[0.85rem] py-[0.4rem] text-[0.82rem] font-semibold ${
              filter === f ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-soft"
            }`}
            onClick={() => setFilter(f)}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg bg-success-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-success">{notice}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-ink-soft">{t.dashboard.loading}</div>
      ) : maps.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-6 py-12 text-center text-ink-soft">
          {t.dashboard.empty} {filter !== "owned" ? "" : t.dashboard.emptyOwnedHint}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {maps.map((map) => {
            const isOwner = map.ownerId === user?._id;
            return (
              <div
                key={map.mapId}
                className="relative flex flex-col gap-2 rounded-card border border-line bg-surface p-[1.1rem] shadow-card transition-transform duration-[120ms] hover:-translate-y-0.5"
                onClick={() => navigate(`/maps/${map.mapId}`)}
              >
                <div
                  className="h-[6px] w-[calc(100%-2.2rem)] rounded-[4px]"
                  style={{ background: map.color || "var(--accent)" }}
                />
                <h3 className="m-0 pr-[1.9rem] text-[1.05rem] font-bold">{map.name}</h3>
                {map.kind && (
                  <div className="text-[0.72rem] font-semibold tracking-[0.03em] text-ink-soft uppercase">
                    {t.dashboard.createModal.templates[map.kind].label}
                    {" · "}
                    {(map.discussionMode === false
                      ? t.dashboard.createModal.mode.personal
                      : t.dashboard.createModal.mode.discussion
                    ).label}
                  </div>
                )}
                <div className="flex flex-wrap gap-[0.6rem] text-[0.78rem] text-ink-soft">
                  {/* Members / Owner: buttons, not badges — each opens who's on
                      this map. They stop the click so the card doesn't also
                      navigate into the map. */}
                  <button
                    type="button"
                    className={chipBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPeople({ map, view: "members" });
                    }}
                  >
                    {t.dashboard.card.members(map.memberCount ?? 0)}
                  </button>
                  <button
                    type="button"
                    className={`${chipBtn} ${isOwner ? "border-accent bg-accent-soft text-accent-ink" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPeople({ map, view: "owner" });
                    }}
                  >
                    {t.dashboard.card.owner}
                  </button>
                  {map.nodeCount !== undefined && (
                    <span className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft">
                      {t.dashboard.card.nodes(map.nodeCount)}
                    </span>
                  )}
                </div>
                <div className="absolute top-[0.6rem] right-[0.6rem]" onClick={(e) => e.stopPropagation()}>
                  <CardMenu
                    items={[
                      { label: t.dashboard.menu.summary, onClick: () => setSummaryMap(map) },
                      { label: t.ui.clipboard.copyMap, onClick: () => handleCopyMap(map) },
                      ...(isOwner
                        ? [
                            { label: t.dashboard.menu.edit, onClick: () => setEditMap(map) },
                            { label: t.dashboard.menu.invite, onClick: () => setInviteMap(map) },
                            { label: t.dashboard.menu.delete, danger: true, onClick: () => handleDelete(map) },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateMapModal
          onClose={() => setShowCreate(false)}
          onCreated={(map) => {
            setShowCreate(false);
            navigate(`/maps/${map.mapId}`);
          }}
        />
      )}

      {inviteMap && (
        <InviteMemberModal
          map={inviteMap}
          onClose={() => setInviteMap(null)}
          onInvited={(updated) =>
            setMaps((prev) =>
              prev.map((m) =>
                m.mapId === updated.mapId
                  ? // `updated` is a full-detail MapDoc (real `members`, no
                    // memberCount — see inviteUserToMapDao's own populate),
                    // but this list otherwise only ever holds the lighter
                    // list shape (see MapDoc's own doc comment) — derive
                    // memberCount here so the card's own badge doesn't
                    // read back as 0 until the next reload.
                    {
                      ...m,
                      ...updated,
                      memberCount: Array.isArray(updated.members) ? updated.members.length : m.memberCount,
                      // Only a populated member list carries usernames; a bare id list doesn't.
                      memberNames: Array.isArray(updated.members)
                        ? updated.members.flatMap((mem) => (typeof mem === "string" ? [] : [mem.username]))
                        : m.memberNames,
                    }
                  : m,
              ),
            )
          }
        />
      )}

      {editMap && (
        <EditMapModal
          map={editMap}
          onClose={() => setEditMap(null)}
          onSaved={(updated) => {
            // Merged over the card, not swapped for it: the update response is
            // a map's full detail and carries none of the list-only fields
            // (owner/member names, node count).
            setMaps((prev) => prev.map((m) => (m.mapId === updated.mapId ? { ...m, ...updated } : m)));
            setEditMap(null);
          }}
        />
      )}

      {summaryMap && <MapSummaryModal map={summaryMap} onClose={() => setSummaryMap(null)} />}

      {people && (
        <MapPeopleModal map={people.map} view={people.view} currentUserId={user?._id} onClose={() => setPeople(null)} />
      )}
    </div>
  );
}

const chipBtn =
  "inline-flex cursor-pointer items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] font-semibold text-ink-soft transition-[background-color,border-color] duration-[120ms] hover:border-accent hover:text-ink";

function CreateMapModal({ onClose, onCreated }: { onClose: () => void; onCreated: (map: MapDoc) => void }) {
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

// Rename the map / change its board color — the first real UI on top of
// PATCH /api/:mapId (updateMap), which until now had no caller anywhere in
// the app. Only name/color are exposed here; x/y are the canvas's own
// concern, not something a form should let you hand-edit.
function EditMapModal({
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


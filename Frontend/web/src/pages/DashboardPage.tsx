import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as mapsApi from "../api/maps";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";
import { ColorPicker } from "../components/ColorPicker";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { MapSummaryModal } from "../components/MapSummaryModal";
import { CardMenu } from "../components/CardMenu";
import { ApiRequestError } from "../api/client";
import type { MapDoc, MapTemplate } from "../types";

type Filter = mapsApi.MapFilter;

// Mirrors the backend's MAP_TEMPLATES keys (see abl/mapAbl.ts) — the label/
// description pairs shown in CreateMapModal's "Starting point" picker below.
// Order here is the order they're offered in.
const TEMPLATE_OPTIONS: { value: MapTemplate; label: string; description: string }[] = [
  { value: "blank", label: "Blank canvas", description: "Start from nothing." },
  { value: "single-problem", label: "Single Problem", description: "One root node to branch off." },
  {
    value: "decision-tree",
    label: "Decision tree",
    description: "A Problem with two Options already branched off it.",
  },
  {
    value: "pro-con",
    label: "Pro / Con",
    description: "A topic with one case-for and one case-against branch.",
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [maps, setMaps] = useState<MapDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteMap, setInviteMap] = useState<MapDoc | null>(null);
  const [editMap, setEditMap] = useState<MapDoc | null>(null);
  const [summaryMap, setSummaryMap] = useState<MapDoc | null>(null);
  // mapId -> node count, from GET /:mapId/summary. Fetched per-card after the
  // list loads rather than blocking the initial render on it — listMaps()
  // itself doesn't carry a node count, only the summary endpoint does.
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const loaded = await mapsApi.listMaps(filter);
      setMaps(loaded);
      loadNodeCounts(loaded);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load maps");
    } finally {
      setLoading(false);
    }
  }

  // Best-effort, one request per map, each independent — one map's summary
  // failing (e.g. it was deleted a moment ago) shouldn't blank out every
  // other card's count.
  async function loadNodeCounts(forMaps: MapDoc[]) {
    const results = await Promise.all(
      forMaps.map(async (m) => {
        try {
          const summary = await mapsApi.getMapSummary(m.mapId);
          return [m.mapId, summary.nodeCount] as const;
        } catch {
          return null;
        }
      }),
    );
    setNodeCounts((prev) => {
      const next = { ...prev };
      for (const r of results) if (r) next[r[0]] = r[1];
      return next;
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleDelete(map: MapDoc) {
    if (!confirm(`Delete "${map.name}"? This removes every node on it too.`)) return;
    await mapsApi.deleteMap(map.mapId);
    setMaps((prev) => prev.filter((m) => m.mapId !== map.mapId));
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">Your maps</h1>
          <p className="mt-[0.2rem] mb-0 text-[0.9rem] text-ink-soft">Boards you own or were invited to.</p>
        </div>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setShowCreate(true)}
        >
          + New map
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
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-ink-soft">Loading maps…</div>
      ) : maps.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-6 py-12 text-center text-ink-soft">
          No maps here yet. {filter !== "owned" ? "" : "Create one to get started."}
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
                <div className="flex flex-wrap gap-[0.6rem] text-[0.78rem] text-ink-soft">
                  <span className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft">
                    {map.memberCount ?? 0} member(s)
                  </span>
                  {map.mapId in nodeCounts && (
                    <span className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft">
                      {nodeCounts[map.mapId]} node(s)
                    </span>
                  )}
                  {isOwner && (
                    <span className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft">
                      Owner
                    </span>
                  )}
                </div>
                <div className="absolute top-[0.6rem] right-[0.6rem]" onClick={(e) => e.stopPropagation()}>
                  <CardMenu
                    items={[
                      { label: "Summary", onClick: () => setSummaryMap(map) },
                      ...(isOwner
                        ? [
                            { label: "Edit", onClick: () => setEditMap(map) },
                            { label: "Invite", onClick: () => setInviteMap(map) },
                            { label: "Delete", danger: true, onClick: () => handleDelete(map) },
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
                    { ...updated, memberCount: Array.isArray(updated.members) ? updated.members.length : m.memberCount }
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
            setMaps((prev) => prev.map((m) => (m.mapId === updated.mapId ? updated : m)));
            setEditMap(null);
          }}
        />
      )}

      {summaryMap && <MapSummaryModal map={summaryMap} onClose={() => setSummaryMap(null)} />}
    </div>
  );
}

function CreateMapModal({ onClose, onCreated }: { onClose: () => void; onCreated: (map: MapDoc) => void }) {
  const [name, setName] = useState("");
  const [ownerColor, setOwnerColor] = useState("#22c55e");
  const [color, setColor] = useState("#e08a3e");
  const [template, setTemplate] = useState<MapTemplate>("blank");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const map = await mapsApi.createMap({ name, ownerColor, color, template });
      onCreated(map);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to create map");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New map" onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="map-name" className="text-[0.8rem] font-semibold text-ink-soft">
            Name
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
          <label className="text-[0.8rem] font-semibold text-ink-soft">Your color on this map</label>
          <ColorPicker value={ownerColor} onChange={setOwnerColor} />
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">Board color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label className="text-[0.8rem] font-semibold text-ink-soft">Starting point</label>
          <div className="grid grid-cols-2 gap-[0.5rem]">
            {TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTemplate(opt.value)}
                className={`cursor-pointer rounded-lg border px-[0.7rem] py-[0.55rem] text-left transition-[background-color,border-color] duration-[120ms] ${
                  template === opt.value
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                <div
                  className={`text-[0.82rem] font-semibold ${template === opt.value ? "text-accent-ink" : "text-ink"}`}
                >
                  {opt.label}
                </div>
                <div className="mt-[0.1rem] text-[0.72rem] text-ink-soft">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !name}
          >
            {busy ? "Creating…" : "Create map"}
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
      setError(err instanceof ApiRequestError ? err.message : "Failed to update map");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit "${map.name}"`} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="edit-map-name" className="text-[0.8rem] font-semibold text-ink-soft">
            Name
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
          <label className="text-[0.8rem] font-semibold text-ink-soft">Board color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !trimmedName || !dirty}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


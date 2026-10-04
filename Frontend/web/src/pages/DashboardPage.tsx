import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import * as foldersApi from "../api/folders";
import { buildNodeClipboard, writeNodeClipboard } from "../utils/nodeClipboard";
import { useAuth } from "../context/AuthContext";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { MapSummaryModal } from "../components/MapSummaryModal";
import { MapPeopleModal } from "../components/MapPeopleModal";
import { ApiRequestError } from "../api/client";
import type { FolderDoc, MapDoc } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { ThinkEntry } from "../dashboard/ThinkEntry";
import { CreateMapModal } from "../dashboard/CreateMapModal";
import { EditMapModal } from "../dashboard/EditMapModal";
import { FolderModal, primaryBtn, secondaryBtn } from "../dashboard/FolderModal";
import { MoveToFolderModal } from "../dashboard/MoveToFolderModal";
import { FolderIcon, LibraryTile, MapIcon } from "../dashboard/LibraryTile";
import { libraryItems, paginate } from "../dashboard/library";

type Filter = mapsApi.MapFilter;

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
  // The dashboard as a file browser: your own folders, the one open (null:
  // the top level), a name search across everything, and paging.
  const [folders, setFolders] = useState<FolderDoc[]>([]);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // null: closed; {}: creating a folder; { folder }: renaming that one.
  const [folderModal, setFolderModal] = useState<{ folder?: FolderDoc } | null>(null);
  const [moveMap, setMoveMap] = useState<MapDoc | null>(null);

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

  // Folders are loaded once; a failure leaves the maps fully usable.
  useEffect(() => {
    foldersApi
      .listFolders()
      .then(setFolders)
      .catch(() => setError(t.dashboard.library.foldersError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back to the first page whenever what's listed changes.
  useEffect(() => setPage(1), [filter, openFolderId, query]);

  const openFolder = folders.find((f) => f.folderId === openFolderId) ?? null;
  const items = useMemo(() => libraryItems(maps, folders, openFolderId, query), [maps, folders, openFolderId, query]);
  const paged = paginate(items, page);

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
    setError(null);
    try {
      await mapsApi.deleteMap(map.mapId);
      setMaps((prev) => prev.filter((m) => m.mapId !== map.mapId));
      setFolders((prev) => prev.map((f) => ({ ...f, mapIds: f.mapIds.filter((id) => id !== map.mapId) })));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.dashboard.library.deleteMapError);
    }
  }

  async function handleDeleteFolder(folder: FolderDoc) {
    if (!confirm(t.dashboard.library.deleteFolderConfirm(folder.name))) return;
    setError(null);
    try {
      await foldersApi.deleteFolder(folder.folderId);
      setFolders((prev) => prev.filter((f) => f.folderId !== folder.folderId));
      if (openFolderId === folder.folderId) setOpenFolderId(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.dashboard.library.folderModal.error);
    }
  }

  function applyMove(mapId: string, folderId: string | null) {
    setFolders((prev) =>
      prev.map((f) => {
        const rest = f.mapIds.filter((id) => id !== mapId);
        return { ...f, mapIds: f.folderId === folderId ? [...rest, mapId] : rest };
      }),
    );
    setMoveMap(null);
  }

  function mapMenu(map: MapDoc) {
    const isOwner = map.ownerId === user?._id;
    return [
      { label: t.dashboard.menu.summary, onClick: () => setSummaryMap(map) },
      { label: t.dashboard.card.members(map.memberCount ?? 0), onClick: () => setPeople({ map, view: "members" }) },
      { label: t.dashboard.card.owner, onClick: () => setPeople({ map, view: "owner" }) },
      { label: t.dashboard.menu.moveToFolder, onClick: () => setMoveMap(map) },
      { label: t.ui.clipboard.copyMap, onClick: () => handleCopyMap(map) },
      ...(isOwner
        ? [
            { label: t.dashboard.menu.edit, onClick: () => setEditMap(map) },
            { label: t.dashboard.menu.invite, onClick: () => setInviteMap(map) },
            { label: t.dashboard.menu.delete, danger: true, onClick: () => handleDelete(map) },
          ]
        : []),
    ];
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
        <div className="flex flex-wrap gap-2">
          <button className={secondaryBtn} onClick={() => navigate("/split")}>
            {t.split.entry}
          </button>
          <button className={secondaryBtn} onClick={() => setFolderModal({})}>
            {t.dashboard.library.newFolder}
          </button>
          <button className={primaryBtn} onClick={() => setShowCreate(true)}>
            {t.dashboard.newMap}
          </button>
        </div>
      </div>

      <ThinkEntry />

      <div className="mb-4 flex flex-wrap items-center gap-[0.4rem]">
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
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.dashboard.library.search}
          aria-label={t.dashboard.library.search}
          className="ml-auto min-w-[200px] flex-1 rounded-[20px] border border-line bg-surface px-[0.9rem] py-[0.4rem] text-[0.85rem] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent sm:max-w-[320px]"
        />
      </div>

      {openFolder && !query.trim() && (
        <nav className="mb-4 flex items-center gap-2 text-[0.9rem]">
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent p-0 font-semibold text-accent-ink hover:underline"
            onClick={() => setOpenFolderId(null)}
          >
            {t.dashboard.library.allMaps}
          </button>
          <span className="text-ink-soft">/</span>
          <span className="font-semibold">{openFolder.name}</span>
        </nav>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg bg-success-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-success">{notice}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-ink-soft">{t.dashboard.loading}</div>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-6 py-12 text-center text-ink-soft">
          {query.trim()
            ? t.dashboard.library.noResults(query.trim())
            : openFolder
              ? t.dashboard.library.folderEmpty
              : `${t.dashboard.empty} ${filter !== "owned" ? "" : t.dashboard.emptyOwnedHint}`}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-2 gap-y-3">
            {paged.items.map((item) =>
              item.kind === "folder" ? (
                <LibraryTile
                  key={`f:${item.folder.folderId}`}
                  icon={<FolderIcon />}
                  title={item.folder.name}
                  subtitle={t.dashboard.card.maps(item.mapCount)}
                  onOpen={() => {
                    setQuery("");
                    setOpenFolderId(item.folder.folderId);
                  }}
                  menu={[
                    {
                      label: t.dashboard.library.folderMenu.open,
                      onClick: () => {
                        setQuery("");
                        setOpenFolderId(item.folder.folderId);
                      },
                    },
                    { label: t.dashboard.library.folderMenu.rename, onClick: () => setFolderModal({ folder: item.folder }) },
                    { label: t.dashboard.library.folderMenu.delete, danger: true, onClick: () => handleDeleteFolder(item.folder) },
                  ]}
                />
              ) : (
                <LibraryTile
                  key={`m:${item.map.mapId}`}
                  icon={<MapIcon color={item.map.color} shared={item.map.ownerId !== user?._id} />}
                  title={item.map.name}
                  onOpen={() => navigate(`/maps/${item.map.mapId}`)}
                  menu={mapMenu(item.map)}
                />
              ),
            )}
          </div>
          {paged.pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-[0.85rem]">
              <button className={secondaryBtn} disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>
                {t.dashboard.library.prev}
              </button>
              <span className="text-ink-soft">{t.dashboard.library.page(paged.page, paged.pageCount)}</span>
              <button
                className={secondaryBtn}
                disabled={paged.page >= paged.pageCount}
                onClick={() => setPage(paged.page + 1)}
              >
                {t.dashboard.library.next}
              </button>
            </div>
          )}
        </>
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

      {folderModal && (
        <FolderModal
          folder={folderModal.folder}
          onClose={() => setFolderModal(null)}
          onSaved={(saved) => {
            setFolders((prev) =>
              prev.some((f) => f.folderId === saved.folderId)
                ? prev.map((f) => (f.folderId === saved.folderId ? saved : f))
                : [...prev, saved],
            );
            setFolderModal(null);
          }}
        />
      )}

      {moveMap && (
        <MoveToFolderModal map={moveMap} folders={folders} onClose={() => setMoveMap(null)} onMoved={applyMove} />
      )}

      {summaryMap && <MapSummaryModal map={summaryMap} onClose={() => setSummaryMap(null)} />}

      {people && (
        <MapPeopleModal map={people.map} view={people.view} currentUserId={user?._id} onClose={() => setPeople(null)} />
      )}
    </div>
  );
}


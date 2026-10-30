import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { shrinkImage } from "../utils/images";
import * as mapsApi from "../api/maps";
import { ApiRequestError } from "../api/client";
import { useConfirm } from "../context/ConfirmContext";
import { finishState } from "../utils/finish";
import type { Translation } from "../i18n/translations";
import type { MapBackground, MapDoc, NodeDoc, ZonePaletteColor } from "../types";

interface Params {
  map: MapDoc | null;
  setMap: Dispatch<SetStateAction<MapDoc | null>>;
  nodes: NodeDoc[];
  userId: string | undefined;
  online: boolean;
  /** The map is in Discussion mode right now (and online). */
  discussionOn: boolean;
  setActionError: (message: string | null) => void;
  /** Finishing closes the opponent's turn. */
  setSiegeOpen: (open: boolean) => void;
  logout: () => Promise<void>;
  t: Translation;
}

// The map-wide controls on the toolbar: its mode and background (owner
// only), ending the discussion, deleting the map and leaving a demo.
export function useMapControls({ map, setMap, nodes, userId, online, discussionOn, setActionError, setSiegeOpen, logout, t }: Params) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const mapId = map?.mapId;
  const isOwner = !!map && map.ownerId === userId;
  // A finish / agree / reopen request is on its way.
  const [finishBusy, setFinishBusy] = useState(false);

  // Map.discussionMode's real meaning now — see Backend/CLAUDE.md's own
  // updated doc comment. Undefined/true is "Discussion" (the default: full
  // combat controls visible, current/historical behavior), explicit false
  // is "Personal" (combat controls hidden — just nodes/edges/circles for
  // solo organizing). Never coerced with `!!` anywhere this is read — that
  // would collapse the undefined "never touched" default to false/Personal
  // instead of true/Discussion.
  async function toggleMapMode() {
    if (!isOwner || !mapId || !online) return;
    setActionError(null);
    try {
      const updated = await mapsApi.updateMap(mapId, { discussionMode: !discussionOn });
      setMap(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.changeMode);
    }
  }

  // The map's canvas (Map.background), owner-only like the mode above. Shown
  // straight away, put back if the save fails; map:updated brings it to
  // everyone else on the map.
  async function setMapBackground(background: MapBackground) {
    if (!isOwner || !mapId) return;
    const before = map?.background ?? null;
    const next = background === "dots" ? null : background;
    if (next === before) return;
    setActionError(null);
    setMap((prev) => (prev ? { ...prev, background: next } : prev));
    try {
      setMap(await mapsApi.updateMap(mapId, { background: next }));
    } catch (err) {
      setMap((prev) => (prev ? { ...prev, background: before } : prev));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.update);
    }
  }

  // The soft tint over the canvas (Map.backgroundColor): saved the same way.
  async function setMapBackgroundColor(backgroundColor: ZonePaletteColor | null) {
    if (!isOwner || !mapId) return;
    const before = map?.backgroundColor ?? null;
    if (backgroundColor === before) return;
    setActionError(null);
    setMap((prev) => (prev ? { ...prev, backgroundColor } : prev));
    try {
      setMap(await mapsApi.updateMap(mapId, { backgroundColor }));
    } catch (err) {
      setMap((prev) => (prev ? { ...prev, backgroundColor: before } : prev));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.update);
    }
  }

  // The owner's own wallpaper (Map.backgroundImage): the picked file shrunk
  // like a node's picture (utils/images.ts), shown at once, and uploaded; null
  // removes it.
  async function setMapBackgroundImage(file: File | null) {
    if (!isOwner || !mapId) return;
    const before = map?.backgroundImage ?? "";
    setActionError(null);
    try {
      const next = file ? await shrinkImage(file) : "";
      if (next === before) return;
      setMap((prev) => (prev ? { ...prev, backgroundImage: next } : prev));
      setMap(await mapsApi.updateMap(mapId, { backgroundImage: next }));
    } catch (err) {
      setMap((prev) => (prev ? { ...prev, backgroundImage: before } : prev));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.mapBackground.pictureFailed);
    }
  }

  // How much darker or lighter the wallpaper is (Map.backgroundShade): shown
  // at once while the slider moves, saved when it's let go (save).
  const shadeBeforeSlide = useRef<number | null>(null);
  async function setMapBackgroundShade(backgroundShade: number, save: boolean) {
    if (!isOwner || !mapId) return;
    if (shadeBeforeSlide.current === null) shadeBeforeSlide.current = map?.backgroundShade ?? 0;
    setMap((prev) => (prev ? { ...prev, backgroundShade } : prev));
    if (!save) return;
    const before = shadeBeforeSlide.current;
    shadeBeforeSlide.current = null;
    if (backgroundShade === before) return;
    setActionError(null);
    try {
      setMap(await mapsApi.updateMap(mapId, { backgroundShade }));
    } catch (err) {
      setMap((prev) => (prev ? { ...prev, backgroundShade: before } : prev));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.update);
    }
  }

  // "+" menu > Delete map (owner only): the map and everything on it, then
  // back to the dashboard.
  async function deleteThisMap() {
    if (!map || !(await confirm(t.dashboard.deleteConfirm(map.name), { confirmLabel: t.ui.common.delete, danger: true }))) return;
    setActionError(null);
    try {
      await mapsApi.deleteMap(map.mapId);
      navigate("/", { replace: true });
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.dashboard.library.deleteMapError);
    }
  }

  // Leaves a demo session for the login page — its account and map are
  // throwaway, so there is no way back to them afterwards. ProtectedRoute
  // sends a logged-out user to /login on its own.
  async function exitDemo() {
    if (!(await confirm(t.ui.demo.exitConfirm))) return;
    void logout();
  }

  // Ending the discussion (utils/finish.ts): the owner finishes, but only
  // once the opponent had the last word or everyone else agreed; the other
  // members agree (or take it back). A finished map takes no new points until
  // the owner reopens it.
  const isFinished = !!map?.finishedAt;
  const finishNow = map ? finishState(map, nodes) : { allowed: false, reason: null, waitingFor: [], others: [] };
  const memberName = (id: string) =>
    (map?.members ?? []).find((m): m is { _id: string; username: string } => typeof m !== "string" && m._id === id)?.username ?? "?";
  const iAgreed = !!userId && (map?.finishAgreedBy ?? []).includes(userId);
  const fs = t.ui.siege.finish;
  const finishTitle = isOwner
    ? finishNow.allowed
      ? fs.button
      : [fs.button, fs.notYet, finishNow.others.length ? fs.waiting(finishNow.waitingFor.map(memberName).join(", ")) : ""]
          .filter(Boolean)
          .join("\n")
    : `${iAgreed ? fs.agreed : fs.agree}\n${fs.agreedCount((map?.finishAgreedBy ?? []).length, finishNow.others.length)}`;
  async function runFinish(request: () => Promise<MapDoc>) {
    if (!mapId) return;
    setActionError(null);
    setFinishBusy(true);
    try {
      setMap(await request());
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.update);
    } finally {
      setFinishBusy(false);
    }
  }
  async function pressFinish() {
    if (!mapId || finishBusy) return;
    if (!isOwner) {
      void runFinish(() => mapsApi.agreeToFinish(mapId, !iAgreed));
      return;
    }
    if (!finishNow.allowed) {
      setActionError(
        [fs.notYet, finishNow.others.length ? fs.waiting(finishNow.waitingFor.map(memberName).join(", ")) : ""]
          .filter(Boolean)
          .join(" "),
      );
      return;
    }
    if (!(await confirm(fs.confirm))) return;
    setSiegeOpen(false);
    void runFinish(() => mapsApi.finishMap(mapId));
  }
  // The finished banner's Reopen (owner only).
  const reopen = isOwner && mapId ? () => void runFinish(() => mapsApi.reopenMap(mapId)) : undefined;

  return {
    isOwner,
    toggleMapMode,
    setMapBackground,
    setMapBackgroundColor,
    setMapBackgroundImage,
    setMapBackgroundShade,
    deleteThisMap,
    exitDemo,
    finish: {
      isFinished,
      busy: finishBusy,
      allowed: finishNow.allowed,
      otherCount: finishNow.others.length,
      iAgreed,
      title: finishTitle,
      press: pressFinish,
      reopen,
    },
  };
}

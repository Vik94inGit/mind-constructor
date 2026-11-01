import {
  deleteDraftAbl,
  getCheckInsAbl,
  getDraftAbl,
  getMapViewStateAbl,
  getUserStateAbl,
  MapNotFoundError,
  saveDraftAbl,
  UnknownDraftError,
  updateMapViewStateAbl,
  updatePreferencesAbl,
} from "../abl/userStateAbl.js";
import { authed, type ErrorMapping } from "./errorHandling.js";

const mapNotFound: ErrorMapping[] = [[MapNotFoundError, 404, "Map not found"]];
const unknownDraft: ErrorMapping[] = [[UnknownDraftError, 404, "Unknown draft kind"]];

export const getUserState = authed(
  "getUserState",
  async (_req, res, userId) => res.status(200).json({ success: true, ...(await getUserStateAbl(userId)) }),
  { message: "Failed to load your state" },
);

export const updatePreferences = authed(
  "updatePreferences",
  async (req, res, userId) =>
    res.status(200).json({ success: true, preferences: await updatePreferencesAbl(req.body, userId) }),
  { message: "Failed to save preferences" },
);

export const getMapViewState = authed<{ mapId: string }>(
  "getMapViewState",
  async (req, res, userId) =>
    res.status(200).json({ success: true, view: await getMapViewStateAbl(req.params.mapId, userId) }),
  { errors: mapNotFound, message: "Failed to load the map view" },
);

export const updateMapViewState = authed<{ mapId: string }>(
  "updateMapViewState",
  async (req, res, userId) =>
    res.status(200).json({ success: true, view: await updateMapViewStateAbl(req.params.mapId, req.body, userId) }),
  { errors: mapNotFound, message: "Failed to save the map view" },
);

export const getCheckIns = authed(
  "getCheckIns",
  async (_req, res, userId) => res.status(200).json({ success: true, checkIns: await getCheckInsAbl(userId) }),
  { message: "Failed to load your check-ins" },
);

export const getDraft = authed<{ kind: string }>(
  "getDraft",
  async (req, res, userId) => res.status(200).json({ success: true, draft: await getDraftAbl(req.params.kind, userId) }),
  { errors: unknownDraft, message: "Failed to load the draft" },
);

export const saveDraft = authed<{ kind: string }>(
  "saveDraft",
  async (req, res, userId) =>
    res.status(200).json({ success: true, ...(await saveDraftAbl(req.params.kind, req.body, userId)) }),
  { errors: unknownDraft, message: "Failed to save the draft" },
);

export const deleteDraft = authed<{ kind: string }>(
  "deleteDraft",
  async (req, res, userId) => {
    await deleteDraftAbl(req.params.kind, userId);
    return res.status(200).json({ success: true });
  },
  { errors: unknownDraft, message: "Failed to delete the draft" },
);

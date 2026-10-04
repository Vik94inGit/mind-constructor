import { Request, Response } from "express";
import {
  deleteDraftAbl,
  getDraftAbl,
  getMapViewStateAbl,
  getUserStateAbl,
  MapNotFoundError,
  saveDraftAbl,
  UnknownDraftError,
  updateMapViewStateAbl,
  updatePreferencesAbl,
} from "../abl/userStateAbl.js";
import { handleAblError } from "./errorHandling.js";

const mapNotFound: [typeof MapNotFoundError, number, string] = [MapNotFoundError, 404, "Map not found"];
const unknownDraft: [typeof UnknownDraftError, number, string] = [UnknownDraftError, 404, "Unknown draft kind"];

export const getUserState = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    return res.status(200).json({ success: true, ...(await getUserStateAbl(userId)) });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Failed to load your state", logLabel: "getUserState" });
  }
};

export const updatePreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const preferences = await updatePreferencesAbl(req.body, userId);
    return res.status(200).json({ success: true, preferences });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Failed to save preferences", logLabel: "updatePreferences" });
  }
};

export const getMapViewState = async (req: Request<{ mapId: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const view = await getMapViewStateAbl(req.params.mapId, userId);
    return res.status(200).json({ success: true, view });
  } catch (error) {
    return handleAblError(res, error, [mapNotFound], { message: "Failed to load the map view", logLabel: "getMapViewState" });
  }
};

export const updateMapViewState = async (req: Request<{ mapId: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const view = await updateMapViewStateAbl(req.params.mapId, req.body, userId);
    return res.status(200).json({ success: true, view });
  } catch (error) {
    return handleAblError(res, error, [mapNotFound], { message: "Failed to save the map view", logLabel: "updateMapViewState" });
  }
};

export const getDraft = async (req: Request<{ kind: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const draft = await getDraftAbl(req.params.kind, userId);
    return res.status(200).json({ success: true, draft });
  } catch (error) {
    return handleAblError(res, error, [unknownDraft], { message: "Failed to load the draft", logLabel: "getDraft" });
  }
};

export const saveDraft = async (req: Request<{ kind: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const result = await saveDraftAbl(req.params.kind, req.body, userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(res, error, [unknownDraft], { message: "Failed to save the draft", logLabel: "saveDraft" });
  }
};

export const deleteDraft = async (req: Request<{ kind: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    await deleteDraftAbl(req.params.kind, userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    return handleAblError(res, error, [unknownDraft], { message: "Failed to delete the draft", logLabel: "deleteDraft" });
  }
};

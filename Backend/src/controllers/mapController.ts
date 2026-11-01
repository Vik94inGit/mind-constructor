import {
  deleteMapDao,
  getNodesByMapDao,
  getNodesTextDao,
  getMapByIdDao,
  getMapSummaryDao,
} from "../dao/mapsDao.js";
import { getEdgesByMapDao } from "../dao/edgeDao.js";
import {
  createMapAbl,
  updateMapAbl,
  inviteUserToMapAbl,
  NotInviterError,
  InviteeNotFoundError,
  AlreadyMemberError,
  setMapColorAbl,
  getMapsAbl,
  searchNodesAbl,
  ColorTakenError,
} from "../abl/mapAbl.js";
import {
  selectCircleAbl,
  deselectCircleAbl,
  CircleNotFoundError,
} from "../abl/circleAbl.js";
import { computeAttackIndicatorsAbl } from "../abl/attackIndicatorAbl.js";
import { broadcastToMap, notifyUser } from "../realtime/io.js";
import { authed, fail, isIdList, param } from "./errorHandling.js";

const mapNotFound = (res: Parameters<typeof fail>[0]) => fail(res, 404, "Map not found");

// ========== CREATE MAP ==========
// The owner is the authenticated user.
export const createMap = authed("createMap", async (req, res, userId) => {
  const newMap = await createMapAbl(req.body, userId);
  return res.status(201).json(newMap);
});

// ========== SET MY COLOR ON THIS MAP ==========
// Called by the owner right after creating a map is covered by createMap's
// ownerColor — this is for choosing/changing a color later, and for anyone
// who was invited rather than the one who created the map.
export const setMyMapColor = authed(
  "setMyMapColor",
  async (req, res, userId) => {
    const map = await setMapColorAbl(param(req, "mapId"), userId, req.body);
    if (!map) return mapNotFound(res);
    return res.status(200).json({ success: true, map });
  },
  { errors: [[ColorTakenError, 409, "That color is already taken by another member of this map"]] },
);

// ========== INVITE USER ==========
export const inviteUserToMap = authed(
  "inviteUserToMap",
  async (req, res, userId) => {
    const result = await inviteUserToMapAbl(param(req, "mapId"), req.body, userId);
    if (!result) return mapNotFound(res);

    // Lets the invitee's open tabs show the map straight away, without a
    // reload — see io.ts's notifyUser.
    notifyUser(result.invitee._id, "map:invited", {
      mapId: result.map.mapId,
      name: result.map.name,
      invitedBy: req.user!.username,
    });

    return res.status(200).json({ success: true, map: result.map });
  },
  {
    errors: [
      [NotInviterError, 403, "Only the map's owner can invite people"],
      [InviteeNotFoundError, 404, "User not found"],
      [AlreadyMemberError, 409, "Already a member of this map"],
    ],
    message: "Server error",
  },
);

export const getMapById = authed(
  "getMapById",
  async (req, res, userId) => {
    const map = await getMapByIdDao(param(req, "mapId"), userId);
    if (!map) return mapNotFound(res);
    return res.status(200).json({ success: true, map });
  },
  { message: "Server error" },
);

// GET /api/?filter=owned — filter comes from the query string, not the body:
// GET requests carrying a body have no defined meaning in HTTP and plenty of
// real infrastructure (proxies, CDNs, some HTTP clients) silently drops it.
export const getAllMaps = authed(
  "getAllMaps",
  async (req, res, userId) => {
    const maps = await getMapsAbl(userId, req.query.filter);
    return res.status(200).json({ success: true, maps });
  },
  { message: "Server error" },
);

// ========== SEARCH ACROSS ALL THOUGHTS ==========
// GET /api/search?q=… — see searchNodesAbl.
export const searchNodes = authed(
  "searchNodes",
  async (req, res, userId) => {
    const results = await searchNodesAbl(userId, { q: req.query.q });
    return res.status(200).json({ success: true, results });
  },
  { message: "Server error" },
);

export const getMapSummary = authed(
  "getMapSummary",
  async (req, res, userId) => {
    const summary = await getMapSummaryDao(param(req, "mapId"), userId);
    if (!summary) return mapNotFound(res);
    // summary already carries the public `mapId` — no need to echo it back
    // separately (and definitely not under the key `_id`, which it isn't).
    return res.status(200).json({ success: true, ...summary });
  },
  { message: "Server error" },
);

export const getNodesByMap = authed("getNodesByMap", async (req, res, userId) => {
  const nodes = await getNodesByMapDao(param(req, "mapId"), userId);
  if (nodes === null) return mapNotFound(res);
  return res.status(200).json(nodes);
});

// Backfills the `text` getNodesByMap's own listing deliberately omits (see
// getNodesByMapDao's doc comment) — POST, not GET, since the id list can be
// arbitrarily long and doesn't belong in a query string. Body: { nodeIds }.
export const getNodesText = authed("getNodesText", async (req, res, userId) => {
  const { nodeIds } = req.body as { nodeIds?: unknown };
  if (!isIdList(nodeIds)) return fail(res, 400, "nodeIds must be a non-empty array of strings");

  const text = await getNodesTextDao(param(req, "mapId"), userId, nodeIds);
  if (text === null) return mapNotFound(res);
  return res.status(200).json({ success: true, text });
});

export const updateMap = authed("updateMap", async (req, res, userId) => {
  const mapId = param(req, "mapId");
  const updatedMap = await updateMapAbl(mapId, userId, req.body);
  if (!updatedMap) return mapNotFound(res);

  broadcastToMap(mapId, "map:updated", { map: updatedMap });
  return res.status(200).json({ success: true, map: updatedMap });
});

export const deleteMap = authed("deleteMap", async (req, res, userId) => {
  const result = await deleteMapDao(param(req, "mapId"), userId);
  return res.status(200).json({ success: true, message: `Deleted map and related nodes`, result });
});

// ========== LIST EDGES ==========
export const getEdgesByMap = authed("getEdgesByMap", async (req, res, userId) => {
  const edges = await getEdgesByMapDao(param(req, "mapId"), userId);
  if (edges === null) return mapNotFound(res);
  return res.status(200).json(edges);
});

// ========== ATTACK INDICATORS (computed, not persisted) ==========
export const getMapAttackIndicators = authed("getMapAttackIndicators", async (req, res, userId) => {
  const result = await computeAttackIndicatorsAbl(param(req, "mapId"), userId, req.query);
  if (!result) return mapNotFound(res);
  return res.status(200).json({ success: true, ...result });
});

// ========== SELECT A CIRCLE ==========
// Locks the circle's member nodes (a frontend layout/physics loop should
// treat that as "don't move me") and remembers the choice on the Map.
export const selectMapCircle = authed(
  "selectMapCircle",
  async (req, res, userId) => {
    const mapId = param(req, "mapId");
    const result = await selectCircleAbl(mapId, userId, req.body);
    if (!result) return mapNotFound(res);

    broadcastToMap(mapId, "circle:selected", { selectedCircle: result.selectedCircle });
    return res.status(200).json({ success: true, ...result });
  },
  {
    errors: [
      [CircleNotFoundError, 404, "Circle not found — the graph may have changed since it was computed"],
    ],
  },
);

// ========== DESELECT THE CIRCLE ==========
export const deselectMapCircle = authed("deselectMapCircle", async (req, res, userId) => {
  const mapId = param(req, "mapId");
  const result = await deselectCircleAbl(mapId, userId);
  if (!result) return mapNotFound(res);

  broadcastToMap(mapId, "circle:deselected", { selectedCircle: null });
  return res.status(200).json({ success: true, ...result });
});

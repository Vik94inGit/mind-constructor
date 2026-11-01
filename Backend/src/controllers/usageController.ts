import { Request, Response } from "express";
import { getUsageSummaryAbl, recordUsageAbl } from "../abl/usageAbl.js";
import { handleAblError } from "./errorHandling.js";

// POST /api/usage — body { events: [{ name, props?, at? }] }; see recordUsageAbl.
export const recordUsage = async (req: Request, res: Response) => {
  try {
    const result = await recordUsageAbl(req.user!, req.body);
    return res.status(202).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Failed to record usage", logLabel: "recordUsage" });
  }
};

// GET /api/usage/summary?days=30&includeDemo=false — admin only; see getUsageSummaryAbl.
export const getUsageSummary = async (req: Request, res: Response) => {
  try {
    const summary = await getUsageSummaryAbl(req.query);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Failed to load usage", logLabel: "getUsageSummary" });
  }
};

import mongoose from "mongoose";
import { UsageEvent } from "../models/UsageEvent.js";
import { User } from "../models/User.js";
import { Map as MapModel } from "../models/Map.js";
import { Node } from "../models/Node.js";

export interface UsageEventRow {
  name: string;
  props?: Record<string, string>;
  at: Date;
  day: string;
}

export const insertUsageEventsDao = async (userId: string, demo: boolean, events: UsageEventRow[]) => {
  if (events.length === 0) return;
  await UsageEvent.insertMany(
    events.map((e) => ({ ...e, userId: new mongoose.Types.ObjectId(userId), demo })),
    { ordered: false },
  );
};

const demoFilter = (includeDemo: boolean) => (includeDemo ? {} : { demo: { $ne: true } });

// Distinct users with at least one event at or after `since`.
export const countActiveUsersDao = async (since: Date, includeDemo: boolean) => {
  const ids = await UsageEvent.distinct("userId", { at: { $gte: since }, ...demoFilter(includeDemo) });
  return ids.length;
};

// Per UTC day from `since`: how many people did something, and how many things.
export const dailyActivityDao = async (since: Date, includeDemo: boolean) => {
  return await UsageEvent.aggregate<{ day: string; users: number; events: number }>([
    { $match: { at: { $gte: since }, ...demoFilter(includeDemo) } },
    { $group: { _id: "$day", users: { $addToSet: "$userId" }, events: { $sum: 1 } } },
    { $project: { _id: 0, day: "$_id", users: { $size: "$users" }, events: 1 } },
    { $sort: { day: 1 } },
  ]);
};

// Per event name from `since`: how often, and by how many people.
export const eventTotalsDao = async (since: Date, includeDemo: boolean) => {
  return await UsageEvent.aggregate<{ name: string; count: number; users: number }>([
    { $match: { at: { $gte: since }, ...demoFilter(includeDemo) } },
    { $group: { _id: "$name", count: { $sum: 1 }, users: { $addToSet: "$userId" } } },
    { $project: { _id: 0, name: "$_id", count: 1, users: { $size: "$users" } } },
    { $sort: { count: -1 } },
  ]);
};

// People active on at least two different days from `since` (they came back).
export const countReturningUsersDao = async (since: Date, includeDemo: boolean) => {
  const rows = await UsageEvent.aggregate<{ n: number }>([
    { $match: { at: { $gte: since }, ...demoFilter(includeDemo) } },
    { $group: { _id: "$userId", days: { $addToSet: "$day" } } },
    { $match: { "days.1": { $exists: true } } },
    { $count: "n" },
  ]);
  return rows[0]?.n ?? 0;
};

// What was made from `since`, straight from the data itself, so it counts
// changes made offline and synced later, and everything before tracking began.
export const countCreatedDao = async (since: Date, includeDemo: boolean) => {
  const sinceId = mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
  const real = includeDemo ? {} : { isDemo: { $ne: true } };
  const [users, newUsers, maps, nodes] = await Promise.all([
    User.countDocuments(real),
    User.countDocuments({ _id: { $gte: sinceId }, ...real }),
    MapModel.countDocuments({ createdAt: { $gte: since } }),
    Node.countDocuments({ createdAt: { $gte: since } }),
  ]);
  return { users, newUsers, maps, nodes };
};

import { Map } from "../models/Map.js";
import { Node } from "../models/Node.js";
import { User } from "../models/User.js";
import { UsageEvent } from "../models/UsageEvent.js";

// What the admin page needs to tell a used account from an unused one, and
// to list every map. Read-only; the deletes go through the usual cascades
// (userAbl.ts's adminDeleteUserAbl, mapsDao.ts's adminDeleteMapDao).

export interface UserActivityRow {
  userId: string;
  ownedMaps: number;
  // Nodes they wrote, on any map. An untouched ghost (a starter question
  // nobody answered yet) is not something they wrote.
  writtenNodes: number;
  // Their latest sign of life: a usage event, a node of theirs changing, or
  // a map of theirs changing. null when there's none at all.
  lastActiveAt: Date | null;
}

const latest = (...dates: (Date | null | undefined)[]) => {
  let best: Date | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
};

// One row per user id asked for (users with nothing at all still get a row).
export const listUserActivityDao = async (userIds: string[]): Promise<UserActivityRow[]> => {
  const [maps, nodes, usage] = await Promise.all([
    Map.aggregate<{ _id: unknown; count: number; last: Date }>([
      { $group: { _id: "$ownerId", count: { $sum: 1 }, last: { $max: "$updatedAt" } } },
    ]),
    Node.aggregate<{ _id: unknown; written: number; last: Date }>([
      {
        $group: {
          _id: "$userId",
          written: { $sum: { $cond: [{ $eq: ["$ghost", true] }, 0, 1] } },
          last: { $max: "$updatedAt" },
        },
      },
    ]),
    UsageEvent.aggregate<{ _id: unknown; last: Date }>([{ $group: { _id: "$userId", last: { $max: "$at" } } }]),
  ]);
  const byId = <T extends { _id: unknown }>(rows: T[]) => {
    const out: Record<string, T> = {};
    for (const r of rows) out[String(r._id)] = r;
    return out;
  };
  const mapsBy = byId(maps);
  const nodesBy = byId(nodes);
  const usageBy = byId(usage);
  return userIds.map((userId) => ({
    userId,
    ownedMaps: mapsBy[userId]?.count ?? 0,
    writtenNodes: nodesBy[userId]?.written ?? 0,
    lastActiveAt: latest(mapsBy[userId]?.last, nodesBy[userId]?.last, usageBy[userId]?.last),
  }));
};

export interface AdminMapRow {
  mapId: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  memberCount: number;
  nodeCount: number;
  writtenNodes: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Every map in the database, newest change first.
export const listAllMapsDao = async (): Promise<AdminMapRow[]> => {
  const maps = await Map.find({}, "mapId name ownerId members createdAt updatedAt")
    .sort({ updatedAt: -1 })
    .lean<{ _id: unknown; mapId: string; name: string; ownerId: unknown; members?: unknown[]; createdAt?: Date; updatedAt?: Date }[]>();
  if (maps.length === 0) return [];
  const [owners, counts] = await Promise.all([
    User.find({ _id: { $in: maps.map((m) => m.ownerId) } })
      .select("username")
      .lean<{ _id: unknown; username: string }[]>(),
    Node.aggregate<{ _id: unknown; count: number; written: number }>([
      {
        $group: {
          _id: "$mapId",
          count: { $sum: 1 },
          written: { $sum: { $cond: [{ $eq: ["$ghost", true] }, 0, 1] } },
        },
      },
    ]),
  ]);
  const ownerName: Record<string, string> = {};
  for (const u of owners) ownerName[String(u._id)] = u.username;
  const countBy: Record<string, { count: number; written: number }> = {};
  for (const c of counts) countBy[String(c._id)] = c;
  return maps.map((m) => ({
    mapId: m.mapId,
    name: m.name,
    ownerId: String(m.ownerId),
    ownerName: ownerName[String(m.ownerId)] ?? null,
    memberCount: m.members?.length ?? 0,
    nodeCount: countBy[String(m._id)]?.count ?? 0,
    writtenNodes: countBy[String(m._id)]?.written ?? 0,
    createdAt: m.createdAt ?? null,
    updatedAt: m.updatedAt ?? null,
  }));
};

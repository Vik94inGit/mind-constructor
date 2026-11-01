import { Node } from "../models/Node.js";
import { Edge } from "../models/Edge.js";
import { Line } from "../models/Line.js";
import { Attack } from "../models/Attack.js";
import { NodeRevision } from "../models/NodeRevision.js";
import { Folder } from "../models/Folder.js";
import { UserState, MapViewState, Draft } from "../models/UserState.js";
import { UsageEvent } from "../models/UsageEvent.js";
import { deleteImagesByUserDao } from "./imageDao.js";

// What's left of a user once their own maps are gone: what they added to
// other people's maps and their personal data. Used by userAbl.ts's
// adminDeleteUserAbl so a deleted account leaves nothing behind.

// The public ids of every node this user still has, on anyone's map.
export const listNodeIdsByUserDao = async (userId: string) => {
  const rows = await Node.find({ userId }, "nodeId").lean();
  return rows.map((r) => r.nodeId as string);
};

// Everything else of theirs: links and drawn lines, attacks and the history
// entries they wrote, pictures, folders, their saved state, views and
// drafts, and their usage events.
export const deleteUserContentDao = async (userId: string) => {
  await deleteImagesByUserDao(userId);
  await Promise.all([
    Edge.deleteMany({ userId }),
    Line.deleteMany({ userId }),
    Attack.deleteMany({ attackerId: userId }),
    NodeRevision.deleteMany({ userId }),
    Folder.deleteMany({ ownerId: userId }),
    UserState.deleteMany({ userId }),
    MapViewState.deleteMany({ userId }),
    Draft.deleteMany({ userId }),
    UsageEvent.deleteMany({ userId }),
  ]);
};

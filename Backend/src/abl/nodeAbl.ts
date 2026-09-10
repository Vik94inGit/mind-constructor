import { z } from "zod";
import type mongoose from "mongoose";
import { NODE_TYPES, SYMBOL_OVERRIDES, SIZE_TIERS, MANUAL_ZONE_COLORS } from "../models/Node.js";
import { getMapByIdDao } from "../dao/mapsDao.js";
import {
  createNodeMutationDao,
  countNodesByMapInternalIdDao,
  updateNodeDao,
  findNodeByPublicIdDao,
} from "../dao/nodeDao.js";
import { parseOrThrow } from "./errors.js";

// z.enum only accepts strings (or a TS enum object) in the zod version this
// repo pins — SIZE_TIERS is a numeric tuple, so this needs a union of
// literals instead. Shared between create/update below so the two schemas
// can't drift out of sync with SIZE_TIERS or each other.
const sizeTierSchema = z.union([z.literal(SIZE_TIERS[0]), z.literal(SIZE_TIERS[1]), z.literal(SIZE_TIERS[2])]);

export class MapNotFoundError extends Error {}
export class ParentNotFoundError extends Error {}
export class CrossMapParentError extends Error {}
export class ParentNotOwnedError extends Error {}
export class SelfParentError extends Error {}

const createNodeSchema = z.object({
  text: z.string().min(1, "text is required"),
  type: z.enum(NODE_TYPES, {
    error: () => `type is required and must be one of: ${NODE_TYPES.join(", ")}`,
  }),
  x: z.number().optional(),
  y: z.number().optional(),
  color: z.string().optional(),
  parentId: z.string().nullish(),
  // See Node.symbolOverride — rarely set at creation, but no reason to
  // forbid it (e.g. cloning a decided outcome via a template later).
  symbolOverride: z.enum(SYMBOL_OVERRIDES).nullish(),
  // See Node.SIZE_TIERS — rarely set at creation (packAbl.ts's auto-bump is
  // the common path), but nothing stops a caller from picking a size up
  // front.
  sizeTier: sizeTierSchema.nullish(),
  // See Node.MANUAL_ZONE_COLORS — a manually-placed zone ring, independent
  // of the automatic circle detection.
  manualZone: z.enum(MANUAL_ZONE_COLORS).nullish(),
});

// The clearest example of "why ABL": creating a node is two DAO calls
// coordinated around one decision (is this the map's first node?), plus a
// membership check that has to happen before either of them.
export const createNodeAbl = async (
  input: unknown,
  publicMapId: string,
  userId: string,
) => {
  const { parentId: publicParentId, ...parsed } = parseOrThrow(createNodeSchema, input);

  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) throw new MapNotFoundError();

  // parentId arrives as a public nodeId (nanoid) — the schema stores an
  // internal ObjectId ref, so it has to be resolved the same way edgeAbl
  // resolves fromNodeId/toNodeId. A branch can only start from a node the
  // caller created, same rule as linking.
  let parentObjectId: mongoose.Types.ObjectId | null = null;
  if (publicParentId) {
    const parent = await findNodeByPublicIdDao(publicParentId);
    if (!parent) throw new ParentNotFoundError();
    if (parent.mapId.toString() !== map._id.toString()) throw new CrossMapParentError();
    if (parent.userId.toString() !== userId.toString()) throw new ParentNotOwnedError();
    parentObjectId = parent._id;
  }

  const isFirstNode = (await countNodesByMapInternalIdDao(map._id)) === 0;

  return await createNodeMutationDao(map._id, {
    ...parsed,
    parentId: parentObjectId,
    userId,
    isFirstNode,
  });
};

const updateNodeSchema = z
  .object({
    text: z.string().min(1).optional(),
    type: z.enum(NODE_TYPES, {
      error: () => `type must be one of: ${NODE_TYPES.join(", ")}`,
    }).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    color: z.string().optional(),
    parentId: z.string().nullish(),
    // null explicitly clears back to "use the type's own default symbol" —
    // same nullish-vs-absent convention parentId already uses below.
    symbolOverride: z.enum(SYMBOL_OVERRIDES).nullish(),
    // Manual size override (NodePanel's 100/115/130% buttons) — "Reset"
    // sends an explicit 1, not null, so it doesn't re-arm packAbl.ts's
    // auto-bump. null is still accepted here (schema-wise) since nullish
    // updates are a general PATCH convention, but no current UI path sends
    // it for this field.
    sizeTier: sizeTierSchema.nullish(),
    // null explicitly removes a manual zone ring — same nullish-vs-absent
    // convention symbolOverride already uses.
    manualZone: z.enum(MANUAL_ZONE_COLORS).nullish(),
  })
  .refine((fields) => Object.values(fields).some((v) => v !== undefined), {
    error: "No fields to update",
  });

export const updateNodeAbl = async (
  publicNodeId: string,
  userId: string,
  input: unknown,
) => {
  const updates = parseOrThrow(updateNodeSchema, input);
  // parseOrThrow strips nothing — undefined fields would overwrite existing
  // values with `undefined`, so only pass through what was actually sent.
  const definedUpdates: Record<string, unknown> = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );

  // parentId arrives as a public nodeId (or explicit null to clear it) —
  // this was passing it straight through unresolved, so setting a real
  // parentId here always failed the ObjectId cast server-side. Resolved the
  // same way createNodeAbl resolves it: same map, same owner as the caller.
  // Only touched when the caller actually sent the field — parseOrThrow
  // already dropped `undefined`, so "parentId" being absent here means
  // leave it alone, same as any other field.
  if ("parentId" in definedUpdates) {
    const publicParentId = definedUpdates.parentId as string | null;
    if (publicParentId === null) {
      definedUpdates.parentId = null;
    } else if (publicParentId === publicNodeId) {
      throw new SelfParentError();
    } else {
      const parent = await findNodeByPublicIdDao(publicParentId);
      if (!parent) throw new ParentNotFoundError();
      if (parent.userId.toString() !== userId.toString()) throw new ParentNotOwnedError();
      const node = await findNodeByPublicIdDao(publicNodeId);
      if (!node) return null;
      if (parent.mapId.toString() !== node.mapId.toString()) throw new CrossMapParentError();
      definedUpdates.parentId = parent._id;
    }
  }

  return await updateNodeDao(publicNodeId, userId, definedUpdates);
};

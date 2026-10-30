import { z } from "zod";
import type mongoose from "mongoose";
import { NODE_TYPES, SYMBOL_OVERRIDES, SIZE_TIERS, MANUAL_ZONE_COLORS, NODE_SHAPES, ZONE_PATTERNS, ZONE_PALETTE, CARD_SHAPES, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_FONT_MIN, CARD_FONT_MAX } from "../models/Node.js";
import { getMapByIdDao, getMapByInternalIdDao } from "../dao/mapsDao.js";
import { recordEditAbl } from "./historyAbl.js";
import {
  createNodeMutationDao,
  countNodesByMapInternalIdDao,
  updateNodeDao,
  zoneColorTakenDao,
  findNodeByPublicIdDao,
  setBranchHiddenMutationDao,
  moveNodesDao,
} from "../dao/nodeDao.js";
import { getHiddenNodesDao } from "../dao/visibilityDao.js";
import { MapFinishedError, parseOrThrow, ValidationError } from "./errors.js";
import { IMAGE_URL_PREFIX } from "../models/Image.js";
import { createImageDao, findNodeImageIdsDao, deleteNodeImagesExceptDao } from "../dao/imageDao.js";

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
export class NotMapOwnerError extends Error {}
// One person, one colour: a palette colour another member's zone on the map
// already wears can't be picked (Node.zoneColor).
export class ZoneColorTakenError extends Error {}

// Shared by create/update: same cap as Node.title's own maxlength. Empty is
// valid (it's how "no title" is stored, and how an update clears one).
const titleSchema = z.string().trim().max(80, "title must be at most 80 characters");
// See Node.prompt — "" removes it.
const promptSchema = z.string().trim().max(200, "prompt must be at most 200 characters");

// Node.zoneName — same shape as the title: "" clears it.
const zoneNameSchema = z.string().trim().max(40, "zone name must be at most 40 characters");

// Node.emoji — a single emoji (several code points once skin tones, flags or
// joined sequences come in, hence 32). "" clears it. Plain letters and digits
// are refused, so the field can't turn into a second title.
const emojiSchema = z
  .string()
  .trim()
  .max(32, "emoji must be at most 32 characters")
  .refine((v) => v === "" || !/[\p{L}\p{N}]/u.test(v), "emoji must be an emoji, not text");

// Node.picture — which dot of a picture a node is ("Draw a picture").
const pictureSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "picture id must be 1-40 letters, digits, - or _"),
  kind: z.string().regex(/^[a-z]{1,20}$/, "picture kind must be 1-20 lowercase letters"),
  dot: z.number().int("picture dot must be a whole number").min(0).max(63),
  color: z.enum(ZONE_PALETTE).nullish(),
});

// Node.order — a whole step number, 1..9999. null clears it (update only).
const orderSchema = z
  .number()
  .int("order must be a whole number")
  .min(1, "order must be at least 1")
  .max(9999, "order must be at most 9999");

// A picture already in the image store (models/Image.ts): what a node keeps
// once updateNodeAbl has stored the data URL a frontend sent. Sending one back
// unchanged (say, the rest of the picture list after removing one) keeps it.
const STORED_IMAGE = String.raw`\/api\/images\/[A-Za-z0-9_-]{8,32}`;
const imageRegex = (types: string) => new RegExp(`^(data:image\\/(${types});base64,[A-Za-z0-9+/=]+|${STORED_IMAGE})$`);
const STORED_IMAGE_RE = new RegExp(`^${STORED_IMAGE}$`);

// Node.images — each one an image data URL (stored on arrival) or a stored
// picture's address. The frontend shrinks a picture to fit well under this
// before sending it; the cap keeps a single picture from growing without
// bound. MAX_NODE_IMAGES × MAX_IMAGE_CHARS stays under the JSON body limit in
// server.ts.
export const MAX_NODE_IMAGES = 6;
export const MAX_IMAGE_CHARS = 400_000;
const imageSchema = z
  .string()
  .max(MAX_IMAGE_CHARS, "image is too large")
  .regex(imageRegex("png|jpeg|webp|gif"), "image must be a PNG, JPEG, WebP or GIF data URL");
const imagesSchema = z.array(imageSchema).max(MAX_NODE_IMAGES, `at most ${MAX_NODE_IMAGES} images per node`);

// Node.iconImage — a small square thumbnail (a frontend cuts it from one of
// the node's pictures) drawn as the node's icon. Stored like the pictures, so
// the map's node list carries only its address. "" removes it.
export const MAX_ICON_IMAGE_CHARS = 40_000;
const iconImageSchema = z.union([
  z.literal(""),
  z
    .string()
    .max(MAX_ICON_IMAGE_CHARS, "icon image is too large")
    .regex(imageRegex("png|jpeg|webp"), "icon image must be a PNG, JPEG or WebP data URL"),
]);

// Node.cardImage — a small copy of one of the pictures (its own shape, not
// cut square) drawn on the map as a picture card under the node, with or
// without a picture icon. Stored like iconImage. "" removes it.
export const MAX_CARD_IMAGE_CHARS = 80_000;
const cardImageSchema = z.union([
  z.literal(""),
  z
    .string()
    .max(MAX_CARD_IMAGE_CHARS, "card image is too large")
    .regex(imageRegex("png|jpeg|webp"), "card image must be a PNG, JPEG or WebP data URL"),
]);

const IMAGE_FIELDS = ["images", "iconImage", "cardImage"] as const;

const storedImageId = (ref: string) => ref.slice(IMAGE_URL_PREFIX.length);

// Every stored picture id a node points at, across all three picture fields.
const referencedImageIds = (node: { images?: string[]; iconImage?: string; cardImage?: string }) =>
  [...(node.images ?? []), node.iconImage ?? "", node.cardImage ?? ""]
    .filter((ref) => STORED_IMAGE_RE.test(ref))
    .map(storedImageId);

// Moves every data URL among the picture fields of `updates` into the image
// store and puts its address in its place. A stored address is accepted only
// when it belongs to this node, so a node can't borrow another map's picture.
export const storeImageFields = async (
  updates: Record<string, unknown>,
  node: { _id: unknown; mapId: unknown },
  userId: string,
) => {
  const refs = IMAGE_FIELDS.flatMap((f) => {
    const v = updates[f];
    return v === undefined ? [] : Array.isArray(v) ? (v as string[]) : [v as string];
  });
  const claimed = refs.filter((ref) => STORED_IMAGE_RE.test(ref)).map(storedImageId);
  const known = await findNodeImageIdsDao(node._id as string, claimed);
  if (claimed.some((id) => !known.has(id))) throw new ValidationError("unknown picture");

  const stored = new Map<string, string>();
  const store = async (ref: string) => {
    if (!ref.startsWith("data:")) return ref;
    const cached = stored.get(ref);
    if (cached) return cached;
    const comma = ref.indexOf(",");
    const url = await createImageDao({
      mapId: node.mapId as string,
      nodeId: node._id as string,
      userId,
      mime: ref.slice("data:".length, ref.indexOf(";")),
      data: Buffer.from(ref.slice(comma + 1), "base64"),
    });
    stored.set(ref, url);
    return url;
  };
  for (const f of IMAGE_FIELDS) {
    const v = updates[f];
    if (v === undefined) continue;
    updates[f] = Array.isArray(v) ? await Promise.all((v as string[]).map(store)) : await store(v as string);
  }
};

const createNodeSchema = z.object({
  // "" is allowed: a node can be drawn first and written later (see Node.text).
  text: z.string(),
  title: titleSchema.optional(),
  prompt: promptSchema.optional(),
  emoji: emojiSchema.optional(),
  order: orderSchema.nullish(),
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
  picture: pictureSchema.nullish(),
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
  if (map.finishedAt) throw new MapFinishedError();

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
    // No text yet → a ghost, faded on the canvas until someone writes in it.
    ghost: parsed.text.trim() === "",
    parentId: parentObjectId,
    userId,
    isFirstNode,
  });
};

const updateNodeSchema = z
  .object({
    text: z.string().min(1).optional(),
    // "" clears the title (back to the text's own first words).
    title: titleSchema.optional(),
    prompt: promptSchema.optional(),
    zoneName: zoneNameSchema.optional(),
    // "" removes the emoji.
    emoji: emojiSchema.optional(),
    // The node's whole picture list — [] removes them all.
    images: imagesSchema.optional(),
    // "" removes the picture icon.
    iconImage: iconImageSchema.optional(),
    // "" removes the picture card.
    cardImage: cardImageSchema.optional(),
    // null clears the step number — same nullish-vs-absent convention as
    // symbolOverride/manualZone below.
    order: orderSchema.nullish(),
    type: z.enum(NODE_TYPES, {
      error: () => `type must be one of: ${NODE_TYPES.join(", ")}`,
    }).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    // Puzzle-card position (see Node.cardX) — null forgets it, so the card
    // goes back to sitting at x/y.
    cardX: z.number().nullish(),
    cardY: z.number().nullish(),
    // A card's own size, text size and outline (see Node.cardW) — null goes
    // back to the default.
    cardW: z.number().min(CARD_SIZE_MIN).max(CARD_SIZE_MAX).nullish(),
    cardH: z.number().min(CARD_SIZE_MIN).max(CARD_SIZE_MAX).nullish(),
    cardFont: z.number().min(CARD_FONT_MIN).max(CARD_FONT_MAX).nullish(),
    cardShape: z.enum(CARD_SHAPES).nullish(),
    emojiStill: z.boolean().optional(),
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
    // null goes back to the usual circle.
    shape: z.enum(NODE_SHAPES).nullish(),
    // null goes back to no pattern / the sentiment colour.
    zonePattern: z.enum(ZONE_PATTERNS).nullish(),
    zoneColor: z.enum(ZONE_PALETTE).nullish(),
    // 0..1 — null goes back to the default outline brightness.
    zoneEdge: z.number().min(0).max(1).nullish(),
    // The fill colour of the picture this node is a dot of (Node.picture.color)
    // — null goes back to the picture's own colour.
    pictureColor: z.enum(ZONE_PALETTE).nullish(),
  })
  .refine((fields) => Object.values(fields).some((v) => v !== undefined), {
    error: "No fields to update",
  });

const HISTORY_FIELDS = ["text", "title", "type"] as const;

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
  // Writing text into a ghost fills it in (see Node.ghost).
  if (typeof definedUpdates.text === "string") definedUpdates.ghost = false;

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

  // Only a dot of a picture has a picture colour; it lives inside Node.picture.
  if ("pictureColor" in definedUpdates) {
    const node = await findNodeByPublicIdDao(publicNodeId);
    if (!node) return null;
    if (!node.picture) throw new ValidationError("node is not part of a picture");
    definedUpdates["picture.color"] = definedUpdates.pictureColor;
    delete definedUpdates.pictureColor;
  }

  if (typeof definedUpdates.zoneColor === "string") {
    const node = await findNodeByPublicIdDao(publicNodeId);
    if (node && (await zoneColorTakenDao(node.mapId, definedUpdates.zoneColor, userId))) throw new ZoneColorTakenError();
  }

  // In a discussion, a change to what a node says goes into the map's
  // history (see historyAbl.ts) — so read it as it was first.
  const before = HISTORY_FIELDS.some((f) => f in definedUpdates) ? await findNodeByPublicIdDao(publicNodeId) : null;

  if (!IMAGE_FIELDS.some((f) => f in definedUpdates)) {
    const updated = await updateNodeDao(publicNodeId, userId, definedUpdates);
    if (before && updated) await recordEditAbl(before.toObject?.() ?? before, updated, userId);
    return updated;
  }

  // Pictures go to the image store, and the node keeps their addresses.
  // Only the node's creator may edit it — the same rule updateNodeDao's own
  // filter applies, checked first here so nobody else can store pictures.
  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node || node.userId.toString() !== userId.toString()) return null;
  await storeImageFields(definedUpdates, node, userId);
  const updated = await updateNodeDao(publicNodeId, userId, definedUpdates);
  if (before && updated) await recordEditAbl(before.toObject?.() ?? before, updated, userId);
  // Whatever the node no longer points at (a removed picture, a replaced
  // icon) is deleted from the store.
  await deleteNodeImagesExceptDao(node._id, referencedImageIds(updated ?? node));
  return updated;
};

// The most nodes one move may carry — far more than any selection on a map.
export const MAX_MOVED_NODES = 500;

const moveNodesSchema = z.object({
  moves: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        x: z.number().optional(),
        y: z.number().optional(),
        // A puzzle card's own spot (see Node.cardX); null forgets it.
        cardX: z.number().nullish(),
        cardY: z.number().nullish(),
      }),
    )
    .min(1, "moves must list at least one node")
    .max(MAX_MOVED_NODES, `moves can list at most ${MAX_MOVED_NODES} nodes`),
});

type MovedNode = Awaited<ReturnType<typeof moveNodesDao>>[number];

// Several nodes moved at once, saved in one go (see moveNodesDao). Returns
// the moved nodes, and how to tell each map about them: one batch for
// everyone, and a separate one for nodes in a branch hidden from invited
// members, so a hidden node in the group doesn't keep the visible ones'
// moves from the members too (broadcastToMap sends a batch that mentions a
// hidden node to the owner alone).
export const moveNodesAbl = async (userId: string, input: unknown) => {
  const { moves } = parseOrThrow(moveNodesSchema, input);
  const nodes = await moveNodesDao(
    moves.map(({ nodeId, ...spot }) => ({
      nodeId,
      spot: Object.fromEntries(Object.entries(spot).filter(([, v]) => v !== undefined)) as Record<string, number | null>,
    })),
    userId,
  );

  const byMap = new Map<string, { internalId: mongoose.Types.ObjectId; nodes: MovedNode[] }>();
  for (const node of nodes) {
    const map = node.mapId as unknown as { _id: mongoose.Types.ObjectId; mapId?: string } | null;
    if (!map?.mapId) continue;
    const entry = byMap.get(map.mapId) ?? { internalId: map._id, nodes: [] };
    entry.nodes.push(node);
    byMap.set(map.mapId, entry);
  }
  const broadcasts: { publicMapId: string; nodes: MovedNode[] }[] = [];
  for (const [publicMapId, { internalId, nodes: onMap }] of byMap) {
    const hidden = (await getHiddenNodesDao(internalId)).publicIds;
    const shown = onMap.filter((n) => !hidden.has(n.nodeId));
    const hiddenOnes = onMap.filter((n) => hidden.has(n.nodeId));
    if (shown.length) broadcasts.push({ publicMapId, nodes: shown });
    if (hiddenOnes.length) broadcasts.push({ publicMapId, nodes: hiddenOnes });
  }
  return { nodes, broadcasts };
};

const setBranchHiddenSchema = z.object({ hidden: z.boolean({ error: () => "hidden must be true or false" }) });

// The map's owner hides or shows a branch (this node and everything hanging
// from it) for the map's invited members. Returns null if the node does not
// exist. See dao/visibilityDao.ts.
export const setBranchHiddenAbl = async (publicNodeId: string, userId: string, input: unknown) => {
  const { hidden } = parseOrThrow(setBranchHiddenSchema, input);
  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;
  const map = await getMapByInternalIdDao(node.mapId);
  if (!map) return null;
  if (map.ownerId.toString() !== userId.toString()) throw new NotMapOwnerError();
  return await setBranchHiddenMutationDao(publicNodeId, hidden);
};

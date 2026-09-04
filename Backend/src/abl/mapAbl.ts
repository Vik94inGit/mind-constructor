import { z } from "zod";
import {
  createMapDao,
  getMapByIdDao,
  setMemberColorMutationDao,
  getMapsDao,
  updateMapDao,
  inviteUserToMapDao,
} from "../dao/mapsDao.js";
import { parseOrThrow } from "./errors.js";
import { createNodeAbl } from "./nodeAbl.js";
import type { NodeType } from "../models/Node.js";

// A Mongo ObjectId is always exactly 24 hex characters — cheap to check
// before ever handing the value to Mongoose, which would otherwise throw its
// own opaque CastError for a malformed one.
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export class ColorTakenError extends Error {}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const hexColor = (fieldName: string) =>
  z.string().regex(HEX_COLOR, `${fieldName} must be a hex color (e.g. #4f46e5)`);

// One node in a starting template's tree — seeded via createNodeAbl in the
// same parent-then-children order a user would build it by hand, so it goes
// through the exact same validation/membership/isFirstNode logic a real
// creation does. x/y are deliberately left unset: the frontend's own
// positions memo already falls back to a spiral layout for any node without
// them (see MapPage.tsx), so there's no canvas-geometry decision to make
// here at all.
interface TemplateNodeSpec {
  text: string;
  type: NodeType;
  children?: TemplateNodeSpec[];
}

const MAP_TEMPLATES = {
  // The long-standing default: creating a map has never seeded anything,
  // and most maps (this app's own test/demo ones included) still start
  // this way — kept as the first, and default, choice.
  blank: [] as TemplateNodeSpec[],
  // A minimal nudge to start branching from, for someone who'd rather not
  // stare at an empty canvas.
  "single-problem": [{ text: "Problem", type: "Problem" }],
  // A root Problem with two Option children already branched off it —
  // the shape a "weigh these alternatives" map ends up in anyway.
  "decision-tree": [
    {
      text: "Problem",
      type: "Problem",
      children: [
        { text: "Option A", type: "Option" },
        { text: "Option B", type: "Option" },
      ],
    },
  ],
  // A root topic with one halo-side and one horns-side child already
  // branched off it, priming both a case-for and a case-against.
  "pro-con": [
    {
      text: "Topic",
      type: "unknown",
      children: [
        { text: "Solution", type: "Solution" },
        { text: "Problematic option", type: "Problematic option" },
      ],
    },
  ],
} satisfies Record<string, TemplateNodeSpec[]>;

const MAP_TEMPLATE_KEYS = Object.keys(MAP_TEMPLATES) as (keyof typeof MAP_TEMPLATES)[];

const createMapSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ownerColor: hexColor("ownerColor"),
  color: hexColor("color").optional(),
  template: z.enum(MAP_TEMPLATE_KEYS).optional(),
  // See Map.discussionMode / attackAbl.ts. Defaults to false (normal
  // combat rules) via the Map model itself — omitting this is exactly the
  // same as sending false.
  discussionMode: z.boolean().optional(),
});

// Seeds one template's node tree via the real createNodeAbl, not a direct
// DAO call — a parent has to exist (and its public nodeId known) before a
// child can resolve parentId against it, same ordering createNodeAbl
// already enforces for a user branching by hand. Recurses depth-first so a
// grandchild template node (none exist yet, but nothing stops one) would
// still resolve against its own just-created parent.
async function seedTemplateNodes(
  specs: TemplateNodeSpec[],
  parentPublicId: string | null,
  publicMapId: string,
  ownerId: string,
) {
  for (const spec of specs) {
    const node = await createNodeAbl(
      { text: spec.text, type: spec.type, parentId: parentPublicId },
      publicMapId,
      ownerId,
    );
    if (spec.children?.length) {
      await seedTemplateNodes(spec.children, node.nodeId, publicMapId, ownerId);
    }
  }
}

export const createMapAbl = async (input: unknown, ownerId: string) => {
  const { template, ...parsed } = parseOrThrow(createMapSchema, input);
  const map = await createMapDao({ ...parsed, ownerId });
  if (template && template !== "blank") {
    await seedTemplateNodes(MAP_TEMPLATES[template], null, map.mapId, ownerId);
  }
  return map;
};

// Every field optional (it's a partial update) but the object as a whole
// can't be empty — a no-op PATCH is almost always a client bug, not
// something worth silently accepting. Deliberately omits `name`/`members`/
// `mapId`/`ownerId` — ownership and membership change through their own
// endpoints (invite, admin actions), not a generic field-by-field PATCH.
const updateMapSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    color: hexColor("color").optional(),
    // Toggled live from the map itself (not just at creation) — see
    // Map.discussionMode / attackAbl.ts.
    discussionMode: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export const updateMapAbl = async (
  publicMapId: string,
  userId: string,
  input: unknown,
) => {
  const updates = parseOrThrow(updateMapSchema, input);
  return await updateMapDao(publicMapId, userId, updates);
};

const inviteUserSchema = z.object({
  userIdToInvite: z
    .string()
    .min(1, "userIdToInvite is required")
    .regex(OBJECT_ID, "userIdToInvite must be a valid user id"),
});

export const inviteUserToMapAbl = async (
  publicMapId: string,
  input: unknown,
  currentUserId: string,
) => {
  const { userIdToInvite } = parseOrThrow(inviteUserSchema, input);
  return await inviteUserToMapDao(publicMapId, userIdToInvite, currentUserId);
};

const setColorSchema = z.object({ color: hexColor("color") });

// Two members can't share a color on the same map, so contributions stay
// visually distinct — that decision lives here, not in the DAO.
export const setMapColorAbl = async (
  publicMapId: string,
  userId: string,
  input: unknown,
) => {
  const { color } = parseOrThrow(setColorSchema, input);

  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null; // doesn't exist, or you're not a member

  const takenByOther = map.memberColors.some(
    (mc) =>
      mc.userId.toString() !== userId.toString() &&
      mc.color.toLowerCase() === color.toLowerCase(),
  );
  if (takenByOther) throw new ColorTakenError();

  return await setMemberColorMutationDao(map._id, userId, color);
};

const MAP_FILTERS = ["all", "owned", "shared"] as const;
type MapFilter = (typeof MAP_FILTERS)[number];

const isMapFilter = (value: unknown): value is MapFilter =>
  typeof value === "string" && (MAP_FILTERS as readonly string[]).includes(value);

// Invalid/missing filter silently falls back to "all" rather than erroring —
// this one's a display preference, not a security boundary, so being lenient
// costs nothing.
export const getMapsAbl = async (userId: string, rawFilter: unknown) => {
  const filter = isMapFilter(rawFilter) ? rawFilter : "all";
  return await getMapsDao(userId, filter);
};

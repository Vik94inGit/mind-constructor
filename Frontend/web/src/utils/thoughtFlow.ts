import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import { CANVAS_H, CANVAS_W, avoidOverlap, getCirclePackSpacing, spiralPoint } from "./canvasLayout";
import type { Obstacle } from "./canvasLayout";
import type { MapDoc, MapKind, NodeType } from "../types";

// The "Think it through" flow (pages/ThinkPage.tsx): the user writes the one
// thought at the center of what's on their mind, answers a few guiding
// questions with as many short thoughts as come, sorts them, and gets them
// back as a real map — instead of starting from a blank canvas or a template
// full of someone else's placeholder text.

/** Keys into t.ui.think.prompts — one guiding question each. */
export type PromptKey =
  | "whyHard"
  | "tried"
  | "couldDo"
  | "solved"
  | "doNothing"
  | "unknowns"
  | "options"
  | "matters"
  | "bestCase"
  | "worries"
  | "leaning"
  | "howKnow"
  | "firstStep"
  | "inTheWay"
  | "helps"
  | "ifNot"
  | "wentWell"
  | "wentBad"
  | "whyHappened"
  | "nextTime"
  | "anythingElse";

export interface FlowPrompt {
  key: PromptKey;
  /** What a thought written under this question starts out as — changeable later. */
  type: NodeType;
}

// The questions asked for each starting point, in order. Each one leans a
// thought towards a node type, so most answers land already sorted and the
// "Shape" step is a quick check rather than a chore. Every list ends with the
// open "anything else" question so nothing the user has in mind is left out
// because no question fit it.
export const FLOW_PROMPTS: Record<MapKind, FlowPrompt[]> = {
  problem: [
    { key: "whyHard", type: "Problem" },
    { key: "tried", type: "Problematic option" },
    { key: "couldDo", type: "Option" },
    { key: "solved", type: "Success" },
    { key: "doNothing", type: "Fail" },
    { key: "unknowns", type: "unknown" },
    { key: "anythingElse", type: "unknown" },
  ],
  decision: [
    { key: "options", type: "Option" },
    { key: "matters", type: "unknown" },
    { key: "bestCase", type: "Success" },
    { key: "worries", type: "Fail" },
    { key: "leaning", type: "Solution" },
    { key: "anythingElse", type: "unknown" },
  ],
  goal: [
    { key: "howKnow", type: "Success" },
    { key: "firstStep", type: "Option" },
    { key: "inTheWay", type: "Problem" },
    { key: "helps", type: "Solution" },
    { key: "ifNot", type: "Fail" },
    { key: "anythingElse", type: "unknown" },
  ],
  retro: [
    { key: "wentWell", type: "Success" },
    { key: "wentBad", type: "Fail" },
    { key: "whyHappened", type: "Problem" },
    { key: "nextTime", type: "Option" },
    { key: "anythingElse", type: "unknown" },
  ],
};

/** The central thought's own type for each starting point (same roots as MAP_KIND_ROOTS). */
export const FLOW_ROOT_TYPE: Record<MapKind, NodeType> = {
  problem: "Problem",
  decision: "Problem",
  goal: "Solution",
  retro: "unknown",
};

export const ROOT_ID = "root";

export interface Thought {
  id: string;
  text: string;
  type: NodeType;
  /** ROOT_ID or another thought's id. */
  parentId: string;
  /** The question it was written under — just for grouping in the Write step. */
  prompt: PromptKey;
}

export interface ThoughtDraft {
  kind: MapKind;
  center: string;
  thoughts: Thought[];
  step: number;
  promptIndex: number;
}

export function emptyDraft(kind: MapKind = "problem", center = ""): ThoughtDraft {
  return { kind, center, thoughts: [], step: 0, promptIndex: 0 };
}

export function newThoughtId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** True when `candidateId` is `id` itself or hangs (at any depth) from it. */
export function isWithin(candidateId: string, id: string, thoughts: Thought[]): boolean {
  const byId = new Map(thoughts.map((t) => [t.id, t]));
  let cur: string | undefined = candidateId;
  const seen = new Set<string>();
  while (cur && cur !== ROOT_ID && !seen.has(cur)) {
    if (cur === id) return true;
    seen.add(cur);
    cur = byId.get(cur)?.parentId;
  }
  return false;
}

/** Removes a thought; whatever hung from it moves up to its parent instead of disappearing. */
export function removeThought(thoughts: Thought[], id: string): Thought[] {
  const gone = thoughts.find((t) => t.id === id);
  if (!gone) return thoughts;
  return thoughts
    .filter((t) => t.id !== id)
    .map((t) => (t.parentId === id ? { ...t, parentId: gone.parentId } : t));
}

/** Parents before children, so every node can point at an already-created parent. */
export function orderParentsFirst(thoughts: Thought[]): Thought[] {
  const ids = new Set(thoughts.map((t) => t.id));
  const children = new Map<string, Thought[]>();
  for (const t of thoughts) {
    // A parent that no longer exists means "hang from the center".
    const parent = ids.has(t.parentId) ? t.parentId : ROOT_ID;
    children.set(parent, [...(children.get(parent) ?? []), t]);
  }
  const out: Thought[] = [];
  const seen = new Set<string>();
  const walk = (parent: string) => {
    for (const t of children.get(parent) ?? []) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
      walk(t.id);
    }
  };
  walk(ROOT_ID);
  // Anything stuck in a parent loop (shouldn't happen — the Shape step never
  // offers one) still gets created, hung from the center.
  for (const t of thoughts) if (!seen.has(t.id)) out.push({ ...t, parentId: ROOT_ID });
  return out;
}

const EDGE = 120;

/**
 * Canvas positions for the root and every thought — the same sunflower spiral
 * around the root a template's nodes get (see layoutTemplate), in
 * parents-first order so a branch's nodes land near each other.
 */
export function layoutThoughts(thoughts: Thought[]): { root: { x: number; y: number }; positions: Map<string, { x: number; y: number }> } {
  const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const spacing = getCirclePackSpacing();
  const obstacles: Obstacle[] = [{ ...root, minDist: spacing }];
  const positions = new Map<string, { x: number; y: number }>();
  orderParentsFirst(thoughts).forEach((t, i) => {
    const placed = avoidOverlap(spiralPoint(i + 1, root, spacing), obstacles);
    obstacles.push({ x: placed.x, y: placed.y, minDist: spacing });
    positions.set(t.id, {
      x: Math.min(CANVAS_W - EDGE, Math.max(EDGE, placed.x)),
      y: Math.min(CANVAS_H - EDGE, Math.max(EDGE, placed.y)),
    });
  });
  return { root, positions };
}

/** A map name from the central thought — its first line, cut at a word near 60 characters. */
export function suggestMapName(center: string): string {
  const line = center.trim().split(/\n/)[0].trim();
  if (line.length <= 60) return line;
  const cut = line.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * Creates the map and every thought on it as a real node. `onProgress` gets
 * how many nodes exist so far out of the total (root included).
 */
export async function buildMapFromDraft(
  draft: ThoughtDraft,
  options: {
    name: string;
    personal: boolean;
    ownerColor: string;
    color: string;
    /** The center node's type; defaults to the one the draft's kind starts from. */
    rootType?: NodeType;
    /** false: the map gets no kind (it wasn't made from one of the starting points). */
    withKind?: boolean;
  },
  onProgress?: (done: number, total: number) => void,
): Promise<MapDoc> {
  const thoughts = draft.thoughts.filter((t) => t.text.trim());
  const total = thoughts.length + 1;
  const map = await mapsApi.createMap({
    name: options.name.trim() || suggestMapName(draft.center),
    ownerColor: options.ownerColor,
    color: options.color,
    kind: options.withKind === false ? undefined : draft.kind,
    discussionMode: !options.personal,
  });
  const { root, positions } = layoutThoughts(thoughts);
  const rootNode = await nodesApi.createNode(map.mapId, {
    text: draft.center.trim(),
    type: options.rootType ?? FLOW_ROOT_TYPE[draft.kind],
    x: root.x,
    y: root.y,
  });
  onProgress?.(1, total);
  const nodeIds = new Map<string, string>([[ROOT_ID, rootNode.nodeId]]);
  let done = 1;
  for (const t of orderParentsFirst(thoughts)) {
    const pos = positions.get(t.id)!;
    const node = await nodesApi.createNode(map.mapId, {
      text: t.text.trim(),
      type: t.type,
      x: pos.x,
      y: pos.y,
      parentId: nodeIds.get(t.parentId) ?? rootNode.nodeId,
    });
    nodeIds.set(t.id, node.nodeId);
    onProgress?.(++done, total);
  }
  return map;
}

// The draft lives in this browser until the map is built, so closing the tab
// or wandering off mid-thought loses nothing. Per user, so a shared computer
// doesn't hand one person's thoughts to the next.
const draftKey = (userId: string) => `mc_thought_draft:${userId}`;

export function loadDraft(userId: string): ThoughtDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ThoughtDraft;
    if (!d || typeof d.center !== "string" || !Array.isArray(d.thoughts) || !FLOW_PROMPTS[d.kind]) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: ThoughtDraft) {
  try {
    if (!draft.center.trim() && draft.thoughts.length === 0) localStorage.removeItem(draftKey(userId));
    else localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // storage unavailable (private mode, quota) — the flow still works, just unsaved
  }
}

export function clearDraft(userId: string) {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    // ignore
  }
}

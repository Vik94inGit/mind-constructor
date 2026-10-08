import { apiRequest } from "./client";
import * as offline from "../offline/sync";
import { upsertBy } from "../utils/mapGraph";
import type { Attack, AttackNodeType, NodeDoc, NodeType, Weapon } from "../types";

export async function listNodes(mapId: string): Promise<NodeDoc[]> {
  const nodes = await apiRequest<NodeDoc[]>(`/api/${mapId}/nodes`);
  offline.rememberNodes(nodes);
  return nodes;
}

export async function getNode(nodeId: string): Promise<NodeDoc> {
  const res = await apiRequest<{ node: NodeDoc }>(`/api/nodes/${nodeId}`);
  return res.node;
}

export async function createNode(
  mapId: string,
  input: {
    text: string;
    title?: string;
    emoji?: string;
    order?: number | null;
    type: NodeType;
    x?: number;
    y?: number;
    color?: string;
    parentId?: string | null;
    symbolOverride?: NodeDoc["symbolOverride"];
    sizeTier?: NodeDoc["sizeTier"];
    manualZone?: NodeDoc["manualZone"];
  },
): Promise<NodeDoc> {
  const localId = offline.newLocalId();
  const node = await apiRequest<NodeDoc>(`/api/nodes/${mapId}`, {
    method: "POST",
    body: input,
    offline: {
      localId,
      idKey: "nodeId",
      // Same defaults the backend's Node model fills in.
      optimistic: async () => {
        const now = new Date().toISOString();
        const draft: NodeDoc = {
          title: "",
          emoji: "",
          order: null,
          zoneName: "",
          sizeTier: null,
          symbolOverride: null,
          manualZone: null,
          ...input,
          parentId: input.parentId ?? null,
          nodeId: localId,
          mapId,
          userId: offline.getOfflineUserId() ?? "",
          health: 100,
          defeated: false,
          blockedDamage: 0,
          packedIntoNodeId: null,
          locked: false,
          hiddenFromMembers: false,
          createdAt: now,
          updatedAt: now,
        };
        // So the map opens with it even if the canvas isn't up yet (a map made and seeded offline).
        await offline.upsertCached<NodeDoc[]>(`/api/${mapId}/nodes`, [], (list) =>
          upsertBy(list, draft, (n) => n.nodeId),
        );
        await offline.rememberTexts(mapId, { [localId]: input.text });
        return draft;
      },
    },
  });
  offline.rememberNodes([node]);
  return node;
}

export async function updateNode(nodeId: string, updates: Partial<NodeDoc>): Promise<NodeDoc> {
  const node = await apiRequest<NodeDoc>(`/api/nodes/${nodeId}`, {
    method: "PATCH",
    body: updates,
    offline: {
      // A drag sends a move per drop; offline, one request with the last position is enough.
      merge: true,
      optimistic: () => ({
        ...(offline.knownNode<NodeDoc>(nodeId) ?? ({ nodeId } as NodeDoc)),
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
    },
  });
  offline.rememberNodes([node]);
  return node;
}

// damagedProtectedNode: set only when the deleted node was a protection
// node with a nonzero blockedDamage — that whole running total just landed
// on the node it used to defend in one lump sum (see Backend's
// deleteNodeDao). null otherwise.
export async function deleteNode(nodeId: string) {
  return apiRequest<{ success: boolean; deletedId: string; damagedProtectedNode: NodeDoc | null }>(
    `/api/nodes/${nodeId}`,
    {
      method: "DELETE",
      // Offline, a shield's banked damage lands on its target only once the server deletes it.
      offline: { optimistic: () => ({ success: true, deletedId: nodeId, damagedProtectedNode: null }) },
    },
  );
}

// Bulk counterpart of deleteNode, for the multi-select "Delete N nodes"
// action — one request instead of N parallel DELETEs. Same per-node
// ownership contract as the single-node route: an id the caller doesn't own
// (or that's already gone) is silently skipped server-side rather than
// failing the whole batch, so `deleted` may be shorter than `nodeIds`.
export async function deleteManyNodes(nodeIds: string[]) {
  return apiRequest<{
    success: boolean;
    deleted: { deletedId: string; damagedProtectedNode: NodeDoc | null }[];
  }>(`/api/nodes`, {
    method: "DELETE",
    body: { nodeIds },
    offline: {
      optimistic: () => ({
        success: true,
        deleted: nodeIds.map((deletedId) => ({ deletedId, damagedProtectedNode: null })),
      }),
    },
  });
}

// Attacking always creates a real content node alongside the damage — type
// is restricted to AttackNodeType (Problem/Problematic option/Fail), text
// is the attacker's actual objection, both required by the backend.
export async function attackNode(
  nodeId: string,
  weapon: Weapon,
  content: { type: NodeType; text: string },
) {
  // healedParent: set only when this landed as a retaliation (attacking
  // the weapon node that hit your own node) — see Backend's attackAbl.ts.
  // null on an ordinary attack. blocked: true when a linked, undefeated
  // protection node stopped this attack outright (0 damage, banked on the
  // protector instead — see attackAbl.ts's own findActiveProtectorDao
  // check). protector: that protection node's own updated document
  // (its blockedDamage bumped) when blocked, else null.
  return apiRequest<{
    success: boolean;
    node: NodeDoc;
    weaponNode: NodeDoc;
    healedParent: NodeDoc | null;
    blocked: boolean;
    protector: NodeDoc | null;
  }>(`/api/nodes/${nodeId}/attack`, {
    method: "POST",
    body: { weapon, type: content.type, text: content.text },
  });
}

export async function getAttackHistory(nodeId: string): Promise<Attack[]> {
  return apiRequest<Attack[]>(`/api/nodes/${nodeId}/attacks`);
}

// Creates a protection node aimed at nodeId — owner-of-nodeId only (see
// attackAbl.ts's protectNodeAbl). Same content shape as an attack (a real
// typed claim, just framed as a defense). healedNode: the target's own
// updated document — creating a shield immediately heals it once, on top
// of (not instead of) its ongoing block-and-bank-damage behavior.
export async function protectNode(
  nodeId: string,
  content: { type: AttackNodeType; text: string },
) {
  return apiRequest<{ success: boolean; protectionNode: NodeDoc; healedNode: NodeDoc }>(
    `/api/nodes/${nodeId}/protect`,
    {
      method: "POST",
      body: { type: content.type, text: content.text },
    },
  );
}

// Folds nodeIds into containerId — container-owner-only, server-revalidates
// eligibility regardless of what the picker already filtered client-side
// (see packAbl.ts's packNodesAbl).
export async function packNodes(containerId: string, nodeIds: string[]) {
  return apiRequest<{ success: boolean; container: NodeDoc; members: NodeDoc[] }>(
    `/api/nodes/${containerId}/pack`,
    { method: "POST", body: { nodeIds } },
  );
}

// Unpacks one member back into a normal, visible node — scoped to the
// member's own owner (not the container's).
export async function unpackNode(nodeId: string) {
  return apiRequest<{ success: boolean; node: NodeDoc }>(`/api/nodes/${nodeId}/unpack`, {
    method: "POST",
  });
}

// The map's owner hides or shows a branch (this node and everything hanging
// from it) for the map's invited members.
export async function setBranchHidden(nodeId: string, hidden: boolean): Promise<NodeDoc> {
  const res = await apiRequest<{ success: boolean; node: NodeDoc }>(`/api/nodes/${nodeId}/visibility`, {
    method: "POST",
    body: { hidden },
  });
  return res.node;
}

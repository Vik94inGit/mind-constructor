import { apiRequest } from "./client";
import type { Attack, AttackNodeType, NodeDoc, NodeType, Weapon } from "../types";

export async function listNodes(mapId: string): Promise<NodeDoc[]> {
  return apiRequest<NodeDoc[]>(`/api/${mapId}/nodes`);
}

export async function getNode(nodeId: string): Promise<NodeDoc> {
  const res = await apiRequest<{ node: NodeDoc }>(`/api/nodes/${nodeId}`);
  return res.node;
}

export async function createNode(
  mapId: string,
  input: { text: string; type: NodeType; x?: number; y?: number; color?: string; parentId?: string | null },
): Promise<NodeDoc> {
  return apiRequest<NodeDoc>(`/api/nodes/${mapId}`, { method: "POST", body: input });
}

export async function updateNode(nodeId: string, updates: Partial<NodeDoc>): Promise<NodeDoc> {
  return apiRequest<NodeDoc>(`/api/nodes/${nodeId}`, { method: "PATCH", body: updates });
}

// damagedProtectedNode: set only when the deleted node was a protection
// node with a nonzero blockedDamage — that whole running total just landed
// on the node it used to defend in one lump sum (see Backend's
// deleteNodeDao). null otherwise.
export async function deleteNode(nodeId: string) {
  return apiRequest<{ success: boolean; deletedId: string; damagedProtectedNode: NodeDoc | null }>(
    `/api/nodes/${nodeId}`,
    { method: "DELETE" },
  );
}

// Attacking always creates a real content node alongside the damage — type
// is restricted to AttackNodeType (Problem/Problematic option/Fail), text
// is the attacker's actual objection, both required by the backend.
export async function attackNode(
  nodeId: string,
  weapon: Weapon,
  content: { type: AttackNodeType; text: string },
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

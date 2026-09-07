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

export async function deleteNode(nodeId: string) {
  return apiRequest<{ success: boolean; deletedId: string }>(`/api/nodes/${nodeId}`, { method: "DELETE" });
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
  // null on an ordinary attack.
  return apiRequest<{ success: boolean; node: NodeDoc; weaponNode: NodeDoc; healedParent: NodeDoc | null }>(
    `/api/nodes/${nodeId}/attack`,
    {
      method: "POST",
      body: { weapon, type: content.type, text: content.text },
    },
  );
}

export async function getAttackHistory(nodeId: string): Promise<Attack[]> {
  return apiRequest<Attack[]>(`/api/nodes/${nodeId}/attacks`);
}

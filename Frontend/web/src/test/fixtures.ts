// Shared minimal fixtures for hook/component tests — only the fields each
// pure function/hook actually reads, defaulted so a test only has to spell
// out what it cares about. (canvasLayout.test.ts and nodeClipboard.test.ts
// predate this file and keep their own local copies rather than being
// churned to import it.)
import type { EdgeDoc, NodeDoc } from "../types";

export function makeNode(overrides: Partial<NodeDoc> & { nodeId: string }): NodeDoc {
  return {
    text: "some text",
    type: "unknown",
    parentId: null,
    userId: "u1",
    health: 100,
    defeated: false,
    x: 0,
    y: 0,
    ...overrides,
  };
}

export function makeEdge(fromNodeId: string, toNodeId: string, overrides: Partial<EdgeDoc> = {}): EdgeDoc {
  return {
    edgeId: `${fromNodeId}-${toNodeId}`,
    mapId: "m1",
    fromNodeId,
    toNodeId,
    sentiment: "neutral",
    userId: "u1",
    ...overrides,
  };
}

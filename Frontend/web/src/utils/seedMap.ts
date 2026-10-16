import * as nodesApi from "../api/nodes";
import { CANVAS_W } from "./canvasLayout";
import { layoutTemplate, MAP_KIND_ROOTS } from "./templates";
import type { TemplateNodeKey } from "./templates";
import type { MapKind } from "../types";

// Fills a freshly created map with the starter structure for its kind: a root
// node in the upper middle of the canvas and the kind's template grown below
// it, every node a ghost: no text or title, only its prompt (in the user's
// language), shown as a placeholder until someone writes in it.
export async function seedMapKind(
  mapId: string,
  kind: MapKind,
  prompts: Record<TemplateNodeKey, string>,
): Promise<void> {
  const root = MAP_KIND_ROOTS[kind];
  const rootPos = { x: CANVAS_W / 2, y: 380 };
  const rootNode = await nodesApi.createNode(mapId, {
    text: "",
    prompt: prompts[root.key],
    type: root.type,
    x: rootPos.x,
    y: rootPos.y,
  });
  const ids = new Map<TemplateNodeKey, string>();
  for (const p of layoutTemplate(root.template, rootPos)) {
    const node = await nodesApi.createNode(mapId, {
      text: "",
      prompt: prompts[p.key],
      type: p.type,
      order: p.order,
      x: p.x,
      y: p.y,
      parentId: p.parentKey ? ids.get(p.parentKey) : rootNode.nodeId,
    });
    ids.set(p.key, node.nodeId);
  }
}

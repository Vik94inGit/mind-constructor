import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

// Walks the map's branch tree (Node.parentId — the same lineage
// nodeGroups/branch-arrows already read on the canvas, not the separate
// Link/Edge graph) and formats it as one plain-text/markdown document: one
// section per node that has 1+ direct children, headed by that parent's
// own text, followed by a bulleted list of its children's text. Nodes are
// ordered top-to-bottom, then left-to-right, at every level — both the
// sections themselves (ordered by their own parent's position) and each
// section's own bullet list (ordered by each child's position) — so the
// document reads in the same spatial order the canvas itself does. A node
// with grandchildren gets its own section further down (as a parent in its
// own right), so it shows up twice — once as a bullet under its parent,
// once as its own heading — same as a nested outline reads, just flattened
// into sections instead of indentation.
//
// Auto-spawned weapon/protection nodes are excluded entirely (isWeapon/
// isProtection) — they're combat artifacts hung off a target via
// targetNodeId/protectsNodeId, not part of the argument tree a parentId
// walk is meant to capture, and would otherwise flood the export with
// every attack/shield ever made instead of the map's actual content.
//
// A node that's neither a parent-with-children nor anyone's child (no
// branch at all, fully disconnected) would otherwise never appear anywhere
// in this section format; those are collected into one trailing "Other
// nodes" section instead of silently dropped.
export function buildTreeExport(
  allNodes: NodeDoc[],
  positions: Map<string, { x: number; y: number }>,
): string {
  const nodes = allNodes.filter((n) => !n.isWeapon && !n.isProtection);
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));

  const childrenByParent = new Map<string, NodeDoc[]>();
  for (const n of nodes) {
    const parentId = nodeRefId(n.parentId);
    if (!parentId || !byId.has(parentId)) continue;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId)!.push(n);
  }

  // Falls back to the node's own stored x/y if this particular id has no
  // entry in `positions` (e.g. called with a stale/partial map) — never
  // throws on a lookup miss, just orders that node last-ish at (0,0).
  function pos(n: NodeDoc) {
    return positions.get(n.nodeId) ?? { x: n.x ?? 0, y: n.y ?? 0 };
  }
  function byPosition(a: NodeDoc, b: NodeDoc) {
    const pa = pos(a);
    const pb = pos(b);
    return pa.y - pb.y || pa.x - pb.x;
  }

  const parents = Array.from(childrenByParent.keys())
    .map((id) => byId.get(id)!)
    .sort(byPosition);

  const lines: string[] = [];
  for (const parent of parents) {
    const children = childrenByParent.get(parent.nodeId)!.slice().sort(byPosition);
    lines.push(`## ${parent.type}: ${parent.text}`);
    for (const child of children) {
      lines.push(`- ${child.type}: ${child.text}`);
    }
    lines.push("");
  }

  const covered = new Set<string>(parents.map((p) => p.nodeId));
  for (const list of childrenByParent.values()) for (const c of list) covered.add(c.nodeId);
  const orphans = nodes.filter((n) => !covered.has(n.nodeId)).sort(byPosition);
  if (orphans.length > 0) {
    lines.push("## Other nodes");
    for (const n of orphans) lines.push(`- ${n.type}: ${n.text}`);
    lines.push("");
  }

  return lines.join("\n").trim() || "Nothing to export yet — this map has no nodes.";
}

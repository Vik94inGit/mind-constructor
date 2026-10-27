import type { NodeDoc, NodeType } from "../types";

// The map's node filter (map/NodeSearch.tsx): words typed into the search
// and the node types picked under it. A node passes when it carries every
// typed word (in its title, text or zone name) and, if any types are picked,
// is one of them. Nodes that don't pass dim on the canvas.

// Lowercase and without accents, so "kralovstvi" finds "Království".
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** True while the filter narrows anything at all. */
export function isFiltering(query: string, types: readonly NodeType[]): boolean {
  return query.trim().length > 0 || types.length > 0;
}

export function filterNodes<N extends Pick<NodeDoc, "type" | "text" | "title" | "zoneName">>(
  nodes: N[],
  query: string,
  types: readonly NodeType[],
): N[] {
  const needle = fold(query.trim());
  const picked = new Set(types);
  return nodes.filter(
    (n) =>
      (picked.size === 0 || picked.has(n.type)) &&
      (!needle || fold(`${n.title ?? ""} ${n.text} ${n.zoneName ?? ""}`).includes(needle)),
  );
}

/** Adds the type if it isn't picked yet, takes it off if it is. */
export function toggleType(types: readonly NodeType[], type: NodeType): NodeType[] {
  return types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
}

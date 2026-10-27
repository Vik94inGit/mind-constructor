import { useState } from "react";
import * as nodesApi from "../api/nodes";
import type { NodeDoc } from "../types";

/** Whether a node has any picture to show full size before its panel. */
export function hasPictures(node: NodeDoc): boolean {
  return Boolean(node.cardImage || node.iconImage || node.images?.length);
}

// A node's pictures, open full size before its panel (see MapPage's
// handleNodeClick). Closing them hands the node on (onClosed), which opens
// its panel.
export function usePictureView(nodes: NodeDoc[], onClosed: (node: NodeDoc) => void) {
  const [pictureView, setPictureView] = useState<{ nodeId: string; images: string[] | null } | null>(null);

  // The map's node list leaves `images` out, so they're fetched here; the
  // card or icon picture stands in when the node has none of its own.
  function openPictureView(node: NodeDoc) {
    const fallback = [node.cardImage, node.iconImage].filter((src): src is string => Boolean(src));
    setPictureView({ nodeId: node.nodeId, images: node.images?.length ? node.images : null });
    if (node.images?.length) return;
    nodesApi
      .getNode(node.nodeId)
      .then((full) => (full.images?.length ? full.images : fallback))
      .catch(() => fallback)
      .then((images) => setPictureView((cur) => (cur?.nodeId === node.nodeId ? { ...cur, images } : cur)));
  }

  function closePictureView() {
    const node = pictureView && nodes.find((n) => n.nodeId === pictureView.nodeId);
    setPictureView(null);
    if (node) onClosed(node);
  }

  return { pictureView, openPictureView, closePictureView, clearPictureView: () => setPictureView(null) };
}

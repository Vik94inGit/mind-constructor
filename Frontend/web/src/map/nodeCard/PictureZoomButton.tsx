import { useState } from "react";
import * as nodesApi from "../../api/nodes";
import { useI18n } from "../../i18n/I18nContext";
import type { NodeDoc } from "../../types";
import { PictureViewer } from "../PictureViewer";
import { ZoomGlass } from "../ZoomGlass";

interface Props {
  node: NodeDoc;
  /** Shown for good (the node is selected); otherwise only a hovering mouse brings it up. */
  shown: boolean;
}

/**
 * The 🔍 on a node's picture card or picture icon, top-right: opens the
 * picture full screen to zoom in (PictureViewer). The map shows a small copy,
 * so the viewer starts on that and swaps in the node's own full-size
 * pictures (NodeDoc.images, left out of the map's node list) once they're
 * fetched.
 */
export function PictureZoomButton({ node, shown }: Props) {
  const { t } = useI18n();
  const [sources, setSources] = useState<string[] | null>(null);
  const thumb = node.cardImage || node.iconImage || "";

  function open() {
    if (node.images?.length) {
      setSources(node.images);
      return;
    }
    setSources([thumb]);
    nodesApi
      .getNode(node.nodeId)
      .then((full) => {
        if (full.images?.length) setSources((cur) => (cur ? full.images! : cur));
      })
      .catch(() => {});
  }

  if (!thumb) return null;
  return (
    <>
      <button
        type="button"
        data-testid="node-picture-zoom"
        className={`pointer-events-auto absolute -top-2.5 -right-2.5 z-[7] flex before:absolute before:-inset-2 before:content-[""] h-[1.5rem] w-[1.5rem] cursor-zoom-in items-center justify-center rounded-full border-2 border-accent bg-surface p-0 text-ink shadow-card hover:bg-surface-2 ${
          shown ? "" : "invisible transition-[visibility] delay-300 group-hover:visible group-hover:delay-0"
        }`}
        aria-label={t.ui.images.zoom}
        title={t.ui.images.zoom}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
      >
        <ZoomGlass size={13} />
      </button>
      {sources && <PictureViewer sources={sources} onClose={() => setSources(null)} />}
    </>
  );
}

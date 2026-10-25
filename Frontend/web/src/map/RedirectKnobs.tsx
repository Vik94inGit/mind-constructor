import type { PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "../i18n/I18nContext";
import { isMobileViewport } from "../utils/canvasLayout";
import { knobSpot } from "../utils/edgeRedirect";
import { zoneParentId } from "../utils/nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Props {
  /** The opened node: its own branch to its parent and its children's branches get a knob. */
  selected: NodeDoc;
  visibleNodes: NodeDoc[];
  posFor: (node: NodeDoc) => Pt;
  zoom: number;
  /** Whether this child's branch can be redirected (yours, and nothing else owns the canvas). */
  canRedirect: (child: NodeDoc) => boolean;
  /** A knob grabbed: start redirecting that child's parent end (hooks/useEdgeRedirect.ts). */
  onStart: (child: NodeDoc, e: ReactPointerEvent) => void;
  /**
   * A branch is being redirected: the knobs step out of sight and out of the
   * finger's way, but stay mounted — the grabbed one holds the touch, and a
   * touch whose element is removed mid-drag can stop reporting its moves.
   */
  hidden?: boolean;
}

// The knobs that change a parent: one on each branch of the opened node.
// Drawn above the nodes and the ring of ghosts (an HTML layer, not the
// backdrop SVG underneath everything), placed on the branch just past the
// ring, and kept one size on screen at any zoom — finger-sized on a phone.
// Grabbing one never pans the map (touch-action: none).
export function RedirectKnobs({ selected, visibleNodes, posFor, zoom, canRedirect, onStart, hidden = false }: Props) {
  const { t } = useI18n();
  const mobile = isMobileViewport();
  const k = 1 / zoom;
  // Just past the quick-add ring (QuickAddGhosts' RADIUS) plus a ghost's half-width.
  const clear = ((mobile ? 104 : 126) + 36) * k;
  const size = mobile ? 30 : 22;
  const hit = mobile ? 48 : 30;
  const byId = new Map(visibleNodes.map((n) => [n.nodeId, n]));
  const from = posFor(selected);
  const branches: NodeDoc[] = [];
  const parentId = zoneParentId(selected);
  if (parentId && byId.has(parentId)) branches.push(selected);
  for (const n of visibleNodes) if (zoneParentId(n) === selected.nodeId) branches.push(n);
  return (
    <>
      {branches.filter(canRedirect).map((child) => {
        const other = child.nodeId === selected.nodeId ? byId.get(parentId!)! : child;
        const at = knobSpot(from, posFor(other), clear);
        return (
          <button
            key={child.nodeId}
            type="button"
            data-redirect-knob={child.nodeId}
            title={t.ui.canvas.redirectBranch}
            aria-label={t.ui.canvas.redirectBranch}
            className="absolute z-[45] flex cursor-grab items-center justify-center rounded-full"
            style={{
              left: at.x,
              top: at.y,
              width: hit,
              height: hit,
              transform: `translate(-50%, -50%) scale(${k})`,
              touchAction: "none",
              ...(hidden ? { visibility: "hidden" as const, pointerEvents: "none" as const } : {}),
            }}
            onPointerDown={(e) => onStart(child, e)}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="block rounded-full border-[3px] border-accent bg-surface shadow-card"
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </>
  );
}

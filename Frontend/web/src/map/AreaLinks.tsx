import { memo } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { AreaLink } from "../utils/mapAreas";
import type { NodeDoc } from "../types";

interface Props {
  links: AreaLink[];
  nodeById: Map<string, NodeDoc>;
  posFor: (node: NodeDoc) => { x: number; y: number };
  zoom: number;
  /** Shows the other area with that thought picked and in view. */
  onGo: (link: AreaLink) => void;
}

// The links between a map's areas (utils/mapAreas.ts areaLinks): a small
// chip over a thought whose parent is on another area ("From area 1"), and
// over a parent with a child elsewhere ("Continues in area 2"). A tap goes
// there. Drawn in canvas units, kept one size on screen like the captions.
export const AreaLinks = memo(function AreaLinks({ links, nodeById, posFor, zoom, onGo }: Props) {
  const { t } = useI18n();
  const a = t.ui.mapAreas;
  if (links.length === 0) return null;
  const scale = 1 / Math.max(zoom, 0.35);
  return (
    <>
      {links.map((l) => {
        const node = nodeById.get(l.nodeId);
        if (!node) return null;
        const p = posFor(node);
        const label = l.kind === "from" ? a.fromArea(l.otherArea + 1) : a.toArea(l.otherArea + 1);
        return (
          <button
            key={`${l.kind}:${l.nodeId}:${l.otherArea}`}
            type="button"
            data-area-link={l.kind}
            title={label}
            className="absolute z-[33] cursor-pointer whitespace-nowrap rounded-full border border-accent bg-surface px-2 py-[1px] font-semibold text-accent-ink shadow-card hover:bg-surface-2"
            style={{
              left: p.x,
              top: l.kind === "from" ? p.y - 44 * scale : p.y + 62 * scale,
              transform: `translate(-50%, -50%) scale(${scale})`,
              fontSize: 12,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onGo(l);
            }}
          >
            {l.kind === "from" ? "↩ " : ""}
            {label}
            {l.kind === "to" ? " →" : ""}
          </button>
        );
      })}
    </>
  );
});

import { useEffect, useRef, useState } from "react";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import type { NodeDoc } from "../types";

// Fixed corner overlay, sized to the same 3:2 ratio as the real canvas
// (CANVAS_W:CANVAS_H = 2400:1600) so a straight linear scale-down (scaleX/
// scaleY below) is all the coordinate math needs to place a dot/zone —
// canvas-coordinate space itself never changes shape, only how zoomed-in
// the *real* canvas is currently rendered at (see the zoom prop below,
// needed only for the "you are here" viewport rectangle, not for placing
// anything drawn in canvas coordinates like these dots/zones).
const MINIMAP_W = 180;
const MINIMAP_H = 120;
const DOT_R = 2.2;

// Just the fields the minimap actually draws — MapPage's own nodeGroups
// carries more (the member list) that this has no use for. rootId is kept
// purely as a stable React key — drifting members shift cx/cy every few
// seconds, which would make a coordinate-based key remount this on every
// tick for no reason.
interface MiniMapGroup {
  rootId: string;
  cx: number;
  cy: number;
  r: number;
  sentiment: "positive" | "negative";
  // Same outline polygon the real canvas draws as this group's "zone" —
  // see MapPage's own nodeGroups. Drawn here too (scaled down) instead of
  // falling back to the plain cx/cy/r circle, so the minimap's shape
  // actually matches what's on the real canvas rather than just
  // approximating its bounding circle.
  outline: { x: number; y: number }[];
}

interface Props {
  // The real canvas's own scroll container — read directly (scroll
  // position/size) and written directly (click/drag-to-navigate sets its
  // scrollLeft/scrollTop) rather than mirrored into MapPage state, so a
  // scroll tick only ever re-renders this small component, not the whole
  // map.
  wrapRef: React.RefObject<HTMLDivElement | null>;
  nodes: NodeDoc[];
  positions: Map<string, { x: number; y: number }>;
  // Same circles the main canvas draws a backdrop for (see MapPage's own
  // nodeGroups) — drawn here too, scaled down, so a circle is findable from
  // the minimap instead of only showing up once you've already scrolled to it.
  groups: MiniMapGroup[];
  canvasW: number;
  canvasH: number;
  // MapPage's own canvas zoom (see its zoom state) — wrap's scroll metrics
  // (scrollLeft/scrollTop/scrollWidth) are in screen pixels of the
  // *rendered* canvas once it's zoomed, not the canvasW/canvasH coordinate
  // space nodes/positions/groups are all still expressed in, so every
  // wrap-scroll reading below needs this to convert between the two —
  // same reasoning as MapPage's own screenToCanvas/zoomAt.
  zoom: number;
}

export function MiniMap({ wrapRef, nodes, positions, groups, canvasW, canvasH, zoom }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const [viewport, setViewport] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Keeps the little "you are here" rectangle in sync with the real
  // viewport — both when the user scrolls the canvas directly and when a
  // click/drag here moves it (that goes through the same wrap.scrollLeft/
  // scrollTop the listener below is already watching, so it's one code
  // path either way, not two that could disagree).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function update() {
      setViewport({
        left: wrap!.scrollLeft,
        top: wrap!.scrollTop,
        width: wrap!.clientWidth,
        height: wrap!.clientHeight,
      });
    }
    update();
    wrap.addEventListener("scroll", update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(wrap);
    return () => {
      wrap.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [wrapRef]);

  const scaleX = MINIMAP_W / canvasW;
  const scaleY = MINIMAP_H / canvasH;

  // Centers the real viewport on wherever (clientX, clientY) lands in
  // minimap-space — shared by both a plain click (jump) and every
  // pointermove while dragging (pan), so a drag reads as continuously
  // re-jumping to the point under the pointer. *zoom below: canvasX/canvasY
  // land in canvas-coordinate space (0..canvasW/canvasH), but
  // scrollLeft/scrollTop/scrollWidth are screen pixels of the rendered
  // (zoomed) canvas — same conversion MapPage's own zoomAt does.
  function navigateTo(clientX: number, clientY: number) {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;
    const rect = svg.getBoundingClientRect();
    const miniX = Math.min(Math.max(0, clientX - rect.left), MINIMAP_W);
    const miniY = Math.min(Math.max(0, clientY - rect.top), MINIMAP_H);
    const canvasX = miniX / scaleX;
    const canvasY = miniY / scaleY;
    const maxLeft = Math.max(0, canvasW * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, canvasH * zoom - wrap.clientHeight);
    wrap.scrollLeft = Math.min(maxLeft, Math.max(0, canvasX * zoom - wrap.clientWidth / 2));
    wrap.scrollTop = Math.min(maxTop, Math.max(0, canvasY * zoom - wrap.clientHeight / 2));
  }

  return (
    <div
      // bottom-3 right-3: anchored to the bottom-right corner rather than
      // top-right — out of the way of the toolbar's own top-left "back"
      // link and the map name up there, and clear of the top-of-screen
      // controls generally.
      // z-[45]: below NodePanel/LinkPickerPanel/the multi-select pill
      // (z-[46] — see NodePanel's own PANEL_CLASS comment) on purpose now —
      // those are full-width bottom sheets, so once one is open it should
      // actually cover the minimap sitting in that same bottom-right
      // corner, not leave it floating on top with a fragment of map poking
      // out over the panel's own content. Still above the canvas content
      // itself (NodeCard/QuickAddGhosts/PendingNodeCard, z-31 to z-34), so
      // the minimap stays visible/clickable whenever none of those panels
      // happen to be open — and still *below* a real modal dialog
      // (Modal.tsx, z-50; Invite/Create-edge/Map-summary all use it), which
      // should stay genuinely on top of everything, minimap included, while
      // it's open. (An earlier z-[70] here overshot past z-50 too, leaving
      // the minimap floating on top of an open modal instead of properly
      // covered by it.)
      className="absolute bottom-3 right-3 z-[45] overflow-hidden rounded-card border border-line bg-surface shadow-card"
      title="Minimap — click or drag to jump around the map"
    >
      <svg
        ref={svgRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        viewBox={`0 0 ${MINIMAP_W} ${MINIMAP_H}`}
        className="block cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as Element).setPointerCapture(e.pointerId);
          navigateTo(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          navigateTo(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
      >
        <rect x={0} y={0} width={MINIMAP_W} height={MINIMAP_H} fill="var(--surface-2)" />
        {/* Zones, under the node dots — the same outline polygon (and
            sentiment colors) the real canvas draws for each group (see
            MapPage's own nodeGroups/"Zones" rendering), just scaled down
            and without the click-to-stabilize interaction this tiny a
            target isn't worth wiring up for. */}
        {groups.map((g) => (
          <polygon
            key={`group-${g.rootId}`}
            points={g.outline.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(" ")}
            fill={g.sentiment === "positive" ? "#ffd54f" : "#ff3d00"}
            fillOpacity={0.16}
            stroke={g.sentiment === "positive" ? "#ffd54f" : "#ff3d00"}
            strokeOpacity={0.4}
            strokeWidth={0.75}
          />
        ))}
        {nodes
          .filter((n) => !n.isWeapon)
          .map((n) => {
            const p = positions.get(n.nodeId);
            if (!p) return null;
            return (
              <circle key={n.nodeId} cx={p.x * scaleX} cy={p.y * scaleY} r={DOT_R} fill={NODE_TYPE_COLORS[n.type]} />
            );
          })}
        {/* /zoom: viewport.* is wrap's own scroll/client size in screen
            pixels of the rendered (zoomed) canvas — divide back down to
            canvas-coordinate space before scaling to minimap size, same as
            navigateTo above, or this rectangle would shrink to a sliver
            the moment the real canvas zoomed in. */}
        <rect
          x={(viewport.left / zoom) * scaleX}
          y={(viewport.top / zoom) * scaleY}
          width={(viewport.width / zoom) * scaleX}
          height={(viewport.height / zoom) * scaleY}
          fill="var(--accent)"
          fillOpacity={0.12}
          stroke="var(--accent)"
          strokeWidth={1.25}
        />
      </svg>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import type { NodeDoc } from "../types";

// Fixed corner overlay, sized to the same 3:2 ratio as the real canvas
// (CANVAS_W:CANVAS_H = 2400:1600) so a straight linear scale-down is all the
// coordinate math needs — no zoom level to account for, since the real
// canvas itself is a fixed-size scrollable area, not an infinite/zoomable
// one.
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
}

export function MiniMap({ wrapRef, nodes, positions, groups, canvasW, canvasH }: Props) {
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
  // re-jumping to the point under the pointer.
  function navigateTo(clientX: number, clientY: number) {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;
    const rect = svg.getBoundingClientRect();
    const miniX = Math.min(Math.max(0, clientX - rect.left), MINIMAP_W);
    const miniY = Math.min(Math.max(0, clientY - rect.top), MINIMAP_H);
    const canvasX = miniX / scaleX;
    const canvasY = miniY / scaleY;
    const maxLeft = Math.max(0, canvasW - wrap.clientWidth);
    const maxTop = Math.max(0, canvasH - wrap.clientHeight);
    wrap.scrollLeft = Math.min(maxLeft, Math.max(0, canvasX - wrap.clientWidth / 2));
    wrap.scrollTop = Math.min(maxTop, Math.max(0, canvasY - wrap.clientHeight / 2));
  }

  return (
    <div
      className="absolute top-3 right-3 z-20 overflow-hidden rounded-card border border-line bg-surface shadow-card"
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
        {/* Circles, under the node dots — same sentiment colors the real
            canvas backdrop uses (see MapPage's own nodeGroups rendering),
            just scaled down and without the click-to-stabilize interaction
            this tiny a target isn't worth wiring up for. */}
        {groups.map((g) => (
          <circle
            key={`group-${g.rootId}`}
            cx={g.cx * scaleX}
            cy={g.cy * scaleY}
            r={g.r * scaleX}
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
        <rect
          x={viewport.left * scaleX}
          y={viewport.top * scaleY}
          width={viewport.width * scaleX}
          height={viewport.height * scaleY}
          fill="var(--accent)"
          fillOpacity={0.12}
          stroke="var(--accent)"
          strokeWidth={1.25}
        />
      </svg>
    </div>
  );
}

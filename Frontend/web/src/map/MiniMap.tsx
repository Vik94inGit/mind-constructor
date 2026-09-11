import { useEffect, useMemo, useRef, useState } from "react";
import { nodeRefId, sentimentOf, ZONE_COLORS } from "../utils/nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

// Smaller than the original per-node dots (which were 2.2px and colored one
// per NodeType) — this brings dots back per the user's own ask, but paired
// down to just "which side is this on," matching the zones' own green/red
// split instead of a whole palette of per-type colors that read as noise at
// this scale. A dot with no sentiment (sentimentOf returns null — only
// "unknown"-typed nodes; weapon and protection nodes both carry a real
// outcome type of their own and vote same as any other node) is skipped
// entirely rather than drawn in some third neutral color.
const DOT_R = 1.5;

// Fixed corner overlay, sized to the same 3:2 ratio as the real canvas
// (CANVAS_W:CANVAS_H = 2400:1600) so a straight linear scale-down (scaleX/
// scaleY below) is all the coordinate math needs to place a dot/zone —
// canvas-coordinate space itself never changes shape, only how zoomed-in
// the *real* canvas is currently rendered at (see the zoom prop below,
// needed only for the "you are here" viewport rectangle, not for placing
// anything drawn in canvas coordinates like these dots/zones).
const MINIMAP_W = 180;
const MINIMAP_H = 120;

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
  // The explicit "Link nodes" relationship (as opposed to branch/parentId
  // lineage, which this doesn't draw) — same sentiment-colored lines the
  // real canvas draws for these, scaled down.
  edges: EdgeDoc[];
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
  // space groups is still expressed in, so every
  // wrap-scroll reading below needs this to convert between the two —
  // same reasoning as MapPage's own screenToCanvas/zoomAt.
  zoom: number;
}

export function MiniMap({ wrapRef, nodes, edges, positions, groups, canvasW, canvasH, zoom }: Props) {
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

  // `nodes` here is already MapPage's own visibleNodes (packed-away members
  // filtered out) — but `positions` still carries an entry for every node,
  // packed or not, so the Links loop below can't just trust positions.get
  // to tell it a node is actually visible. This id set is that check.
  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.nodeId)), [nodes]);

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
        {/* Zones — the same outline polygon (and sentiment colors) the real
            canvas draws for each group (see MapPage's own nodeGroups/
            "Zones" rendering), just scaled down and without the
            click-to-stabilize interaction this tiny a target isn't worth
            wiring up for. */}
        {groups.map((g) => (
          <polygon
            key={`group-${g.rootId}`}
            points={g.outline.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(" ")}
            fill={g.sentiment === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative}
            fillOpacity={0.26}
            stroke={g.sentiment === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative}
            strokeOpacity={0.6}
            strokeWidth={0.75}
          />
        ))}
        {/* Manual zones — a single node's own owner-chosen zone ring (see
            MapPage's own manual-zone circle rendering and NodePanel's Info
            tab), scaled-down as a small circle instead of the fixed 55px
            canvas radius (this small a target isn't worth an exact-radius
            scale, just readable as "this node has a ring"). */}
        {nodes
          .filter((n) => n.manualZone)
          .map((n) => {
            const p = positions.get(n.nodeId);
            if (!p) return null;
            const color = n.manualZone === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative;
            return (
              <circle
                key={`manual-zone-${n.nodeId}`}
                cx={p.x * scaleX}
                cy={p.y * scaleY}
                r={4}
                fill="none"
                stroke={color}
                strokeOpacity={0.75}
                strokeWidth={0.9}
              />
            );
          })}
        {/* Links — the explicit "Link nodes" relationship (Edge documents),
            not the branch/parentId tree (that one's implicit in a node's
            own placement, not something drawn on the minimap). Same
            sentiment coloring the real canvas's own Edge lines use, scaled
            down; a stale edge whose node was deleted out from under it
            (fromNodeId/toNodeId come back null, not a string/ref) is
            skipped rather than crashing on `.nodeId` of null, same guard
            the main canvas's own Edge-rendering loop already has. */}
        {edges.map((edge) => {
          const fromId = nodeRefId(edge.fromNodeId);
          const toId = nodeRefId(edge.toNodeId);
          if (!fromId || !toId) return null;
          // Either end packed away — hide the line along with it, same as
          // the real canvas's own Edge lines (see MapPage's matching guard).
          if (!visibleIds.has(fromId) || !visibleIds.has(toId)) return null;
          const a = positions.get(fromId);
          const b = positions.get(toId);
          if (!a || !b) return null;
          const color =
            edge.sentiment === "negative"
              ? ZONE_COLORS.negative
              : edge.sentiment === "positive"
                ? ZONE_COLORS.positive
                : "var(--ink-soft)";
          return (
            <line
              key={edge.edgeId}
              x1={a.x * scaleX}
              y1={a.y * scaleY}
              x2={b.x * scaleX}
              y2={b.y * scaleY}
              stroke={color}
              strokeWidth={0.75}
              strokeOpacity={0.8}
            />
          );
        })}
        {/* Per-node dots — colored only by which side of the positive/
            negative split a node's type falls on (same ZONE_COLORS pair the
            zones above use), not a whole palette of per-type colors.
            "unknown"-typed nodes have no sentiment to vote with (see
            sentimentOf) and are skipped rather than drawn in a third,
            meaningless color. Weapon (attacking) nodes carry a real outcome
            type of their own (the attacker's actual objection — see
            attackAbl.ts) and get a dot the same as any other node now, per
            the user's own "attacking node show" ask. */}
        {nodes.map((n) => {
          const sentiment = sentimentOf(n.type);
          if (!sentiment) return null;
          const p = positions.get(n.nodeId);
          if (!p) return null;
          return (
            <circle
              key={n.nodeId}
              cx={p.x * scaleX}
              cy={p.y * scaleY}
              r={DOT_R}
              fill={sentiment === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative}
            />
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

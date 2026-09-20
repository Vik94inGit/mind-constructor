import { CANVAS_W, CANVAS_H } from "../utils/canvasLayout";
import type { NodeGroup } from "../utils/canvasLayout";
import { nodeRefId, ZONE_COLORS } from "../utils/nodeType";
import type { Sentiment } from "../utils/nodeType";
import type { EdgeDoc, NodeDoc, SelectedCircle } from "../types";

interface Props {
  nodeGroups: NodeGroup[];
  /** The chosen (stabilized) circle, if any — every other zone/branch dims against it. */
  selectedCircle: SelectedCircle | null | undefined;
  visibleNodes: NodeDoc[];
  edges: EdgeDoc[];
  posFor: (node: NodeDoc) => { x: number; y: number };
  circleRootSentimentByNode: Map<string, Sentiment>;
  linkCycles: string[][];
  /** Every node currently chosen (multi-selection, else the single selection) — edges away from them fade. */
  chosenNodeIds: Set<string> | null;
  /** The nodes a link is being confirmed for — kept ringed while the sentiment modal is open. */
  pendingLink: NodeDoc[] | null;
  onCircleClick: (rootId: string) => void;
}

// Everything drawn *behind* the node cards: zone polygons, manual zones and
// circle-parent rings, link figures, branch arrows, plain edges. One overlay
// SVG in canvas coordinates; pointer-events-none throughout, with only the
// zone shapes and grouped branches opting back in (they stabilize a circle).
export function CanvasBackdrop({
  nodeGroups,
  selectedCircle,
  visibleNodes,
  edges,
  posFor,
  circleRootSentimentByNode,
  linkCycles,
  chosenNodeIds,
  pendingLink,
  onCircleClick,
}: Props) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
    >
      {/*
        Zones: the outline polygon traced through every member of a group (root + its 2+
        direct parentId-children — see nodeGroups) — a triangle at the 3-member minimum,
        growing to a quad/pentagon/hexagon/… as the group grows, colored by the group's
        own majority sentiment (positive-majority halo-gold, negative-majority horns-red,
        a tied/all-"unknown" group neutral gray — see circleSentiment's own doc comment).
        Deepest layer on the canvas, under even the link figures below — every member
        stays a real, individually clickable node; this is purely a backdrop. Shape
        actually reflects the tree's own spread now instead of one fixed bounding circle
        either overlapping unrelated nodes or leaving a lot of empty space, and it visibly
        deforms live as members get dragged around — nodeGroups recomputes `outline` from
        current positions (including mid-drag) on every render, nothing here is a
        snapshot. Same "click to stabilize" control the old plain-circle backdrop had.
      */}
      {nodeGroups.map((g) => {
        const color = ZONE_COLORS[g.sentiment];
        // Same "chosen one stays fuller-opacity, every other zone
        // dims" spotlight the branch-arrow lines below (and the
        // minimap's own zones) use — one shared signal for which
        // group, if any, is currently stabilized.
        const isStabilized = selectedCircle?.rootId === g.rootId;
        const dimmed = !!selectedCircle && !isStabilized;
        return (
          <polygon
            key={`zone-${g.rootId}`}
            points={g.outline.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            fillOpacity={dimmed ? 0.06 : 0.14}
            stroke={color}
            strokeOpacity={dimmed ? 0.25 : 0.5}
            strokeWidth={2.5}
            // The whole overlay SVG is pointer-events-none (so its
            // decorative shapes never steal a drag/click from a
            // NodeCard div sitting underneath) — a zone is one of
            // the few things in it that's actually meant to be
            // clicked, so it has to explicitly opt back in.
            style={{ cursor: "pointer", pointerEvents: "auto" }}
            onClick={(e) => {
              e.stopPropagation();
              onCircleClick(g.rootId);
            }}
          >
            <title>
              {isStabilized
                ? "Stabilized — click it, or click anywhere outside it, to let it drift with the others"
                : "Click to stabilize this zone and let every other zone drift"}
            </title>
          </polygon>
        );
      })}
      {/*
        Manual zones: a single node's own owner-chosen zone ring (node.manualZone —
        see NodePanel's Info tab), independent of the automatic parentId-group zones
        above — no 2+-children requirement, color picked outright rather than voted.
        Fixed-radius circle (there's no multi-member outline to trace, unlike the
        polygon zones) around just that one node's own position. Drawn alongside an
        automatic zone if a node happens to be in both at once — these are separate
        layers, not mutually exclusive.
      */}
      {visibleNodes
        .filter((n) => n.manualZone)
        .map((n) => {
          const p = posFor(n);
          const color = n.manualZone === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative;
          return (
            <circle
              key={`manual-zone-${n.nodeId}`}
              cx={p.x}
              cy={p.y}
              r={55}
              fill={color}
              fillOpacity={0.14}
              stroke={color}
              strokeOpacity={0.5}
              strokeWidth={2.5}
            />
          );
        })}
      {/*
        Circle-parent ring: a small automatic version of the manual zone circle just
        above, drawn around every circle root/parent (circleRootSentimentByNode — same
        nodes NodeCard's own crown badge marks), colored the same way its zone backdrop
        already is (majority pos/neg/neutral vote). Same fixed-radius-circle shape as a
        manual zone, just tighter (close around the node itself, not a wide zone) and
        never owner-chosen — this one exists for every circle root automatically,
        alongside the crown badge rather than instead of it.
      */}
      {visibleNodes
        .filter((n) => circleRootSentimentByNode.has(n.nodeId))
        .map((n) => {
          const p = posFor(n);
          const color = ZONE_COLORS[circleRootSentimentByNode.get(n.nodeId)!];
          return (
            <circle
              key={`circle-parent-ring-${n.nodeId}`}
              cx={p.x}
              cy={p.y}
              r={34}
              fill={color}
              fillOpacity={0.16}
              stroke={color}
              strokeOpacity={0.6}
              strokeWidth={2}
            />
          );
        })}
      {/*
        Figures: any closed loop in the Link graph — colored fill as a backdrop, under
        everything else. A plain two-node link is a line and can never close, so it never
        shows up here; this is what "except line" means in practice, not a special case.
      */}
      {linkCycles.map((cycle) => {
        // visibleNodes, not nodes — a member folded into a pack
        // drops out of the shape entirely (same as the plain Edge
        // lines below), rather than a figure still tracing a vertex
        // at a node nobody can see any more.
        const pts = cycle
          .map((id) => visibleNodes.find((n) => n.nodeId === id))
          .filter((n): n is NodeDoc => !!n)
          .map((n) => posFor(n));
        if (pts.length < 3) return null;
        return (
          <polygon
            key={`figure-${cycle.slice().sort().join("-")}`}
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="var(--accent)"
            fillOpacity={0.1}
            stroke="var(--accent)"
            strokeOpacity={0.4}
            strokeWidth={1.5}
          />
        );
      })}
      {/*
        Branch arrows: tree lineage (node.parentId), set when a node is created via
        the quick-add ghosts off an existing node — drawn over the zone polygon above, so
        the direction/depth of who-branched-off-whom stays visible inside its own zone. A
        branch that's part of a "circle" (its parent has 2+ such children — see
        nodeGroups) is colored by the group's own majority sentiment (positive-majority
        halo-gold, negative-majority horns-red, neutral gray on a tie), same as the zone
        it's inside, and doubles
        as that circle's stabilize/release control too — one more place to click it,
        alongside the zone shape itself. A lone branch (its parent has just this one
        child, no group at all — nothing for a zone to enclose) keeps the plain,
        unclickable accent dash.
      */}
      {visibleNodes.map((node) => {
        const parentId = nodeRefId(node.parentId);
        if (!parentId) return null;
        const parentNode = visibleNodes.find((n) => n.nodeId === parentId);
        if (!parentNode) return null;
        const a = posFor(parentNode);
        const b = posFor(node);
        const group = nodeGroups.find((g) => g.rootId === parentId);
        const color = group ? ZONE_COLORS[group.sentiment] : "var(--accent)";
        // Same "chosen one stays full-opacity, every other circle
        // dims" spotlight the old backdrop drew — see its own
        // removed comment for why. Ungrouped branches never dim for
        // *that* reason; they were never part of the spotlight to
        // begin with. A 2+-node group selection dims independently
        // of all that — any branch with neither end selected fades,
        // grouped or not, so the selection's own neighborhood reads
        // clearly against everything else (see NodeCard's matching
        // `muted` computation and the plain-Edge dimming just below).
        const isStabilized = !!group && selectedCircle?.rootId === group.rootId;
        const circleDimmed = !!group && !!selectedCircle && !isStabilized;
        const chosenDimmed =
          !!chosenNodeIds && !chosenNodeIds.has(parentId) && !chosenNodeIds.has(node.nodeId);
        const dimmed = circleDimmed || chosenDimmed;
        // The flip side of chosenDimmed — this branch touches the
        // chosen node itself, not just "isn't dimmed" (which also
        // covers the plain default state, nothing chosen at all).
        // Boosted brighter than the normal baseline, not just left
        // alone, so the chosen node's own connections actually pop
        // against the dimmed rest instead of only avoiding the fade.
        const chosenHighlighted =
          !!chosenNodeIds && (chosenNodeIds.has(parentId) || chosenNodeIds.has(node.nodeId));
        return (
          <line
            key={`branch-${node.nodeId}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
            strokeOpacity={dimmed ? 0.12 : chosenHighlighted ? (group ? 0.95 : 0.6) : group ? 0.65 : 0.35}
            strokeWidth={group ? 1.75 : 1.5}
            strokeDasharray={group ? undefined : "5 4"}
            markerEnd="url(#branch-arrow)"
            // The whole overlay SVG is pointer-events-none (so its
            // decorative edges/arrows never steal a drag/click from
            // a NodeCard div sitting underneath) — a grouped branch
            // is the one case here that's actually meant to be
            // clicked (see handleCircleBackdropClick, same handler
            // the old backdrop circle used), so it has to explicitly
            // opt back in; an ungrouped one stays inert.
            style={group ? { cursor: "pointer", pointerEvents: "auto" } : undefined}
            onClick={
              group
                ? (e) => {
                    e.stopPropagation();
                    onCircleClick(group.rootId);
                  }
                : undefined
            }
          >
            {group && (
              <title>
                {isStabilized
                  ? "Stabilized — click it, or click anywhere outside it, to let it drift with the others"
                  : "Click to stabilize this circle and let every other circle drift"}
              </title>
            )}
          </line>
        );
      })}
      {/* Plain lines, no arrowhead — Edges are an undirected "these
          two are linked, and here's how they feel about each
          other" relationship (the sentiment color is the actual
          payload), not a directed one the way a branch arrow or a
          weapon's bow is, so an arrowhead here was implying a
          direction this doesn't actually have. */}
      {edges.map((edge) => {
        // fromNodeId/toNodeId come back null (not a string, not a
        // populated ref) when the node they pointed at was deleted
        // out from under the edge — skip rendering rather than
        // crash on `.nodeId` of null.
        const fromId = nodeRefId(edge.fromNodeId);
        const toId = nodeRefId(edge.toNodeId);
        if (!fromId || !toId) return null;
        // visibleNodes, not nodes — a packed-away endpoint hides
        // this edge along with it (same relationship as a branch
        // arrow into a packed node, which already goes through
        // visibleNodes below); unpacking either end brings the edge
        // right back since this re-resolves on every render.
        const fromNode = visibleNodes.find((n) => n.nodeId === fromId);
        const toNode = visibleNodes.find((n) => n.nodeId === toId);
        if (!fromNode || !toNode) return null;
        const a = posFor(fromNode);
        const b = posFor(toNode);
        const color =
          edge.sentiment === "negative"
            ? "var(--danger)"
            : edge.sentiment === "positive"
              ? "var(--success)"
              : "var(--ink-soft)";
        // Same chosen-node dimming the branch arrows above apply —
        // an edge with neither end chosen (selected or
        // multi-selected) fades, so the selected node's own
        // connections read clearly against the rest.
        const dimmed = !!chosenNodeIds && !chosenNodeIds.has(fromId) && !chosenNodeIds.has(toId);
        // The flip side of `dimmed` — this edge touches the chosen
        // node itself. Boosted brighter than the plain default
        // (0.55, used when nothing at all is chosen), not just left
        // there, so the chosen node's own edges actually pop against
        // the dimmed rest instead of only avoiding the fade.
        const highlighted = !!chosenNodeIds && (chosenNodeIds.has(fromId) || chosenNodeIds.has(toId));
        // Full opacity against var(--danger)/var(--success)'s own
        // already-saturated colors read as glaring, especially with
        // several edges overlapping near a busy node — toned down
        // to 0.55 normally (dimmed keeps roughly the same ratio to
        // it, not just to the old 1); highlighted goes brighter
        // still, close to full.
        return (
          <line
            key={edge.edgeId}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
            strokeWidth={2}
            strokeOpacity={dimmed ? 0.06 : highlighted ? 0.9 : 0.55}
          />
        );
      })}
      {/* The chosen set stays lit while the sentiment modal is open. */}
      {pendingLink?.map((n) => {
        const p = posFor(n);
        return (
          <circle
            key={`pending-${n.nodeId}`}
            cx={p.x}
            cy={p.y}
            r={18}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={3}
          />
        );
      })}
      <defs>
        {/* fill="context-stroke": picks up whichever line is
            actually using this marker's own `stroke` (plain accent
            for an ungrouped branch, the group's gold/red sentiment
            color for a grouped one — see the branch-arrows map
            above) instead of one fixed color for every branch. */}
        <marker id="branch-arrow" markerWidth="4.5" markerHeight="4.5" refX="4" refY="2.25" orient="auto">
          <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill="context-stroke" opacity="0.75" />
        </marker>
      </defs>
    </svg>
  );
}

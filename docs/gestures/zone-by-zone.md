# Step through the map zone by zone

Date: 2026-11-18 · PR: (this PR)

## What the user wants to do

"When I use arrows to navigate nodes, show me them zone by zone."

## The gesture

No new gesture: the existing panel arrows (← / →, and the arrow keys) change what they walk and
what the camera does when **no zone is chosen**. A chosen zone keeps its own order
([zone-creation-order](zone-creation-order.md)).

- **Touch:** open any node, tap the panel's ← / →.
- **Mouse / keyboard:** the panel's arrows, ← / → (↑ / ↓), or Alt+arrow from inside the text.
- **What the user sees:**
  - The arrows finish one zone before the next: a parent, then all of its children, and only then
    the zone of the first child that has children of its own, then the next, following the branch
    down before moving on to the next branch. Attacks still come right after the node they hit.
  - The camera shows the **whole zone** the step is in, not just the node: it glides so the zone sits
    in the middle of the space above the panel, zooming out only if the zone would not fit (never in).
    While the steps stay in the same zone the camera stays put and only the chosen node changes, so
    the zone reads as one picture; it moves once the next step crosses into another zone.
  - The node stepped to doesn't pull its neighbors into a ring round it, so the zone keeps its shape.
  - A node in no zone (a parent with one child, a lone thought) is shown with its parent.
  - At either end of the map the arrows stop, as today.
- **How to leave:** tap or click any node or the canvas; that ends the stepping as it does today.

## Sketch

```
map:   Goal ── Problem A ── Fail A1
          │            └── Idea A2
          ├── Problem B ── Option B1
          │            └── Option B2
          └── Idea C

before (outline, depth first, camera on each node):
   Goal → Problem A → Fail A1 → Idea A2 → Problem B → Option B1 → Option B2 → Idea C

after (zone by zone, camera on the zone):
   [zone Goal]       Goal → Problem A → Problem B → Idea C
   [zone Problem A]  Fail A1 → Idea A2
   [zone Problem B]  Option B1 → Option B2
```

## Could be confused with

- **Panel arrows with a zone chosen:** stay inside that zone, newest thought first. Unchanged.
- **Time-lapse:** while it runs, the arrows step it instead. Unchanged.
- **Presentation:** slides by parent on its own screen; this is the canvas.
- **Tapping a node:** still centers on that one node with its ring of neighbors; only the arrows
  frame the zone.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (asked for it) | to try on the PR preview | | |

## Decision

With no zone chosen, `MapPage` `stepReading` walks `utils/nodeOrder.ts` `zoneOrder` (each parent's
children together, branch by branch) and frames the step with `showNodes(zoneStepIds(...))` instead
of `centerOnNode`: the node's parent with all its children, an attack with the node it hit.
`useCanvasFraming` `showPoints` now fits the points into the space above the panel when it centers
there. The radial ring of neighbors waits while the selected node is one the arrows reached.

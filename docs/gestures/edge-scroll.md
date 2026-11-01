# Scroll the map when a dragged node reaches the screen's edge

Date: 2026-11-01 · PR: <link once it exists>

## What the user wants to do

"When I want to move a note to another part of the screen, I touch the border and the app should
move the border, to let me move nodes far." Today a drag stops at the screen's edge: to move a
thought further you have to drop it, pan, pick it up again, and repeat.

## The gesture

Not a new gesture: the drag that already exists in Move mode (✥), for one node or a group, keeps
going when it reaches the edge.

- **Touch:** in Move mode, drag a node. When your finger comes within about **40 px of an edge of
  the map** (the strip just inside the toolbar at the top, the sides, the bottom), the map starts
  scrolling that way and the node rides along under your finger. The closer to the edge, the faster
  it scrolls (slow at the strip's inner side, about one screen a second right at the edge). Near a
  corner it scrolls both ways at once. Move the finger back inward and it stops. Let go to drop the
  node where it is now.
- **Mouse:** the same with the mouse button held. The pointer can leave the window; the map keeps
  scrolling while the button is down and the pointer was last past that edge.
- **What the user sees:** while it scrolls, a soft glow on that edge of the map, so it's clear the
  scroll is the drag's doing and not a jump. Zones the node passes over light up as now, and the
  drop still glues, joins a zone or keeps off other nodes exactly as a drop does today.
- **It stops** when the map reaches its own edge (the canvas is 2400 × 1600; the scroll stops there
  and the node stays held in from the edge, as it does today). It also never starts in the first
  quarter second of a drag, so picking up a node that already sits by the edge doesn't send the map
  sliding.
- **How to leave or undo it:** move back inward to stop scrolling; let go to drop. The toolbar's undo
  (↶) puts the node back where the drag started, as for any move. The map stays scrolled where you
  left it.

## Sketch

```
before: finger reaches the right edge     after ~1 s held there
┌──────────────────────┐                  ┌──────────────────────┐
│ ✥                    │                  │                      │
│   [A]──[B]       ░[C]│ ← glow           │[B]               ░[C]│  map slid left,
│                    ☝ │                  │                    ☝ │  C still under
│                      │                  │        [D]           │  the finger, D
└──────────────────────┘                  └──────────────────────┘  now in view
```

## Could be confused with

- **Swipe on a node outside Move mode, or drag on empty canvas (touch):** pans the map. Edge scroll
  only happens while a node is being *moved* (Move mode on, node picked up), so a swipe that reaches
  the edge pans as before.
- **Marquee select (mouse, empty canvas):** not changed in this PR. It could get the same edge
  scroll later.
- **Drag a type out of the ring of ghosts, card side handle, change-parent:** not changed; only the
  node move and the group move scroll.

## Quick test

Task given without naming the gesture: "Move this thought to the other side of the map, past what
you can see."

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (asked for it) | Drag to the screen's border | — | — |
| | | | |

## Decision

To be filled in after the quick test.

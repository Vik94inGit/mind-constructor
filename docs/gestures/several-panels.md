# Several node panels at once

Date: 2026-11-13 · PR: <link once it exists> · Builds on [tap-opens-node.md](tap-opens-node.md)

## What the user wants to do

"Add possibility to open two, three node panels at the same time, but on desktop 8 nodes, tablet 6,
phone 2, not overlap." Read or compare a few thoughts side by side without closing one to open the
next.

## The gesture

- **Touch:** tap a node: its panel opens, as today. Tap another node: its panel opens **beside** the
  first one instead of replacing it. Each tap adds one more, up to the device's limit (phone 2,
  tablet 6, computer 8). Past the limit the oldest panel closes to make room. Tapping a node that
  already has a panel brings that panel forward (it becomes the active one) without adding another.
- **Mouse / keyboard:** the same with a click. Esc and a click on empty canvas close all of them, as
  they close the one panel today.
- **What the user sees:** the panels share the bottom half of the screen as tiles that never overlap:
  side by side while they fit (computer up to 4 in a row, tablet 3, phone 1), then a second row.
  The active panel (the node last tapped, centered with its ring of ghosts) has an accent border;
  its arrows step node to node inside that panel only.
- **How to leave or undo it:** each panel's ✕ closes just that panel (closing the active one makes
  the next most recent one active). Empty canvas or Esc closes them all.

## Sketch

```
computer, 3 open                         phone, 2 open
┌──────────── canvas ─────────────┐      ┌──── canvas ────┐
│        (B) ← active, centered   │      │      (B)       │
│   (A)           (C)             │      │  (A)           │
├──────────┬──────────┬───────────┤      ├────────────────┤
│ A panel  │ B panel▣ │ C panel   │      │ A panel     ✕  │
│       ✕  │       ✕  │        ✕  │      ├────────────────┤
└──────────┴──────────┴───────────┘      │ B panel ▣   ✕  │
                                          └────────────────┘
computer, 6 open: two rows of 4 + 2      phone, tap C: A closes, B and C stay
```

## Could be confused with

- *Tap a node* (tap-opens-node.md): same tap; the only change is that the old panel stays open next
  to the new one instead of being replaced.
- *Select mode (☑)* picks nodes for a group action with no panel at all; its own bar takes the
  bottom slot, so panels and the select bar never show together.
- *Shift+click* still adds a node to the group selection, not a panel.
- *Panel arrows* step the active panel's node, they don't open a new panel.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (on the PR preview) | | | |

## Decision

A tap on a node opens its panel next to those already open, up to 2 on a phone, 6 on a tablet and 8
on a computer, the oldest closing past that. Panels tile the bottom half without overlapping; each
has its own ✕; empty canvas and Esc close them all. Dragging and resizing a panel only work while
one panel is open.

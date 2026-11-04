# Pack and unpack children

Date: 2026-11-04 · PR: <link once it exists>

## What the user wants to do

"There should be a button for pack/unpack children nodes on the map." A map opens unpacked (every
node showing); the user packs a parent's children away to see less, and opens them again, right on
the canvas, not from the panel's Info tab.

## The gesture

Today packing a branch lives only in the node panel's Info tab (*Pack its branch*); a packed parent
already shows a **+N** pill on its right that opens it again. The new part is the other half, on the
canvas:

- **Touch (phone, tablet):** tap a parent node to select it, as now. A small **−** pill appears in
  the same spot as the +N pill (the node's right middle). Tap it: the children fold into the parent,
  and the pill becomes **+N**. Tap **+N** to open them again.
- **Mouse:** the same, and the **−** pill also shows while the pointer is over a parent, so it's one
  click without selecting first.
- **What the user sees:** only parents get the pill (a node with no children never shows it). The
  pill is the same size and place in both states, so pack and unpack are the same tap.
- **How to undo:** tap the pill again. Packing is only a way of looking, per browser and per map, as
  it is today (`utils/autoPack.ts`); nothing on the map changes for anyone else.

## Sketch

```
before (parent selected)          after tapping −
      [Problem] (−)                     [Problem] (+3)
       /   |   \
  [Idea] [Opt] [Opt]
```

## Could be confused with

- **Node tap/click** (opens its panel): the pill sits outside the node's icon and stops the tap, like
  the +N pill already does, so a tap on the pill never opens the panel or starts a drag.
- **Card side handle** (cards view, drag to link): cards view draws no pills; this is only on the
  whole-map and overview views.
- **Ring of ghosts** around a selected node: the pill sits on the right middle edge, right against
  the node, inside the ring, where the +N pill already sits without trouble.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | | | |

## Decision

To be filled once the test is done.

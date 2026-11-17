# Zoom in on a picture

Date: 2026-11-17 · PR: (this PR)

## What the user wants to do

"Add possibility to zoom in picture, button near card or icon." A node's picture on the map is a
small copy (a 96px card or a 48px icon), and the panel shows it at panel width: too small to read a
screenshot or a formula in it.

## The gesture

- **Touch:** tap the node (its panel opens, as today). A small round 🔍 sits on the picture card's
  or picture icon's top-right corner; tap it. The picture opens full screen on a dark backdrop at
  its whole size. Pinch to zoom round the fingers, drag with one finger to look around a zoomed
  picture, double-tap to go in at that spot (2.5×) and again to see the whole picture. ✕ top right,
  or a tap on the dark round the picture, closes it.
- **Mouse / keyboard:** hovering a node with a picture brings the 🔍 up (it stays once the node is
  selected); click it. The wheel zooms round the pointer, drag moves, double-click toggles, − ⤢ +
  at the bottom, keys + / − / 0, Escape closes, ← → step through several pictures.
- **In the panel:** every picture in the Info tab has the same 🔍 at its top-left (× is top-right),
  a picture card's pictures too, which don't open on a plain tap.
- **What the user sees:** the zoom level ("250%") and, with several pictures, "2 / 3" top left;
  ‹ › beside the zoom buttons step through them.
- **How to leave:** ✕, Escape, or a tap off the picture. Nothing on the map changes.

## Sketch

```
map, node selected                 viewer
   ┌──────────┐(🔍)               ┌──────────────────────────┐
   │ picture  │                   │ 250% · 1 / 2         ✕   │
   │  card    │ −                 │                          │
   └──────────┘                   │      [ zoomed picture ]  │
     caption                      │                          │
                                  │     ‹  −  ⤢  +  ›        │
                                  └──────────────────────────┘
```

## Could be confused with

- **Tap a node** opens its panel: the 🔍 is its own button and stops the tap from reaching the node.
- **Parent's − / +N pill** sits on the right middle of an icon or card; the 🔍 is on the top-right
  corner, above it. On a discussion map the under-fire count shares that corner; the 🔍 shows on
  top of it only while the node is selected or hovered.
- **Canvas pinch / wheel zoom** zooms the map; inside the viewer they zoom the picture only (the
  viewer takes every press, so the map underneath never moves).

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (asked) | | | |

## Decision

A 🔍 on the picture card or picture icon (shown when the node is selected, or on mouse hover) and
on each picture in the panel opens one shared full-screen viewer (`map/PictureViewer.tsx`, math in
`utils/pictureZoom.ts`). From the map it starts on the small copy and swaps in the node's full-size
pictures once they're fetched.

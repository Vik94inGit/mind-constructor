# Extra areas on a full map

Date: 2026-11-15 · PR: not yet

## What the user wants to do

"When map has too much nodes please prevent overlapping and notify the map is full, extend map. Add
little extend for switching between big part of map on minimap, max four extra maps on one map and
six miniview for minimap, minimap gets extend button." (Viktor)

Today the canvas is a fixed 2400 × 1600. When it fills up, a new node still gets placed, and with no
clear spot left it lands on top of another one without a word.

## The gesture

An **area** is another full-size canvas belonging to the same map. A map starts with one (the main
area) and can get up to four more, so five in all. Only one area is on screen at a time; links,
zones and walls live inside an area.

- **Map full.** When a new node has nowhere to go without overlapping (adding, double-tap, a ghost
  dragged out, Text → nodes, a template), it isn't dropped on top of anything. A banner says
  *This area is full* with two buttons: **Extend map** (adds an area and puts the node there) and
  **Not now** (the node isn't added). With five areas already there is no Extend button; the banner
  says the map is full and suggests packing children or deleting some.
- **Minimap extend button.** The minimap gets a small **+** in its corner. Tap/click: adds an empty
  area and switches to it. Hidden at five areas. Owner and editors only.
- **Mini-views (switching).** As soon as a map has more than one area, a strip of up to six small
  thumbnails sits on top of the minimap: **All** (every area side by side, tap one to go there) and
  one per area (1 to 5), each a tiny drawing of that area's dots and zones. The current one is
  outlined. Tap/click a thumbnail: the canvas switches to that area, the big minimap below now
  shows that area. On a phone the strip scrolls sideways if it doesn't fit.
- **Mouse / keyboard:** the same clicks. No new key.
- **What the user sees:** the canvas cross-fades to the other area, framed like a freshly opened map;
  search, the node panel's arrows and the presentation jump areas when the next node lives in another.
- **How to leave or undo it:** tap the area you came from. An empty extra area can be removed from
  its thumbnail's hold / right-click menu (*Remove area*). One with nodes in it can't, until they are
  moved or deleted.

## Sketch

```
before (one area, full)                  after "Extend map"
+--------------------------------+       +--------------------------------+
| o o o o o o o o o o o o o o o  |       |                                |
| o o o o o o o o o o o o o o o  |       |             (new)              |
| o o o o o o o o o o o o o o o  |       |                                |
| +----------------------------+ |       |                  [All][1][2]   |
| | This area is full.         | |       |                  +----------+  |
| | [Extend map]   [Not now]   | |       |                  | minimap  |+ |
| +----------------------------+ |       |                  |   area 2 |  |
|                  +----------+  |       |                  +----------+  |
|                  | minimap  |+ |       +--------------------------------+
|                  +----------+  |
+--------------------------------+

Thumbnail strip on top of the minimap, at most six:
 [All] [1] [2] [3] [4] [5]      + on the minimap: one more area (gone at 5)
```

## Could be confused with

| Inventory gesture | How they're told apart |
|---|---|
| Minimap tap / drag: moves the view | The thumbnails and the + sit outside the minimap's drawing, on their own strip and corner; tapping inside the drawing still pans. |
| Eye menu / zoom in the bottom-right corner | Those stay where they are; the strip sits above the minimap, not beside the zoom buttons. |
| Packing children (− / +N) | Packing is the first thing the full banner suggests besides Extend, so a crowded map can tidy up before growing. |

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | to fill in | | |

Questions for the test: does *one area at a time* match "switching between big parts", or should
areas sit side by side on one long canvas? Is *All* the right sixth mini-view?

## Decision

To fill in after the test.

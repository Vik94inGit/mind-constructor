# Double-tap empty canvas for a new node

Date: 2026-11-07 · PR: <link once it exists>

## What the user wants to do

"On doubleclick or double tap create new node on empty canvas" (Viktor). A new thought goes exactly
where the user is looking, without opening a menu first.

Today the same thing takes two steps: hold (touch) or right-click (mouse) on empty canvas, then
*New node ▸* and a type, or the toolbar's *+ > Create node*, which puts it in the middle of the view.

## The gesture

- **Touch:** two quick taps on the same empty spot (second tap within ~350 ms and ~24 px of the
  first). A blank node (type *unknown*) is saved right there and opened: its panel and its ring of
  ghosts, as if it had been tapped. No text field is focused, so the keyboard stays down until the
  user taps into the text.
- **Mouse:** double-click on empty canvas, same result.
- **What the user sees:** the first tap does what a tap does today (closes an open panel). On the
  second tap the blank node appears under the finger. If that spot breaks the zone rules (inside a
  zone it doesn't belong to, on top of a node), it lands at the nearest free spot, as every new node
  does (`placeNode`).
- **How to leave or undo it:** tap away to close it (the blank node stays, like a ghost dragged out
  of the ring), or delete it from its panel; it is then in the map's Deleted list.

## Sketch

```
before                          after (tap, tap)
+---------------------+         +---------------------+
|  (o)        (o)     |         |  (o)        (o)     |
|                     |         |      +-----------+  |
|      [tap tap]      |         |   ○  |     ?     |  ○ |
|  (o)                |         |  (o) +-----------+  |
+---------------------+         +----- ring of ghosts +
                                  + its panel, no keyboard
```

## Could be confused with

| Inventory gesture | How they're told apart |
|---|---|
| Node, double-click/double-tap: inline edit | Only on a node; this is only on empty canvas. Cards, ghosts, picture captions and menus already stop their own double-clicks. |
| Empty canvas, tap: closes the panel | The first tap still does exactly that; only the second quick one creates. |
| Empty canvas, hold ½ s: canvas menu | A double-tap lifts long before ½ s. |
| Empty canvas, drag: pans / marquee | A tap that moves more than ~8 px isn't a tap, so a pan or marquee never counts. |
| Browser's own double-tap zoom (phones) | Already off on the canvas (its wrap is `touch-action: pan-x pan-y`); the map's zoom stays pinch and − / +. |
| Pinch: zoom | A second finger cancels it. |

Ignored (does nothing) while drawing a picture, choosing, packing, changing a parent, in the
selection-only mode, while a new node is already being named, during the map's entrance, and while
replaying or presenting. Also ignored for a viewer who can't add nodes to the map.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | double-tap / double-click on empty canvas | no gesture did it | asked for it as sketched |
| Viktor, a day later | double-tap on a tablet and a phone | it wasn't built yet | built with the defaults: a zone's empty area counts, the node starts blank |
| Viktor, with it built (#213) | double-tap on a phone | the keyboard popped up for the name field | the blank node is saved and opened instead: panel, node and ring of ghosts, no keyboard |

## Decision

Double-click (mouse) or double-tap (touch, pen) on empty canvas, or on a zone's empty area, starts a
blank node of type *unknown* at that spot, saves it straight away (`createBlankNodeAt` in
`hooks/useQuickAdd.ts`) and opens it: its panel and ring of ghosts, with no text field focused, so a
phone's keyboard stays down (`hooks/useCanvasDoubleTap.ts`). The pair is read off the canvas's own click events (two within 350 ms
and 24 px), since Safari doesn't reliably send `dblclick` for taps. Inside a zone whose parent is the
user's own, the node hangs from that parent and joins the zone; otherwise it is parentless and the
zone rules place it. The first tap still does what a tap does (closes a panel, picks a zone). The
first-map hint mentions it in all four languages.

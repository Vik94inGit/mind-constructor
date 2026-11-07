# Double-tap empty canvas for a new node

Date: 2026-11-07 · PR: <link once it exists>

## What the user wants to do

"On doubleclick or double tap create new node on empty canvas" (Viktor). A new thought goes exactly
where the user is looking, without opening a menu first.

Today the same thing takes two steps: hold (touch) or right-click (mouse) on empty canvas, then
*New node ▸* and a type, or the toolbar's *+ > Create node*, which puts it in the middle of the view.

## The gesture

- **Touch:** two quick taps on the same empty spot (second tap within ~300 ms and ~24 px of the
  first). A blank new node opens right there with its name field focused and the keyboard up, the
  same input *+ > Create node* gives (type *unknown*, picked later from the ring of ghosts).
- **Mouse:** double-click on empty canvas, same result.
- **What the user sees:** the first tap does what a tap does today (closes an open panel). On the
  second tap the blank node appears under the finger. If that spot breaks the zone rules (inside a
  zone it doesn't belong to, on top of a node), it lands at the nearest free spot, as every new node
  does (`placeNode`).
- **How to leave or undo it:** Esc, ✕, or tapping away with the name still empty drops the new node,
  as it does today for a blank node input. Nothing is saved until a name is typed.

## Sketch

```
before                          after (tap, tap)
+---------------------+         +---------------------+
|  (o)        (o)     |         |  (o)        (o)     |
|                     |         |      +-----------+  |
|      [tap tap]      |         |      | ? |_      |  |
|  (o)                |         |  (o) +-----------+  |
+---------------------+         +---------------------+
                                  name field focused
```

## Could be confused with

| Inventory gesture | How they're told apart |
|---|---|
| Node, double-click/double-tap: inline edit | Only on a node; this is only on empty canvas. Cards, ghosts, picture captions and menus already stop their own double-clicks. |
| Empty canvas, tap: closes the panel | The first tap still does exactly that; only the second quick one creates. |
| Empty canvas, hold ½ s: canvas menu | A double-tap lifts long before ½ s. |
| Empty canvas, drag: pans / marquee | A tap that moves more than ~8 px isn't a tap, so a pan or marquee never counts. |
| Browser's own double-tap zoom (phones) | Turned off on the canvas (`touch-action: manipulation` on the canvas wrap); the map's zoom stays pinch and − / +. |
| Pinch: zoom | A second finger cancels it. |

Ignored (does nothing) while drawing a picture, choosing, packing, changing a parent, in the
selection-only mode, while a new node is already being named, during the map's entrance, and while
replaying or presenting. Also ignored for a viewer who can't add nodes to the map.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | double-tap / double-click on empty canvas | no gesture did it | asked for it as sketched |

## Decision

Double-click (mouse) or double-tap (touch) on empty canvas starts a blank new node at that spot,
through the same `startNodeAt(at, "unknown")` the canvas menu's *New node* uses. Built after the
quick test above is confirmed.

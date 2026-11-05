# Hold empty canvas for the canvas menu (touch)

Date: 2026-11-04 · PR: #200

## What the user wants to do

"I tap empty space on the canvas and the menu to analyze a problem, create a new node and so on doesn't appear" (Viktor, Chrome on a tablet).

Today that menu (*Paste here*, *New node ▸*, *Analyze a problem*, *Make a decision*, *Plan a goal*, *Look back*, *Develop an idea*, *Draw a picture…*, *Text → nodes here*, *Text → map*) opens only with a right-click. On touch it has no gesture at all. Chrome sometimes turned a long press into a right-click by chance, but Safari never does.

## The gesture

- **Touch:** hold a finger still on empty canvas for about half a second (the same 500 ms a zone's hold uses). The menu opens where the finger is. Lifting the finger doesn't close it.
- **Mouse:** right-click, as today (unchanged).
- **What the user sees:** after the hold, the same menu right-click shows, at the finger.
- **How to leave:** tap outside the menu, or ✕, as today.

## Sketch

```
before                         after (finger held ~0.5 s)
+---------------------+        +---------------------+
|  (o)        (o)     |        |  (o)   +----------------------+
|                     |        |        | Paste here           |
|        [finger]     |        |      ● | New node ▸           |
|  (o)                |        |  (o)   | Analyze a problem    |
|                     |        |        | Make a decision  …   |
+---------------------+        +--------+----------------------+
```

## Could be confused with

| Inventory gesture | How they're told apart |
|---|---|
| Empty canvas, drag: pans | Moving the finger more than ~8 px before 0.5 s cancels the hold, so a pan never opens the menu. |
| Empty canvas, tap: closes the panel | A tap is lifted well before 0.5 s. |
| Zone, hold: zone menu | A hold on a zone stays the zone menu; only truly empty canvas opens this one. |
| Node in Move mode, hold still and lift: group select | It's on a node, not empty canvas. |
| Pinch: zoom | A second finger cancels the hold. |

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (tablet, Chrome) | tap on empty canvas, twice | nothing showed | the sketch's half-second hold became a plain tap, as Viktor asked |
| Viktor, a day later with the tap built | the tap | wanted a longer press to open it | back to the half-second hold |

The tap was built first (#200). After using it, Viktor asked for a longer press, so this is back to the hold sketched above.

## Decision

On touch (finger or pen), holding a finger still on empty canvas for half a second opens the canvas menu where the finger is (`hooks/useCanvasHoldMenu.ts`). Moving more than 8 px, lifting early, or a second finger cancels the hold, so a pan, a tap or a pinch never opens it. A quick tap only closes what's open, as before. If a node is open, a hold closes it and opens the menu. Not in modes (draw, choose, pack, change parent, naming a new node), not during the map's entrance, and not while replaying or presenting. A mouse keeps its right-click.

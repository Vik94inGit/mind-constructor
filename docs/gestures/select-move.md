# Select mode + Move mode: drag the picked nodes together

Date: 2026-11-14 · PR: (this PR)

## What the user wants to do

"Select mode with move mode should enable to move selected nodes" (Viktor). I pick several thoughts
with ☑, then want to carry them all somewhere else in one drag, without leaving Select mode and
losing what I picked.

Today ✥ can be pressed while ☑ is on, but nothing drags: Select mode refuses every drag.

## The gesture

- **Start:** in Select mode (☑) with some nodes picked, press ✥ too. Both buttons stay pressed.
  Nothing is dropped from the selection.
- **Touch:** put a finger on any picked node of yours and drag: every picked node of yours moves with
  it, the others following its path, exactly like the existing group drag. A tap (or a finger that
  only jitters, below the drag distance) still picks or drops one node. A node that isn't picked
  never drags; a finger on it that travels pans the map, and a tap picks it.
- **Mouse:** the same with a click-drag. A click without moving still picks or drops.
- **What the user sees:** picked nodes of yours show the grab cursor; the rest keep the plain one.
  The bar's hint (wider screens) reads *Drag a picked node to move them all. A tap still picks or
  drops one.* After the drop the selection is still there, so the user can keep picking or move again.
- **Whose nodes move:** only your own, as in every move; other members' picked nodes stay put. A node
  held in place (locked) never moves.
- **How to leave:** ✥ again stops the dragging and keeps Select mode; *Done* or ☑ leaves Select mode
  as before. Undo of moves works as for any group drag.

## Sketch

```
☑ on, three picked, ✥ off           ☑ + ✥ on, drag (P)
+------------------------------+     +------------------------------+
| [+] [✥] [☑*]                 |     | [+] [✥*] [☑*]                |
|  ((P))----(S)      ((I))     |     |          ((P))----(S) ((I))  |
|            \                 |     |     ...the three move as one |
|          ((?))              |     |            ((?))             |
| 3 chosen  [Actions] [Done]   |     | 3 chosen  [Actions] [Done]   |
+------------------------------+     +------------------------------+
```

## Could be confused with

| Existing gesture | Starts the same way | How the user tells them apart |
|---|---|---|
| Select mode: tap a node picks / drops it | Finger on a node | Only a drag past the drag distance moves; a tap still picks or drops. |
| Move mode: drag a node | Finger on a node | In Select mode only picked nodes drag, and always together. |
| Move mode: hold still, lift adds to group | Finger held on a node | In Select mode a hold is just a tap (pick / drop). |
| Swipe on a node pans (not Move mode) | Finger travels from a node | Still true for nodes that aren't picked. |

## Quick test

Task: "Pick these three thoughts and put them in the empty corner." Watch for: do they press ✥
while ☑ is on, do they expect an unpicked node to drag along, do they lose the selection.

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (asked for it, 2026-11-14) | | | |

## Decision

Built: with ☑ and ✥ both on, dragging a picked node of yours moves every picked node of yours as a
group (the existing group drag); taps still pick and drop, unpicked nodes never drag, and the
selection survives the drop.

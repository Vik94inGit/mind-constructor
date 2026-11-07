# Select mode: tap nodes only to pick them

Date: 2026-11-07 · PR: (after the quick test)

## What the user wants to do

"And add mode just for choosing or selecting nodes any type" (Viktor). I want to pick several
thoughts at once, of any kind, without each tap opening a panel, moving a node or starting an edit.

What exists today and why it isn't enough:

- **Choose…** (a node's panel or right-click menu, `hooks/useChooseMode.ts`) is already a mode where
  a tap adds a node to the group, but it can only be started *from* a node, takes that node's whole
  branch with every tap, refuses nodes you didn't create, and ends on any tap of empty canvas or a
  zone, so one slip loses the selection.
- **Shift+click** and the **marquee** work only with a mouse.
- **Move mode (✥) hold-then-lift** works on touch, but in Move mode a slightly long tap drags the node.

## The gesture

- **Start:** a new **Select** button (☑) in the map toolbar, beside ✥. It is pressed while the mode is
  on, like ✥ and the line button. Turning it on turns Move mode and line drawing off; nothing starts
  selected. The bottom bar shows *Tap nodes to select them*, **Actions** and **Done**.
- **Touch:** tap a node to select it, tap it again to drop it. Any node counts: every type, ghosts,
  a picture's dots, cards in the cards view, and other members' nodes in a discussion. A tap takes
  only that node, never its branch. Tap a zone's empty area (or its name chip) to select every node in
  that zone; tap it again to drop them all. Swipe pans and pinch zooms, as always.
- **Mouse / keyboard:** click does what a tap does. Drag on empty canvas still draws a marquee, which
  adds what it catches. Shift+click works the same as a click here. **Esc** or **Enter** = Done.
- **What the user sees:** each selected node gets the dashed ring the group selection already uses,
  and the bar counts them (*4 selected*). A tap gives no panel, no ring of ghosts, no picture view, no
  inline edit, no − / +N pill and never a drag, even on your own selected node. The cursor is the
  crosshair the other picking modes use.
- **Actions:** the existing Actions menu (link, number, show as, copy, copy as text, group into
  circle, delete) plus **Add their branches**, which brings back what Choose… did. Actions that change
  nodes act only on yours and say so (*3 of 5 are yours*); copying works on all of them.
- **How to leave:** Done, Esc/Enter, or tap ☑ again. A tap on empty canvas does **nothing** here (no
  exit, no deselect), so a slip of the finger never loses the selection. Leaving drops the selection.

## Sketch

```
before (tap a node: its panel opens)          after (☑ on, three taps)
+---------------------------------------+      +---------------------------------------+
| [+] [✥] [☑] [↶] [/]                   |      | [+] [✥] [☑*] [↶] [/]                  |
|                                       |      |                                       |
|    (P)----(S)        (I)              |      |   ((P))----(S)       ((I))            |
|            \                         |      |             \                         |
|            (?)ghost   . . picture    |      |           ((?))ghost  . . picture     |
|                                       |      |                                       |
| +-----------------------------------+ |      | +-----------------------------------+ |
| | Problem: ...   Info Modify Attack | |      | | 3 selected   [Actions ▾]  [Done]  | |
+---------------------------------------+      +---------------------------------------+
                                                 ((x)) = dashed selection ring
```

## Could be confused with

| Existing gesture | Starts the same way | How the user tells them apart |
|---|---|---|
| Node: tap opens its panel | A tap on a node | ☑ is pressed and the bottom bar says *Tap nodes to select them*; no panel ever opens. |
| Choose… from a node's panel | Same bar and rings | Choose… becomes the way *into* this mode with that node and its branch already selected; after that every tap works as above (one node, empty canvas doesn't exit). One mode instead of two. |
| Move mode: hold still, lift = add to group | Adds to the group | Select mode turns Move off; a hold here is just a tap. Move mode keeps its own hold for those who drag and group in one go. |
| Move mode: drag a node | Finger on a node | No drag at all in Select mode; a finger that travels pans the map. |
| Empty canvas: hold opens the canvas menu | Finger on empty canvas | Off in Select mode (like line drawing), so a hold is just a pan that didn't move. |
| Zone: hold / right-click opens the zone menu | Finger on a zone | A tap on a zone selects its nodes; hold and right-click still open the zone menu. |
| Picture caption: tap opens the picture's bar | Tap on a picture | In Select mode a tap on a dot selects that dot; the caption tap selects every dot of the picture. |
| Parent's − / +N pill | Tap near a parent | Pills are hidden in Select mode. |

## Quick test

Task to give, without naming the button: "Pick out these four thoughts (one a ghost, one a picture
dot) and copy them as text." Watch for: do they find ☑, do they tap empty canvas expecting to
deselect, do they expect a tap on a parent to bring its children.

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| | | | |

## Decision

(After the test.) Build Select mode as above: a ☑ toolbar button on phone, tablet and desktop that
reuses the group selection (`multiSelectIds`), `SelectionBar` and the choose branch of `useCanvasMode`
(extended to any node, one at a time, zone taps, and no exit on empty canvas), with Choose… opening it.

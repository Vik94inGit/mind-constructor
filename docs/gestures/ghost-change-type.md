# Ghost: change type or add one

Date: 2026-11-03 · PR: see the PR that adds this file

## What the user wants to do

"This thought is really a Problem, not an Idea", without hunting for a row of type icons in the
panel. The row of types in the node panel goes; the ring of ghosts round the node already shows
every type, so that is where the type changes.

## The gesture

- **Touch:** tap a node (panel and ghosts come up, as today). Tap a ghost of another type: it is
  picked out as before and its name shows, and above its starter phrases two solid chips appear:
  **↻ Make this a Problem** and **＋ New Problem**. Tapping the first changes the node's type and
  clears the pick; the second opens a new node of that type at the ghost's spot. Tapping the ghost a
  second time still adds a new node, as before.
- **Mouse / keyboard:** the same with clicks.
- **What the user sees:** the two chips in the ghost's colour, nearest the ghost, then the dashed
  starter phrases. After a change the node's icon and the panel's symbol switch to the new type.
- **How to leave or undo it:** tap elsewhere or another ghost; a wrong change is undone by tapping
  the old type's ghost and *Make this a …* again.
- Only on your own node (the panel's old rule); a ghost of the node's own type, or a type an
  attack/protection node may not carry, shows no chips.

## Sketch

```
before                         after (tapped the Problem ghost)
   (?)  (Problem)  (Idea)          [↻ Make this a Problem]
 (Opt)   [node]   (Fail)           [＋ New Problem]
   (✓)   (Sol)                     (Problem) ← picked
panel: [type row] Info Modify      panel: 💡 by viktor  Info Modify
```

Screenshot: `map-ghost-choice.png` in the PR.

## Could be confused with

- *Ring of ghosts, tap a ghost* (adds a thought): same start; the chips only add a choice before the
  second tap, which still adds.
- *Ring of ghosts, drag a type out* (sketch a branch): unchanged, a drag never shows the chips.

## Quick test

Not run yet: Viktor asked for this directly. To try: open a node on a phone, ask "make this
thought a Problem" without saying how, and note whether the first thing tried is the Problem ghost.

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| | | | |

## Decision

Drop the type row from the node panel and the new-node panel (the type is picked on the ring before
writing). A picked ghost of another type on your own node offers *Make this a …* and *New …* above
its starter phrases. The right-click menu's *Change type* stays for mouse users.

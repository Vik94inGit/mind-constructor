# Ring of ghosts: types by map kind, ⋯ for the rest

Date: 2026-11-14 · PR: see the PR that adds this file

## What the user wants to do

"Change ring ghosts for problem solving and study depends on type of map." A study map shouldn't
offer *Problematic option*; a problem map shouldn't offer *Title* and *Question*.

## The gesture

- **Touch:** tap a node; the ring shows only the types for the map's kind
  (`utils/ringTypes.ts`), plus the node's own type if the set lacks it, and closes with a dashed
  **⋯** ghost. Tap ⋯ and the ring re-lays with every type, the ⋯ turning into **−** (*Fewer
  types*); tap it again to go back. Every other ghost behaves as before.
- **Mouse / keyboard:** the same with clicks; the right-click *Change type* still lists all types.
- **What the user sees:** a shorter ring, the ⋯ ghost last (counter-clockwise from the top), its
  name in the ring's rolling name chip.
- **How to leave or undo it:** tap ⋯ / − again, or close the node. The ring opens on the map's set
  again for the next node.
- A map made empty has no kind, so its ring is every type and has no ⋯.

## Sketch

```
study map                       after tapping ⋯
      (Title)                          (Problem) …
 (⋯)          (Question)        all 10 types round the node, (−) last
 (❓)  [node]  (✅)
      (Idea)
```

## Could be confused with

- *Ring of ghosts, tap a ghost*: same ring, but the ⋯ ghost is dashed with no type colour and never
  arms or adds; one tap acts at once.
- *Drag a type out*: the ⋯ ghost can't be dragged.

## Quick test

Not run yet: Viktor asked for this directly. To try: on a study map, ask "make this thought a
Problem" and note whether ⋯ is found.

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| | | | |

## Decision

The ring takes its types from `RING_TYPES_BY_KIND` (problem, decision, goal, retro, idea, study);
an empty map keeps all. A ⋯ ghost toggles to every type and back.

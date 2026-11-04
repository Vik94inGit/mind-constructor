# Step through a zone in creation order

Date: 2026-11-04 · PR: (this PR)

## What the user wants to do

"When I choose a zone and use the arrows, sort its children by creation date, to let me see my own
logic in the past."

## The gesture

No new gesture: the existing arrows change what they walk while a zone is chosen.

- **Touch:** tap a zone to choose it, open any node in it (or none), then tap the panel's ← / →.
- **Mouse / keyboard:** click a zone, then ← / → (or ↑ / ↓) or the panel's arrows.
- **What the user sees:** the arrows stay inside the chosen zone (its castles included) and go
  newest thought first, back to the oldest (dates decreasing), each step centering and opening that
  node. With nothing in the zone open, → starts at its newest thought and ← at its oldest. At
  either end the arrows stop.
- **How to leave:** release the zone (click it again or anywhere outside it); the arrows go back to
  reading the whole map as an outline.

## Sketch

```
zone chosen, written in this order: Problem (1), Idea (3), Option (2), Fail (4)

outline (no zone):  Problem → Option → Idea → Fail     (tree order)
zone chosen:        Fail → Idea → Option → Problem     (4 → 3 → 2 → 1, newest first)
```

## Could be confused with

- **Panel arrows / arrow keys** with no zone chosen: same keys, outline order over the whole map.
- **Time-lapse:** replays the whole map's build-up on its own bar; while it runs the arrows step it.
- **Presentation of a chosen zone:** slides by parent, not by date.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (asked for it) | to try on the PR preview | | |

## Decision

While a zone is chosen (`Map.selectedCircle`), `MapPage` `stepReading` steps through that zone's
nodes and their descendants by `createdAt`, newest first (`utils/nodeOrder.ts` `creationOrder`
reversed, `stepAlong`); otherwise it keeps the outline reading order. First built oldest first;
Viktor then asked for the sequence to decrease.

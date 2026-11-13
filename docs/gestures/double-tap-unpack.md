# Double-tap a packed node to unpack it

Date: 2026-11-13 · PR: <link once it exists>

## What the user wants to do

"Double click unpack packed nodes. Or double tap." A packed parent (one showing **+N**) should open
from the node itself, not only from its small +N pill.

## The gesture

- **Touch:** tap a packed parent twice quickly (within 350 ms, the same timing as a double-tap on
  the canvas). The first tap does what a tap always does; the second opens its children, as +N does.
- **Mouse:** double-click a packed parent. It opens instead of starting the inline text edit.
- **What the user sees:** the +N pill goes and the branch is back, as after tapping +N.
- **How to undo:** the − pill packs it in again. Packing stays a per-browser, per-map way of looking.

## Sketch

```
before                       after a double-tap / double-click
  [Problem](+3)                    [Problem]
                                  /    |    \
                              [Idea] [Opt] [Opt]
```

## Could be confused with

- **Double-click a node to edit its text:** only on an open node now. A packed node opens first; a
  second double-click on it, once open, edits as before.
- **Double-tap empty canvas** (new node): the taps land on the node, which stops them reaching
  the canvas, so no new node appears.
- **Tap a node** (opens its panel): the first tap still opens it; only the second unpacks.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | Asked for it directly: double-click, or double-tap on touch | — | Built as asked |

## Decision

A double-click or double-tap on a packed parent opens its branch, as its +N pill does (read off the
node's own clicks so Safari's taps work too), and doesn't start the inline edit. An open node's
double-click still edits.

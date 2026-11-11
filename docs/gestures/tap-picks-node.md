# Tap picks a node, it doesn't open it

Date: 2026-11-11 · PR: <link once it exists>

## What the user wants to do

"Don't open the card by a click or tap on a node." A tap on a thought, to look at it or to add
something round it, shouldn't throw the half-screen node panel over the map every time.

## The gesture

- **Touch:** tap a node: it's picked (highlighted, centered, its ring of ghosts comes up, an attack
  on it replays). No panel. Tap the same node again (or double-tap it) to open its panel.
- **Mouse / keyboard:** click picks it; click it again or double-click opens the panel (double-click
  on the text, as before); right-click → *Edit* opens it.
- **What the user sees:** after the first tap, the node is marked and the ring sits round it, and the
  map stays in view. After the second, the panel slides up as before.
- **How to leave or undo it:** tap empty canvas, a zone or a line, same as closing the panel.

## Sketch

```
before                              after
tap node ──► [ panel, half screen ]  tap node ──► (node) with ring of ghosts, map in view
                                     tap again ─► [ panel, half screen ]
```

## Could be confused with

- *Ring of ghosts, tap a ghost*: the ghosts sit round the node, the second tap lands on the node
  itself in the middle, so they're told apart by where the finger lands.
- *Double-tap empty canvas* makes a node; a double-tap on a node opens it. Different targets.
- *Change-parent / pack / choose modes* still take the tap on a node as a pick in that mode.
- *Reading views with pictures*: a first tap still shows the pictures; closing them leaves the node
  picked, not opened.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (to do on the PR preview) | | | |

## Decision

A tap or click on a node only picks it. The panel opens on a second tap or click on the picked node,
a double-tap / double-click, the node's right-click or hold menu (*Edit*), or the reading arrows,
search and creating a node, which open it as before.

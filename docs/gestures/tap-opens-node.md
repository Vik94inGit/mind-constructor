# Tap opens a node

Date: 2026-11-13 · PR: <link once it exists> · Replaces [tap-picks-node.md](tap-picks-node.md)

## What the user wants to do

"On click open node panel info on every node, also an attacking one or one with pictures set as
cards." One tap should show what the thought says, whatever kind of node it is.

## The gesture

- **Touch:** tap any node: its panel slides up on the **Info** tab, the node centered above it with
  its ring of ghosts. That holds for an attack (weapon) node, a node under attack, a card in the
  cards view and a node with pictures.
- **Mouse / keyboard:** click does the same; double-click on the text still edits it.
- **What the user sees:** after one tap, the panel with the node's text and, on Info, its pictures.
  An attack on your own node still has its Attack tab set up to strike back, one tap away.
- **How to leave or undo it:** tap empty canvas, a zone or a line, as before.

## Sketch

```
before                                       after
tap node ──► (node) picked, no panel          tap node ──► [ panel, Info tab ]
tap again ─► [ panel ]                        attack on your node ──► [ panel, Info ] (Attack tab ready)
reading view, node with pictures ──►          node with pictures ──► [ panel, Info, pictures in it ]
  [ pictures full screen ] ──► picked
attack on your node ──► [ panel, Attack ]
```

## Could be confused with

- *Ring of ghosts, tap a ghost*: the ghosts sit round the node; the tap on the node itself is in the
  middle.
- *Right-click / hold menu*: still picks the node without opening it; its *Edit* opens it.
- *Change-parent / pack / choose modes*, the time-lapse and line drawing still take the tap as before.
- *Pac-Man run of a strong attack*: the tap still replays the attack's arrow while opening the panel.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (on the PR preview) | | | |

## Decision

A tap or click on any node opens its panel on Info. The pictures-first view in reading views is
gone (the pictures are in the Info tab), and an attack on your own node no longer opens on the
Attack tab.

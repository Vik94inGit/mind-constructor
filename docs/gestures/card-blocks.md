# Cards as movable blocks (cards view)

Date: 2026-10-29 · PR: not built yet, waiting on a quick test

Takes over the earlier "drag cards without Move mode" sketch (2026-10-27), which was never built:
this sketch includes it.

## What the user wants to do

"Cards are in one line. I need to move cards to compare text, not in one line but like blocks,
with the possibility to bubble cards." Today the cards view flows every card in reading order:
on a phone that is one long column, on a desktop rows where a branch's cards run into the next
branch's. Comparing two thoughts means finding Move mode first.

## The gesture

Three pieces. Only the drags are new gestures; the layout is not.

1. **Blocks, not one line (layout).** Each top idea and its branch sit together in a **bubble**: a
   soft rounded outline behind its cards, with a small grip tab on its top edge. Inside a bubble the
   cards pack in a little grid (at least two side by side, also on a phone). The bubbles themselves
   are laid out in a grid like tiles, so a phone shows two columns of cards instead of one.
2. **Drag a card (no Move mode).** In the cards view only, press a card and drag: it lifts (small
   shadow) and follows the finger or mouse.
   - Let go **inside a bubble**: it joins that bubble, and the bubble's grid makes room for it.
   - Let go **onto a card on empty board** (a card not in any bubble): the two form a new bubble.
   - Let go **on empty board**: it leaves its bubble and stays there on its own.
   - Let go **beside another card**: it glues flush to that side, as Move mode does today.
3. **Drag a bubble.** Press the bubble's grip tab (or, with a mouse, its empty padding) and drag:
   the whole block moves, its cards keeping their places inside it.

- **Touch:** one finger on a card drags the card; one finger on the grip tab drags the bubble; one
  finger on empty board (between bubbles) pans; two fingers always pan and pinch.
- **Mouse:** drag a card moves it; drag a bubble's tab or padding moves the bubble; drag empty board
  pans or marquee-selects as today.
- **What the user sees before letting go:** the bubble under the dragged card lights up (thicker
  outline) when the drop would join it; a dashed outline shows where a new bubble would form; the
  glue line shows as today.
- **Undo:** ↶ puts the card or bubble back. A tap on a bubble's grip opens a small menu:
  *Tidy this bubble* (repack its grid) and *Unbubble* (cards stay where they are, the outline goes).
  *Lay the cards close* in the eye menu still repacks everything, now as bubbles.

A bubble is only a way of laying cards out: joining or leaving one never changes a node's parent,
zone or links (like the rest of the cards view). Your own cards' bubble is saved with the card, like
its spot; someone else's is arranged just for you.

## Sketch

```
before (phone, one line)          after (phone, blocks)

 [Should I move to Prague?]        ┌─⠿──────────────────────────┐
 [Move this spring]                │ [Should I move to Prague?] │
 [Closer to friends]               └────────────────────────────┘
 [Rent is twice as high]           ┌─⠿────────────┬─────────────┐
 [Sublet three months]             │[Move spring] │[Closer to   │
 [Stay and work remotely]          │[Rent x2]     │ friends]    │
 [No moving costs][I miss team]    │[Sublet 3 mo] │             │
 [Wait a year, save]               └──────────────┴─────────────┘
 [Put 300 € aside]                 ┌─⠿──────────────────────────┐
 [The offer may not wait]          │[Stay remote] [No moving $] │
                                   │[I miss the team]           │
                                   └────────────────────────────┘

drag "Rent x2" into the "Stay remote" bubble -> it sits beside "No moving $" to compare
drag "Rent x2" onto a lone card on empty board -> the two get a new bubble
drag the ⠿ tab -> the whole bubble moves
```

## Could be confused with

- **Node, not Move mode: swipe/drag pans.** In the cards view a drag that starts on a card moves the
  card instead. Panning stays on empty board between bubbles and on two fingers. Risk: a phone full
  of cards leaves little empty board; the gaps between bubbles are kept at least a finger wide.
- **Node, Move mode: drag moves it and glues.** Unchanged and still works; in the cards view Move
  mode is just no longer needed.
- **Node, Move mode: hold still, lift adds to a group selection.** Unchanged: a hold without moving
  still selects (or opens a card's menu).
- **Tap a card opens its panel.** Unchanged: a tap without movement opens it.
- **Card side handle: drag onto a card links them.** Unchanged: it starts on the handle, not the
  card body, and links; dropping a card body onto a lone card bubbles, it never links.
- **Zone: hold / right-click opens the zone menu.** Bubbles are not zones (the cards view draws no
  zones); a tap on the grip opens the bubble's own small menu.

## Quick test

Task (said without naming the gesture): "Open a map in the cards view. Put 'Rent is twice as high'
next to 'No moving costs' so you can compare them, then move that whole group to the top."

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor, on a phone and a laptop | | | |

## Decision

To be filled after the test.

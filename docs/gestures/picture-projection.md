# A picture you can see whole at 100%

Date: 2026-11-03 · PR: #186

## What the user wants to do

"Cards have their own coordinates, so pictures are projected to be visible completely at 100% zoom."
Today a picture's lines run through its cards, so the picture can never be smaller than its cards
laid side by side. A 10-dot bulb is about 400x500 and a smile about 800x800, too big for a phone
screen at 100%.

## The gesture

- **Drawing a picture:** the picture is drawn as its own small drawing: lines, fill and numbered
  dots, sized to fit inside the screen at 100% zoom (about 70% of what you see, at most 700 wide).
  The cards (the ghost thoughts) are laid out round the drawing on their own spots, each joined to its
  numbered dot by a faint thin line, like labels on a diagram. The view settles at 100% with the
  whole drawing in sight.
- **Drag a card (touch or mouse):** the card moves on its own and its thin line follows. The drawing
  doesn't bend any more. This is the change to an existing gesture: today, dragging a dot bends the picture.
- **Tap the caption, then − / + / Move:** − / + make only the drawing smaller or bigger. Move picks
  up the drawing and its cards together, as today.
- **Writing a card in:** the line between two written-in neighbours inks in on the drawing, as today.
- **How to leave or undo it:** the same as today. The toolbar's undo puts a card's move back.

## Sketch

```
before: lines run through the cards           after: a small drawing, cards round it

 [1. What idea…]──────[2. What could…]          [1. What idea…]    [2. What could…]
        |                     |                         ·.        .·
        |                     |                           ●──●
 [10. What idea…]─────[3. What would…]          [10. …] · ●  ● · [3. What would…]
                                                           ●──●
   wider than a phone at 100%                       Idea · 20% drawn
                                                 drawing fits the screen at 100%
```

## Could be confused with

- **Dragging a node** anywhere else on the map. A picture card now drags like any other node, so
  there is one less special case.
- **Tapping a dot on the drawing:** not a target. Only the cards and the caption are.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | Read the sketch | Nothing | Approved as sketched ("Build as sketched") |

## Decision

Built as sketched. A picture drawn from now on keeps its drawing's size on every dot
(`Node.picture.size`); the drawing is laid out at the size that fits the screen it was drawn on at
100% (60% of it, 160 to 600 canvas units on its longer side), its cards on a rectangle round it.
Where the drawing sits follows from its cards: each card points at the middle it was laid out
round, and the drawing goes to the mean of those. So it stays put while its cards arrive or when one
is deleted, follows the whole picture on Move, and drifts only a fraction when one card is dragged,
without bending. − / + change the drawing's size and lay its cards round it afresh; they aren't on
the undo stack, since undo only puts spots back. Pictures drawn before this keep their lines
through their cards. Code: `utils/pictures.ts` (`pictureFitSize`, `pictureCardOffsets`,
`pictureSpots`), `map/PictureLayer.tsx`, `hooks/useNodeCreation.ts`, `hooks/usePictureEdit.ts`.

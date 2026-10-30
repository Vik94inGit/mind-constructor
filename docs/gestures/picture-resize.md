# Resize and move a drawn picture

Date: 2026-10-30 · PR: #156

## What the user wants to do

"Change the size of the image, treat the image as one thing." A picture from *Draw a picture* is
made of separate thought nodes. Today you can only move it dot by dot, or by group-selecting every
dot first, and it can't get bigger or smaller at all.

## The gesture

- **Touch:** tap the picture's caption under it ("Heart · 60% drawn"). A small bar opens just
  under the caption, so it never covers the dots: **−**, **+**, **Move**, **Done**.
  - **− / +** shrink or grow the whole picture by 15% around its middle. Every dot moves with it, so
    the lines and the fill keep their shape. The size stops before two dots' cards would touch,
    and before the picture would leave the canvas.
  - **Move** picks every dot of the picture as a group. You then drag any dot and the whole picture
    follows, using the group drag that already exists.
  - **Done** (or a tap on empty canvas) closes the bar.
- **Mouse:** the same. Click the caption, then click − / + / Move. The mouse wheel is not used,
  because it already zooms the map.
- **What the user sees:** while the bar is open the picture's outline is lit up, so it's clear which
  picture the bar belongs to. Each − / + glides the dots to their new places, the way a moved node
  glides.
- **How to leave or undo it:** Done, Escape, or a tap outside. The toolbar's undo (↶) puts the last
  resize back, the same way it puts moves back.

## Sketch

```
before                                 bar open after a tap on the caption

   ●───●     ●───●                         ●────●       ●────●
    \   \   /   /                           \    \     /    /
     ●   ● ●   ●                             ●    ●   ●    ●
      \       /                               \           /
       ●─────●                                 ●─────────●
   Heart · 60% drawn                        Heart · 60% drawn
                                         [ − ] [ + ] [ Move ] [ Done ]
```

## Could be confused with

- **Node tap** opens a node's panel. The caption is not a node, and it sits away from the dots.
- **Zone hold / right-click** opens the zone menu. Pictures have no zone, so the two never overlap.
- **Empty canvas tap** closes things. Before this change the caption had no tap of its own.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | Read the sketch | Nothing | Approved as sketched ("Apply changes") |

## Decision

Built as sketched, with the bar under the caption rather than above it so it never covers the
dots. The bar keeps its size on screen at any zoom; the caption scales with the map like the rest
of the drawing. Only someone who may edit every dot of the picture gets the bar; for anyone else
the caption stays plain text. Code: `hooks/usePictureEdit.ts`, `map/PictureCaptions.tsx`,
`resizePicture` in `utils/pictures.ts`.

# Auto-pack, unpack in one click

Date: 2026-11-11 · PR: <link once it exists>

## What the user wants to do

"Autopack but unpack with one click." A map with a lot on it should open already packed, so it
reads at a glance, and getting the details back should never take more than one tap.

## The gesture

Today a map opens unpacked until the viewer picks *Overview* in the view prompt; a packed parent
shows a **+N** pill that opens only its own level (a packed parent below it stays packed), and
*Unpack all* sits inside the eye menu (two taps).

- **Auto-pack (no gesture):** a map with 6 or more nodes opens in the *Overview* (each parent packs
  its last details in, `utils/autoPack.ts` `overviewFolds`) unless the viewer already chose another
  view. The view prompt still asks once, with *Overview* already picked.
- **Touch and mouse, one tap on +N:** opens the whole branch under that parent, every level, in
  one tap (nested packed parents open with it).
- **Touch and mouse, one tap on "⊕ Unpack all":** while anything on the map is packed, a small
  pill sits right beside the eye button in the bottom-right corner. One tap opens everything and
  the pill goes away. (*Pack all* stays in the eye menu.)
- **What the user sees:** the map arrives with its tops and middle showing and **+N** pills where
  details wait; the corner shows *⊕ Unpack all*.
- **How to undo:** the − pill on a parent packs it again; *Pack all* / *Overview* in the eye menu
  packs the map again. All of it stays a per-browser, per-map way of looking.

## Sketch

```
opens (auto-packed)                     after one tap on "⊕ Unpack all" (or +3)
      [Problem]                               [Problem]
       /     \                               /    |    \
  [Option](+3) [Idea]                  [Option] [Idea] ...
                         (⊕ Unpack all)(👁)       /  |  \
                                             [..] [..] [..]            (👁)
```

## Could be confused with

- **Eye button** (opens the view menu): the Unpack-all pill sits to its left, with its own label,
  and only shows while something is packed.
- **Zoom controls / minimap** in the same corner: the pill stays on the eye's row, left of it.
- **+N pill** (before: opens one level): now opens the whole branch; *Pack all* followed by +N no
  longer walks down one level at a time.

## Quick test

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | | | |

## Decision

To be filled in after the quick test.

# Paste text onto the map

Date: 2026-10-31 · PR: <link once it exists>

## What the user wants to do

"I copied something from a web page (or a mail, a chat, a PDF) and I want it on my map as a thought,
without opening a node first."

## The gesture

- **Mouse / keyboard:** with nothing being typed in, Ctrl/Cmd+V. If the last thing copied was text
  from outside the app, it becomes a note at the mouse pointer (or the middle of the screen when the
  pointer is off the canvas). If the last thing copied was the app's own nodes, Ctrl/Cmd+V pastes
  those nodes as it does today. To tell the two apart, copying nodes in the app also puts their text
  on the system clipboard; when the clipboard still holds exactly that text, it's a node paste.
- **Touch (iPhone, Android):** a phone has no paste key and no Paste bubble on an empty canvas, so
  the **+** menu gets a **Paste text** row. Tapping it reads the clipboard (iPhone shows its own
  small "Paste" bubble to allow it, one more tap) and the note lands in the middle of the screen, in
  the nearest free spot.
- **Short text** (one paragraph, up to about 300 characters): the note is made straight away, with
  the type a quick note gets. A notice says *Pasted as a note* with an **Undo** button for a few
  seconds.
- **Long text** (more than 300 characters, or several paragraphs): nothing is made yet. A small card
  shows the first lines and asks:
  - **Keep as one note**: one node with the whole text.
  - **Split into thoughts**: opens *Text → nodes* (`map/TextToNodesModal.tsx`) with the text already
    filled in, on the same spot, so the user marks pieces or splits by sentence or paragraph.
  - **Cancel**.
- **How to leave or undo it:** Undo on the notice, or delete the node as usual; Cancel or Esc on the
  long-text card.

## Sketch

```
short paste                         long paste
┌────────────────────────┐          ┌────────────────────────────┐
│         map            │          │  "Stoicism teaches that…    │
│    ┌──────────────┐    │          │   we suffer more in…"  ⋯   │
│    │ Copied line  │ ←  │          │  1,240 characters          │
│    └──────────────┘    │          │ [Keep as one note]         │
│ Pasted as a note  Undo │          │ [Split into thoughts]      │
└────────────────────────┘          │ [Cancel]                   │
                                    └────────────────────────────┘
phone: + menu
┌──────────────┐
│ New node     │
│ Paste text   │ ← new
│ Paste 3 nodes│ (only when nodes were copied)
└──────────────┘
```

## Could be confused with

- **Ctrl/Cmd+V pasting copied nodes** (keyboard copy, paste and delete). Same key; whichever was
  copied last wins, as explained above, so the user gets what they just copied.
- **Pasting a picture** with Ctrl/Cmd+V: an image on the clipboard still goes to the open node, as
  today. Text is only taken when nothing is being typed in, so pasting inside a node's text box,
  the objection box or a search field is unchanged.
- **Right-click → Text → nodes**: the same flow as *Split into thoughts*, but you start it by hand
  and type or paste into it yourself. It stays.

## Quick test

Task given: "You copied a sentence in Safari. Get it onto this map." Then the same with a long
article paragraph.

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor | | | |

## Decision

To be filled in after the test.

# Quiz me

Date: 2026-11-09 · PR: <link once it exists>

## What the user wants to do

"I've laid out what I'm learning on a map. Now I want to test myself on it, then go back over the bits I don't know yet."

## The gesture

- **How it starts:** a **Quiz me** row in the empty-canvas menu (hold or right-click empty canvas), next to *Text → nodes*, and in the Display (layers) menu next to *Presentation*. It opens a full-screen card over the map, like presentation mode does.
- **Which nodes become cards (changed 2026-11-14):**
  - Only a ❓ (unknown), a Problem, a goal (Solution) or a study Question node asks. Its title (or text, or a ghost's question) is the question.
  - The answer is its ✅ (Success) children, as a list. Children of other types are left out of the answer.
  - A study Question (added 2026-11-14) asks the same way. One written into from a template is a card of its own: its ghost's question asks and what was written answers.
  - Any other node, or an asking node with no answer, makes no card.
  - Cards come in map order, the same order presentation mode uses.
- **Touch:** tap the card, or **Show answer**, to turn it over. Then tap one of three buttons under it: **Not yet** (red), **Shaky** (amber) or **Know it** (green). The next card comes up.
- **Mouse / keyboard:** click works the same way. Space turns the card over, 1 / 2 / 3 pick the mark, and ← steps back one card.
- **What the user sees:**
  - While answering: the question, a counter ("4 / 18") and a thin progress bar.
  - After turning: the answer below the question, with formulas drawn as maths.
  - At the end: how many cards got each mark, a **Go over the shaky ones** button (Not yet + Shaky only) and **Done**.
- **Marks:** each mark is private to the user, the way feelings are, so a shared class map works for everyone. They are saved to the user's own state, so they follow the user to other devices. Nothing changes on the map itself. The next round starts with the nodes marked Not yet or Shaky.
- **Writing a guess (added 2026-11-13):** under the hidden card is an optional field, *Write your answer*. Keys typed there stay letters (Space, 1 / 2 / 3 don't turn or mark); Ctrl/Cmd+Enter turns the card. Once turned, a written guess sits beside the true answer (*Your answer* | *Answer*, stacked on a phone) so the reader compares by eye before marking. The guess is kept for the round (← back still shows it), never saved.
- **How to leave:** the ✕ in the corner or Esc. Marks already given are kept.

## Sketch

```
 map ─ layers menu                quiz card (front)              quiz card (turned)
┌────────────────────┐          ┌──────────────────────┐       ┌──────────────────────┐
│ Whole map          │          │ ✕            4 / 18  │       │ ✕            4 / 18  │
│ Overview           │          │ ▓▓▓▓░░░░░░░░░░░░░░░  │       │ ▓▓▓▓░░░░░░░░░░░░░░░  │
│ Cards              │   tap    │                      │  tap  │  Causes of WW1       │
│ ▶ Presentation     │ ───────▶ │   Causes of WW1      │ ────▶ │  ─────────────────   │
│ ? Quiz me          │          │                      │       │  • Alliances         │
└────────────────────┘          │                      │       │  • Militarism        │
                                │   [ Show answer ]    │       │  • Nationalism       │
                                └──────────────────────┘       │ [Not yet][Shaky][Know it]
                                                               └──────────────────────┘
 end of round:  "Know it 11 · Shaky 4 · Not yet 3"   [ Go over the shaky ones ]  [ Done ]
```

## Could be confused with

- **Presentation mode** (panel arrows / arrow keys step node to node). Both are full-screen and step through the map in the same order. Quiz me is told apart by its title, its answer hidden until the card is turned, and the three mark buttons. In Quiz me, → does nothing, so a presentation habit can't skip past a card unanswered.
- No canvas gesture changes. Quiz me lives entirely in its overlay.

## Quick test

Task given: "You made this map to learn for a test. Check what you know." (Quiz me is not named.)

| Person | Tried first | Stuck on | Changed |
|---|---|---|---|
| Viktor (asked in writing) | The middle of the map, where text is pasted in and split into nodes | Who writes the questions (the map does: parent asks, children answer) | Quiz me added to the empty-canvas menu beside *Text → nodes*; no dots on the map |

## Decision

Built as above: Quiz me from the empty-canvas menu and the layers menu, a full-screen card that turns on a tap or Space, three marks (1 / 2 / 3), a round that starts with what isn't known yet, and *Go over the shaky ones* at the end. Marks are private (`MapViewState.quizMarks`) and draw nothing on the map. Cards come from the map alone: parent → children, title → text, ghost prompt → answer. Since 2026-11-14 only ❓, Problem and goal nodes ask, and only their ✅ children answer.

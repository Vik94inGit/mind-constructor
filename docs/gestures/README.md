# Design before code: new gestures

A gesture is anything a finger or mouse does on the map that isn't a plain button press: a drag, a
hold, a tap on a special spot, a right-click, a pinch, a key, or a new mode that changes what those
do. Gestures are where this app has churned most. Change-parent went through dragging the arrow, a
circle, its own mode and then losing the circle in about 48 hours; Pac-Man took six PRs. Each round
was fine on its own, but together they mean the design was decided in code.

So a new gesture, or a change to how an existing one behaves, goes through three steps, in order:

1. **One sketch.** Copy [TEMPLATE.md](TEMPLATE.md) to `docs/gestures/<short-name>.md` and fill it in:
   what the user wants to do, the gesture on touch and on mouse, a picture of the before and after
   (a phone photo of paper, a Figma frame, or ASCII in the file is enough), and which of the
   gestures below it could be confused with. Ten minutes, not a spec.
2. **One quick test.** Before writing the feature, show the sketch (or a throwaway click-through) to
   one or two people who haven't seen it, give them the task without saying the gesture, and write
   down in the same file what they tried first and where they got stuck. If nobody else is around,
   try it yourself on a phone, one-handed. Change the sketch until the first thing people try is the
   thing that works.
3. **One PR.** Build it in a single PR that links the sketch file, follows what the test settled, and
   updates the inventory below and the feature in [Frontend/web/README.md](../../Frontend/web/README.md).
   If the gesture is one of the main ones, update the first-map hint (`map/GestureHint.tsx`,
   `gestureHint` in `i18n/uiStrings.ts`, all four languages) too.

If the test or review shows the design was wrong, go back to step 1 and change the sketch rather than
trying a new variant in a follow-up PR. Fixing a bug in a gesture that otherwise works as designed
doesn't need this.

## Gestures in the map today

Check a new gesture against these. Two gestures that start the same way (a hold, a drag from a
node) must be told apart by something the user can see before they let go.

| Where | Touch | Mouse | Does |
|---|---|---|---|
| Node | Tap | Click | Opens its panel and the ring of ghosts |
| Ring of ghosts | Tap a ghost | Click a ghost | Adds a thought of that type |
| Ring of ghosts | Drag a type out | Drag a type out | Sketches a new branch where it's let go |
| Node, Move mode (✥) | Drag | Drag | Moves it; glues to a card it lands beside; joins a zone it's dropped on (a card in the cards view only moves clear of other cards) |
| Node, Move mode | Hold still, lift | Shift+click | Adds it to a group selection (or opens a card's menu) |
| Group member | Drag | Drag | Moves the group, the others following its path |
| Node, not Move mode | Swipe | Drag | Pans the map |
| Empty canvas | Drag | Drag | Pans (touch) / marquee-selects (mouse) |
| Empty canvas | — | Right-click | Paste here, new node, view menu |
| Card side handle | Drag onto a card | Drag onto a card | Links the two cards |
| Zone | Hold | Right-click | Zone menu: copy text, shape, delete, look |
| Change-parent mode | Tap a node | Click a node | Hangs the child from it (own parent: swap) |
| Strong attack, discussion | Tap the attack | Hover it or its target | Pac-Man run to the node it hit |
| Picture caption | Tap | Click | Opens the picture's bar: − / + resize the whole picture, Move picks every dot for a group drag ([sketch](picture-resize.md)) |
| Canvas | Pinch | Ctrl+wheel, − / + | Zoom |
| Panel | Its arrows | Arrow keys | Step node to node |
| Canvas, first open | Tap | Click or wheel | Skip the entrance |

Sources: [Frontend/web/README.md](../../Frontend/web/README.md), `hooks/useNodeDragAndDrop.ts`,
`hooks/useMarqueeSelect.ts`, `hooks/useCanvasMode.ts`, `hooks/useTapChomp.ts`,
`hooks/useMapKeyboard.ts`, `hooks/usePictureEdit.ts`, `map/ZoneMenu.tsx`.

# Mind Constructor — Web

React + TypeScript + Vite frontend for the Mind Constructor API (see
[`../../Backend/docs/api-guide.html`](../../Backend/docs/api-guide.html) for the REST reference and
[`../../Backend/CLAUDE.md`](../../Backend/CLAUDE.md) for the domain model).

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL if the backend isn't on localhost:3000
npm run dev
```

The backend must be running (`npm run dev` in `Backend/`) and reachable at `VITE_API_URL`.

## What's here

- **Auth** (`/login`, `/register`) — email/password or "Sign in with Google" (one endpoint for
  both registering and logging in); the session is an httpOnly cookie kept in Redis on the backend. "Try it without an account"
  spins up a throwaway demo account with its own seeded map — nothing to configure to try it.
- **Think it through** (`/think`) — a guided, writing-first way to start a map, opened from the
  dashboard's "What's on your mind?" box. Four steps: pick what kind of thinking it is and write the
  central thought; answer one guiding question at a time (Enter adds a thought, Enter on an empty
  line moves to the next question) while a live preview of the map grows beside it; check each
  thought's kind and what it hangs from; then name it, choose Personal or Discussion, and the
  thoughts are built into a real map laid out in the same shape as the preview (both drawn from
  `utils/shapeLayout.ts`): the thoughts on the center sit round a circle, a square or an
  equilateral triangle, each deeper one a step out from the one it hangs from, and the zone rules
  only nudge what would cover another node or cross a castle wall. The draft is kept in the browser until then. See
  `src/pages/ThinkPage.tsx` and `src/utils/thoughtFlow.ts`.
- **Dashboard** (`/`) — maps you own or were invited to; create/rename/delete, invite members, see
  who's on a map and who owns it, copy a whole map's nodes to paste into another one.
- **Map canvas** (`/maps/:mapId`) — the core of the app. Drag your own nodes, branch off a node
  with the quick-add ghosts or the toolbar, link nodes explicitly, draw separator lines, attack
  other members' nodes with the three combat weapons, shield your own, pack nodes into a
  container, group nodes into a chosen circle, choose a node (and optionally its whole branch) to
  link/copy/number/delete together, and switch how nodes read (icons only, icons + text, or
  cards — each node a sticker card with its whole text — or a mixed mode: zone parents as
  cards, everything else a bare icon) for the whole map or just the chosen nodes. Cards sit on the
  board in its own units (their own spot, `Node.cardX/cardY`), so they grow and shrink with the zoom;
  their owner resizes one from its corner grip and picks its text size and shape (rounded, square,
  round) in the panel's Info tab (`Node.cardW/cardH/cardFont/cardShape`, `map/StickerCard.tsx`). A
  card let go on top of others is moved just clear of them, and one dragged close to another (with
  Move on) glues flush against its side — two of your cards glued together get linked and then drag
  as one (`utils/cardGlue.ts`); drag from a card's side handle onto another of your cards to link
  them. The cards view draws no links: no branch arrows, links, zones or parent rings between two
  cards, so they read as notes spread on a desk. Cards that have no spot of their own yet are laid
  close together in reading order (each top idea, then its branch), in a block shaped like the
  screen, under the cards already placed; your own cards' spots are saved, someone else's are laid
  out just for you (`utils/cardPack.ts`, `hooks/useCardPacking.ts`). Drag any two side by side to
  compare them; *Lay the cards close* in the eye menu packs them all again. No quick-add ghosts ring a card; instead your selected card has a + button on its bottom edge
  that starts a branch just under it, clear of the cards around (`cardGlue.ts` `spotBelow`). Each card's fill color can be changed in
  its panel's Info tab (per browser). Each zone can also take its own view (cards, mixed, icons + text, the default look, or
  dots) from the ⋯ button beside its name, so one canvas can show different
  sides of the same map at once (per browser). The ⋯ buttons sit on a compact list, just left of the minimap, of the zones currently in view.
  Your own nodes can be locked from the node panel's Info tab, the right-click menu, or the
  padlock on a card's corner (per browser): a locked
  block can't be dragged, glued to another card or have its text edited until unlocked. Zoomed
  out to 50%, nodes show as plain dots, the canvas drops its other icons (zone-parent rings,
  weapon marks, quick-add ghosts) and the view glides to the middle of the map; zones near the
  middle of the view stay at full strength while the rest are muted; selecting a node centers it on
  screen.
- **Views and auto-pack** — the eye menu in the bottom-right corner switches between three ways to
  look at a map: *Whole map*, *Overview* and *Cards* (`utils/viewPrompt.ts`), which took the place
  of the old "simpler ↔ more detail" equalizer. The overview
  auto-packs every parent whose children are all leaves, so the map keeps its shape and only its
  last details go. Any parent can also be packed or opened on its own from its panel's Info tab
  (*Pack its branch*); a packed parent shows a "+N" pill on its right that opens it again. Auto-pack
  is only a way of looking, per browser and per map, and changes nothing on the map
  (`utils/autoPack.ts`), unlike packing nodes into a container. Once a map of six or more nodes
  has built itself up, a small card asks once which of the three views to use (`map/ViewPrompt.tsx`);
  the answer is kept (per browser, closing the card keeps the view as it is) and every map opens in
  it from then on.
- **Right-click on empty canvas** — a desktop-style menu at the click point: *Paste here*, *New node ▸*
  (a submenu of the node types), *Analyze a problem* / *Make a decision* / *Plan a goal* / *Look back
  (retrospective)* / *Develop an idea* (grows that map kind's starter structure right there, see `utils/templates.ts`),
  *Text → nodes here* and *Text → map*. See `src/map/CanvasContextMenu.tsx`.
- **Text → nodes** — paste a text on the map itself, mark its pieces (by hand, or every line/sentence
  at once) and they become nodes around the click point, hanging from the whole text as a main node.
  The map's free room is counted first (`utils/freeSpots.ts`); when not every new node fits, the user
  sees how many do and chooses which pieces to pack into the main node. Its type buttons show each
  type the way the viewer's nodes do: its emoji in emoji first, else its symbol (`map/TypeFace.tsx`).
  See `src/map/TextToNodesModal.tsx`.
- **Pictures on nodes** — the node panel's Info tab shows the text and its pictures in one box, like
  a post: screenshots pasted with Ctrl+V, images dropped on the box or picked with its 🖼️ button land
  under the text; each is shrunk before upload (`utils/images.ts`). The backend keeps pictures in
  their own image store and the node gets back each one's `/api/images/…` address; `imageSrc` turns
  that (or an older inline data URL) into an `<img>` src. See
  `src/map/nodePanel/InfoTab.tsx` and `ImagesSection.tsx`.
- **Type symbols and emoji** — on the canvas every type shows its own symbol by default: pause bars
  for a Problem, play for a Problematic option and an Option, target rings for a Solution, ✓ Success,
  ✗ Fail, a bulb for an Idea and ? for unknown (`map/OutcomeBadge.tsx`). Symbols first is the default: the
  type's symbol is face up and a node's own emoji sits on the back. With *Emoji first* turned on in
  the display menu (`Preferences.emojiUp`) a node with an emoji shows it face up, its type's symbol on the back of a two-sided card
  that turns over once when the node is chosen (`map/NodeFlipIcon.tsx`). The emoji is the node's own
  (Modify tab, `map/nodePanel/EmojiPicker.tsx`, or the emoji ghost ring below), or one the viewer
  picked for its type under *Emoji for each type* in the display menu, where the symbol comes first
  and each type's usual emoji (❗ ⚠️ 🎯 🔀 ✅ ❌ 💡 ❓) leads the emoji. A
  node's owner can tick *Keep this emoji still* so its own emoji stays up and never turns
  (`Node.emojiStill`). A picture icon stays the face of its node. Choosing a zone (its parent, or
  holding it still) turns its cards over one after another, parent first, then the children by
  their order (`hooks/useFlipSequence.ts`). Both choices follow the user to every device
  (`utils/emojiFace.ts`, `/api/state`).
- **Emoji ghosts** — after a type ghost is picked, a ring of feeling emoji (plus a skip ghost) is
  offered the same way, and the new node gets both; in *Emoji first* the feelings come first, then the
  types (`map/QuickAddGhosts.tsx`).
- **Node panel under the node** — the node panel (and the pack picker and new-node panel) is a bottom
  sheet, half the screen, with the node's text first and a type picker in its header; the chosen node
  is centered in the half above it (`hooks/useCanvasViewport.ts`), and the quick-add ghosts ring that node itself. Creating a
  node (any way) opens `map/NewNodePanel.tsx` with its text field focused — with the feelings offered
  as a ring around the new node, optional — and editing opens the node's panel on its text.
  Big round ← / → arrows at either end of the sheet's top edge step to the previous or next
  node, with the resize handle between them. The steps include every attack, right after the node it
  hit, and each node they reach opens on its Info tab (an attack on your own node otherwise opens on
  Attack, ready to strike back).
- **Picture icons and cards** — any picture on a node can be its round icon on the map ("Use as
  icon": a small square cut by `utils/images.ts` `makeIconImage`, saved as `Node.iconImage`) and/or a
  picture card above the node ("Show as card": `makeCardImage`, `Node.cardImage`; inside the card in
  the cards view).
- **Text length** — typed node text is capped at 1000 characters (`utils/nodeText.ts`), with a counter
  in the panel; the inline inputs grow taller with the text, never wider.
- **After creating** — once a node is created from `map/NewNodePanel.tsx`, nothing stays open: the
  node lands and the map is in view again.
- **Hiding the ghosts** — the ring of ghosts comes up round every node you open; the 👻 at the top of
  its panel hides it for that node, and opening another brings the ghosts back.
- **Changing a parent** — its own mode. Press ↪ *Change parent* on the child's Info tab. The panel and
  the ghosts go away, the child stays ringed, and a short bar
  (`map/ReparentBar.tsx`) says to tap the new parent; nodes don't drag meanwhile, so a swipe pans the
  map. Tap a node and the child hangs from it instead, and its link to the old parent, if it had one,
  moves to the new parent too, same direction and feeling (`utils/edgeRedirect.ts` `linksToMove`). A
  node that can't take it (the child's own branch, which would close a loop; someone else's node; a
  non-attack for an attack) says why in the bar and the mode stays. Cancel or Escape
  leaves. The zones reshape to fit: the old parent's
  zone loses the child (and disappears when it's down to one), the new parent's grows to take it in or
  appears. A child already within one and a half zone reaches of its new parent stays where it is;
  one farther out comes in next to it on the side it sat, settled by the zone rules, and its own far
  children follow like a magnet. One undo puts the old parent and the spots back (a moved link stays
  where it went).
- **Swapping a child with its parent** — ⇅ *Swap with parent* on the child's Info tab (or, in the
  change-parent mode, tap its own parent). The child takes the parent's place: its spot, and the
  parent it hung from, so the zone still hangs where it did from the zone above. Every other node of
  the zone hangs from it now, and so does the old parent, which moves to the child's old spot. The old
  parent's links, to the zone's nodes and to nodes in other zones, move over to the child, same
  direction and feeling (`utils/edgeRedirect.ts` `takeParentPlace`); the one between the two stays.
  Refused, with why, when a node that would change isn't yours or the child is an attack. One undo
  puts the parents and spots back; a save that fails puts everything back at once.
- **Moving nodes** — a dragged node (or group) lands where it was let go, nudged only so it doesn't
  cover another node or its text; the zone rules (`utils/zoneRules.ts`) still place new nodes, except
  a type dragged out of a node's ring, which lands where it was let go too. Dropping a node anywhere on
  another node's card (plus a small margin, `canvasLayout.ts` `dropTargetDistance`) joins that node's
  zone, and it then lands at the nearest spot that covers nothing; a member stays in its own zone until
  it's dragged past one and a half zone reaches from its root. A parent keeps its own nodes close like a
  magnet (`utils/parentMagnet.ts`): once it has moved, each of your children left more than one and a half
  zone reaches away glides back towards it on the side it was on, and if that spot is taken it slides on
  to the nearest free one still within reach; a pulled child brings its own far children along the same
  way, and one undo puts them all back. The 🧲 *Call its nodes back* button on a parent's Info tab does the
  same on demand, for every one of your children outside its zone. A single
  node only drags in Move mode (the ✥ button), with a mouse or a finger, so looking around the map
  never moves anything: out of Move mode a swipe that starts on a node pans the map. In Move mode a
  finger drags a node once it really travels (a tap or a small graze still opens it), and on any node
  holding still then lifting adds it to a group selection or opens a card's menu, so holding a moment
  before dragging still drags. Dragging one
  member of a group (a whole zone picked out, or any selection) moves it like a creature: the touched
  node follows the finger and the rest walk its path behind it, one after another, each hopping on
  its own beat, and catch up after the drop; cards glued together follow the same way
  (`hooks/useNodeDragAndDrop.ts`, `utils/followTrail.ts`).
- **Zone menu** — holding or right-clicking a zone (`map/ZoneMenu.tsx`) offers *Copy as text* (every
  node in it, in map order), one *Shape* for your nodes in it, and *Delete* for them, above its view,
  layout and look.
- **Keyboard copy, paste and delete** — with nothing being typed in, Ctrl/Cmd+C copies the chosen
  node or group and Ctrl/Cmd+V pastes it, on this map or another, with its text, pictures, picture
  icon and card, emoji, shape and card size (`utils/nodeClipboard.ts`, `hooks/useClipboardActions.ts`);
  Delete or Backspace deletes the chosen node (undoable) or your nodes in the group
  (`hooks/useMapKeyboard.ts`).
- **Deleting** — a deleted node pops like a bubble where it stood, or goes off in a small boom when it
  was a Problem, Problematic option or Fail (`map/NodeBurst.tsx`). Questions such
  as "Delete 3 nodes?" use the app's own dialog (`context/ConfirmContext.tsx`), not the browser's.
  Deleting a parent also deletes its own children one generation down that have no children of
  their own; a child that is itself a parent stays, with its branch, and just loses the link. Undo
  brings them all back together (`utils/restoreNode.ts` `leafChildrenOf`).
- **First map** — a one-time card lists the main gestures, touch or mouse ones (`map/GestureHint.tsx`).
- **Loading** — the map editor, *Think it through*, text splitting and admin load on demand
  (`App.tsx`); the build writes `asset-list.json` so the service worker keeps them for offline too.
- **Computer mode** — on a wide screen with a mouse/trackpad (`hooks/useDesktopLayout.ts`), the map's
  toolbar docks as a panel down the left edge, like a desktop's taskbar / main menu, with its menus
  opening beside it; language and theme sit at its bottom. Phones and narrow windows keep the
  floating top-left cluster.
- **Live updates** — everyone with a map open sees each other's nodes, attacks, shields and deletions as
  they happen (`hooks/useMapSocket.ts`). If the live connection is down or the server never confirms the
  map's room, the map is fetched again every 10 seconds and the join retried; a tab that is shown again
  after sleeping catches up at once.
- **Offline** — the dashboard and every map you've opened before still open with no connection
  (the service worker keeps the app's files, `src/offline/` keeps the last copy of your data in
  IndexedDB). You can keep working: creating, editing, moving and deleting nodes, links and lines,
  creating/renaming/deleting maps and folders. Each change answers right away and waits in an
  outbox; when the server is reachable again they're sent in order, and anything made offline gets
  its real id swapped in for the temporary `local_…` one in every later request. A server that
  can't be reached counts as offline too: a bare 502/503/504 page from the proxy in front of it
  (Vercel's rewrite, Render while it's down or waking up) is treated like no connection. A pill at the
  bottom shows offline / waiting / syncing, and which changes the server refused (e.g. a node
  someone else deleted meanwhile — the server's state wins). Attacks, shields, packing, hiding a
  branch, choosing a circle and inviting need a connection, since only the server can decide them.
  Changes are tagged with the account that made them and only ever sent for that account; signing
  out clears the kept copy of the data but not unsent changes. See `src/offline/sync.ts`.
- **Admin** (`/admin`) — visible only if your account's `role` is `admin` (granted with
  `npm run admin:promote` in `Backend/`, never through the app itself). Block/unblock/delete
  users, wipe the database.
- **i18n** — English, Czech, Ukrainian and Russian throughout the toolbar, panels, menus and error
  messages (`src/i18n/`), node type names included (the stored value stays English).
- **Templates** — the node panel's Info tab offers a ready branch on a node with no children yet:
  a Problem gets an issue-tree / plan-do-check structure, a Solution (goal) gets a SMART-style
  breakdown, an Idea gets "Develop this idea" (the need it meets, how it would work with the smallest
  way to try it, what would prove it, what could kill it, what is still unknown, and another idea for
  the same need), and a failed (Fail) node gets "Analyze and try again". A template's first level lands
  on a shape round the node: three (or six) make an equilateral triangle, four a square, any other
  number a circle, and each deeper level fans a step further out (`src/utils/shapeLayout.ts`,
  `src/utils/templates.ts`).
- **Map types** — creating a map asks for one of five kinds (Problem analysis, Decision, Goal planning,
  Retrospective, Idea), each seeded with a starter structure in your language, and for a mode (Discussion or
  Personal). The owner can switch the mode later from the map's toolbar. A Personal map is drawn
  calm: no halo/horns, wings or crown badge on its nodes or quick-add ghosts, and no Attack tab or
  menu item (switch to Discussion for those).
- **Entrance** — every map, Personal or Discussion, builds itself up as it opens, the way a template
  branch fills in. Nodes come first: they appear one after another in the order they were made, one
  thought about every 1.8 s, slow enough to read each one, each fading and growing in where it
  already sits, with the camera in at native size following each one; links and weapon bows show
  once both their nodes are there. Then the zones: the camera steps back to the whole map and each
  zone, with its wall and the realm border round a kingdom, is drawn whole round its nodes, one
  after another (about 0.7 s apart). A big map never takes much more than a minute, and a click or
  a wheel scroll anywhere on the canvas brings everything in at once and leaves the camera where it
  is (`src/hooks/useNodeEntrance.ts`, `src/utils/nodeEntrance.ts`).
- **Search** — the magnifier in the map toolbar finds nodes by title, text or zone name (accents ignored);
  matches stay lit while everything else dims, and a result takes you to that node. Under the box,
  one chip per node type the map has (with its count) filters by type: pick one or more and only
  those nodes stay lit and are listed, combined with any typed words. The picked types stay in force
  after the search closes (the magnifier shows a dot) until *All types* clears them
  (`src/utils/nodeFilter.ts`, `src/map/NodeSearch.tsx`).
- **Hide a branch** — the map's owner can hide a branch from invited members in a node's Modify tab; hidden
  nodes carry a crossed-eye badge for the owner. Enforced by the backend, not just the UI.
- **Simplified view** — the toolbar's `Aa` menu has a switch that shrinks icons and drops halo/horns,
  wings and circle-parent rings to cut visual noise. It defaults to on for a phone-sized screen and
  is remembered per browser.

## Known API limitations reflected in the UI

- Combat has no cooldowns. In Battle mode (the map's default) attacks do damage; the map's owner may
  attack with any node type, other members answer a negative node with a positive one and a positive
  node with a question or a Problem / Problematic option (enforced by the backend's `attackAbl.ts`).
  In Creating mode attacks only add their node and do no damage. The one way to stop a battle-mode
  attack is a protection node, created by the target's own owner.
- An attack belongs to no zone of the castle it hits. Another member's attack, or the imitated opponent's
  move, is placed outside the walls of that castle and can't be dragged into any castle. Dragging an
  attack onto another attack makes a zone of attacks (dragging it back out hangs it from its target
  again), and any node can join that zone; attacks link to each other like any nodes (Choose, then
  Link). In a discussion nobody can drag their own nodes into another player's castle either
  (`utils/zoneRules.ts` `othersTerritory`). Opening an attack on
  one of your nodes lands on its Attack tab, ready to strike back (each hit on it heals your node by
  10); the opponent's-turn panel offers the same right after its move.
- A strong attack (a Counterpoint, which takes a fresh node to 75%, or a Fatal flaw, which takes it to
  50%) plays Pac-Man while the mouse rests on it, or on the node it hit (then every strong attack on
  that node runs at once), or once when you tap the attack itself on a phone (stepping onto it with the
  panel's arrows, or tapping the node it hit, leaves it still): the attack node itself, its icon unchanged,
  runs to the node it hit (or that node's shield), nudges into it once and runs back, while a wedge facing
  the target opens in its round icon like a mouth, starting as the empty part of its health ring and
  widening on the way in (`utils/pacman.ts`, `hooks/useTapChomp.ts`, `NodeCard`'s `chomp`). A Nitpick stays still.
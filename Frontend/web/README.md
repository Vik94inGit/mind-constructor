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
  both registering and logging in), JWT stored in `localStorage`. "Try it without an account"
  spins up a throwaway demo account with its own seeded map — nothing to configure to try it.
- **Think it through** (`/think`) — a guided, writing-first way to start a map, opened from the
  dashboard's "What's on your mind?" box. Four steps: pick what kind of thinking it is and write the
  central thought; answer one guiding question at a time (Enter adds a thought, Enter on an empty
  line moves to the next question) while a live preview of the map grows beside it; check each
  thought's kind and what it hangs from; then name it, choose Personal or Discussion, and the
  thoughts are built into a real map. The draft is kept in the browser until then. See
  `src/pages/ThinkPage.tsx` and `src/utils/thoughtFlow.ts`.
- **Dashboard** (`/`) — maps you own or were invited to; create/rename/delete, invite members, see
  who's on a map and who owns it, copy a whole map's nodes to paste into another one.
- **Map canvas** (`/maps/:mapId`) — the core of the app. Drag your own nodes, branch off a node
  with the quick-add ghosts or the toolbar, link nodes explicitly, draw separator lines, attack
  other members' nodes with the three combat weapons, shield your own, pack nodes into a
  container, group nodes into a chosen circle, choose a node (and optionally its whole branch) to
  link/copy/number/delete together, and switch how nodes read (icons only, icons + text, or
  puzzle cards — each node a jigsaw-piece card with its whole text — or a mixed mode: zone parents as
  cards, everything else a bare icon) for the whole map or just the chosen nodes. Puzzle pieces
  interlock along links (a tab toward a child or an edge's far end, a matching blank on the other
  piece; a piece joined on all four sides gets a ✓; drag out of one of your piece's tabs onto another of your
  pieces to link them; with Move on, a piece dragged close to another whose facing side fits — a
  tab to a slot — clicks in flush against it, and two of your pieces clicked together get linked), and each piece's fill color can be changed in
  its panel's Info tab (per browser). Each zone can also take its own view (puzzle cards, mixed, icons + text, the default look, or
  dots) from the ⋯ button beside its name, so one canvas can show different
  sides of the same map at once (per browser). The ⋯ buttons sit on a compact list, just left of the minimap, of the zones currently in view.
  Your own nodes can be locked from the node panel's Info tab, the right-click menu, or the
  padlock on a puzzle block's corner (per browser): a locked
  block can't be dragged, clicked into another piece or have its text edited until unlocked. Zoomed
  out to 50%, nodes show as plain dots, the canvas drops its other icons (zone-parent rings,
  weapon marks, quick-add ghosts) and the view glides to the middle of the map; zones near the
  middle of the view stay at full strength while the rest are muted; selecting a node centers it on
  screen.
- **Right-click on empty canvas** — a desktop-style menu at the click point: *Paste here*, *New node ▸*
  (a submenu of the node types), *Analyze a problem* / *Make a decision* / *Plan a goal* / *Look back
  (retrospective)* (grows that map kind's starter structure right there, see `utils/templates.ts`),
  *Text → nodes here* and *Text → map*. See `src/map/CanvasContextMenu.tsx`.
- **Text → nodes** — paste a text on the map itself, mark its pieces (by hand, or every line/sentence
  at once) and they become nodes around the click point, hanging from the whole text as a main node.
  The map's free room is counted first (`utils/freeSpots.ts`); when not every new node fits, the user
  sees how many do and chooses which pieces to pack into the main node. See `src/map/TextToNodesModal.tsx`.
- **Pictures on nodes** — the node panel's Info tab shows the text and its pictures in one box, like
  a post: screenshots pasted with Ctrl+V, images dropped on the box or picked with its 🖼️ button land
  under the text; each is shrunk before upload (`utils/images.ts`). See
  `src/map/nodePanel/InfoTab.tsx` and `ImagesSection.tsx`.
- **Emoji cards** — a node can carry an emoji (Modify tab, `map/nodePanel/EmojiPicker.tsx`, or the
  emoji ghost ring below); its icon is then a two-sided card that turns over once, to the emoji and
  back, when the node is chosen (`map/NodeFlipIcon.tsx`). Choosing a zone (its parent, or holding it
  still) turns its cards over one after another, parent first, then the children by their order
  (`hooks/useFlipSequence.ts`). *Emoji first* in the eye menu turns the emoji face up instead
  (`utils/emojiFace.ts`, kept in this browser).
- **Emoji ghosts** — after a type ghost is picked, a ring of feeling emoji (plus a skip ghost) is
  offered the same way, and the new node gets both; in *Emoji first* the feelings come first, then the
  types (`map/QuickAddGhosts.tsx`).
- **Text length** — typed node text is capped at 1000 characters (`utils/nodeText.ts`), with a counter
  in the panel; the inline inputs grow taller with the text, never wider.
- **New node → panel** — confirming a new node's inline name opens its panel with the text field
  focused, ready for the full text.
- **Computer mode** — on a wide screen with a mouse/trackpad (`hooks/useDesktopLayout.ts`), the map's
  toolbar docks as a panel down the left edge, like a desktop's taskbar / main menu, with its menus
  opening beside it; language and theme sit at its bottom. Phones and narrow windows keep the
  floating top-left cluster.
- **Offline** — the dashboard and every map you've opened before still open with no connection
  (the service worker keeps the app's files, `src/offline/` keeps the last copy of your data in
  IndexedDB). You can keep working: creating, editing, moving and deleting nodes, links and lines,
  creating/renaming/deleting maps and folders. Each change answers right away and waits in an
  outbox; when the server is reachable again they're sent in order, and anything made offline gets
  its real id swapped in for the temporary `local_…` one in every later request. A pill at the
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
  breakdown, and a failed (Fail) node gets "Analyze and try again". See `src/utils/templates.ts`.
- **Map types** — creating a map asks for one of four kinds (Problem analysis, Decision, Goal planning,
  Retrospective), each seeded with a starter structure in your language, and for a mode (Discussion or
  Personal). The owner can switch the mode later from the map's toolbar.
- **Search** — the magnifier in the map toolbar finds nodes by title, text or zone name (accents ignored);
  matches stay lit while everything else dims, and a result takes you to that node.
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
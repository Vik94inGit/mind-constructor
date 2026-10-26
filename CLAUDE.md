# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

> **Before doing any implementation or task, check the available Skills and use whichever ones
> are relevant.** Do this first, not as an afterthought.

## What this is

Mind Constructor is "notes you can see". The main path is personal: jot a thought in a second (a
quick note lands in the user's **Inbox** map, `Frontend/web/src/utils/inbox.ts`), lay thoughts out
on a canvas as typed **nodes** (Problem / Problematic option / Solution / Option / Success / Fail /
Idea / unknown) whose place, zone and links show how they relate, and find any of them again with search
across all maps. Starter structures arrive as faded **ghost** nodes that carry only a question
(`Node.prompt`) and fill in as the user answers them.

On top of that, maps can be shared and edited live, and a map in **discussion mode**
(`Map.discussionMode !== false`; "Personal"/creating mode is `false`) becomes a battle: members
attack nodes with objections, shield their own, and the owner can play an imitated opponent. On the
canvas a discussion reads as a realm under siege (`Frontend/web/src/utils/siege.ts`): a zone whose
parent hangs from nothing is the **kingdom**, a zone whose parent hangs from another node is a
**castle** inside it, and every zone outline is drawn as a wall, with the kingdom's outer border drawn
automatically round the whole tree (`CanvasBackdrop.tsx`, `canvasLayout.ts` `realmOutline`). A
discussion is finished only **fairly** (the opponent had the last word, or everyone agreed), and
every edit and deletion in it is kept in an append-only **history** visible to all members.

## Repo layout

One git repository:

- **`Backend/`** — Express 5 + TypeScript + MongoDB (Mongoose) REST API plus a Socket.IO server.
  Its own [Backend/CLAUDE.md](Backend/CLAUDE.md) is the authoritative reference for the domain model,
  layering (routes → controllers → abl → dao → models), combat/finish/history rules and every node
  field. REST reference: [Backend/docs/api-guide.html](Backend/docs/api-guide.html).
- **`Frontend/web/`** — React 18 + TypeScript + Vite + Tailwind 4 SPA. Its
  [README](Frontend/web/README.md) is the feature-by-feature rundown of the UI.
- **`.github/workflows/ci.yml`** — CI, see below.
- `docker-compose.yml`, `render.yaml`, [DEPLOY.md](DEPLOY.md) — deployment (backend on Render,
  frontend on Vercel; `Frontend/web/vercel.json` rewrites `/api/*` to the backend).

## Commands

```bash
# Backend (cd Backend) — needs a .env, see Backend/.env.example and Backend/CLAUDE.md
npm run dev          # http://localhost:3000
npx tsc --noEmit     # typecheck
npm run test:run     # vitest once; DAOs are mocked, no MongoDB needed

# Frontend (cd Frontend/web)
npm run dev          # http://localhost:5173, VITE_API_URL defaults to http://localhost:3000
npm run lint         # tsc --noEmit
npm test             # vitest run (jsdom); npm run test:watch for watch mode
npm run build        # tsc -b && vite build
```

**CI** runs on every pull request and every push to `main`: the backend job does `npm ci`,
`npx tsc --noEmit`, `npm run test:run`; the frontend job does `npm ci`, `npm run lint`, `npm test`,
`npm run build` (Node 22). Run the same commands for whichever side you touched before pushing.

## Frontend architecture (`Frontend/web/src`)

- **`pages/`** — `DashboardPage` (folders + maps grid, quick note, "What's on your mind?"),
  `ThinkPage` (the guided "Think it through" flow, logic in `utils/thoughtFlow.ts` and `think/`),
  `MapPage` (the canvas; ~3000 lines, so most behavior is pulled out into `hooks/` and `map/`),
  `SplitTextPage`, `AdminPage`, login/register.
- **`api/`** — one module per backend resource (`maps`, `nodes`, `edges`, `lines`, `folders`,
  `state`, `auth`) over `client.ts`. `socket.ts` holds the one shared Socket.IO connection; it
  connects cross-site straight to the backend and also sends the short-lived socket token, because
  Safari won't send the session cookie there (see `Backend/src/realtime/socketToken.ts`).
- **`hooks/`** — canvas behavior as testable hooks: `useMapData` (loading + realtime merge via
  `useMapSocket`), viewport/framing, drag and drop, marquee select, node creation, pack mode, line
  drawing, `useEdgeRedirect` (a branch's knob tapped opens the change-parent mode, `reparent` in `useCanvasMode`, or dragged onto the new parent, or onto its own parent to make the child the zone's head; the zones reshape; the knob shows once the 👻 on the node's panel hides the ghosts), presentation, undo of moves, position glide, `useWeaponReplay` (weapon marks in the
  time-lapse replay; `MapPage` loads `GET /api/:mapId/attacks` so the replay shows health as it was).
- **`map/`** — canvas components: `NodeCard` (drawn on the canvas through the memoized `CanvasNodeCard`, which takes one stable `actions` object from `hooks/useStableActions` so a drag or pan doesn't redraw every card), `StickerCard` (a node in the cards view, which draws no links and lays its cards close: `utils/cardPack.ts`, `hooks/useCardPacking.ts`), `ViewPrompt` (whole map, overview or cards, asked once the map has built itself up; the overview auto-packs parents, `utils/autoPack.ts`), `CanvasBackdrop` (zones, walls, realm
  border), `MiniMap`, `ViewCorner` (eye menu, zoom, minimap in the bottom-right corner),
  `QuickAddGhosts` (type and emoji rings), `NodePanel` + `nodePanel/` tabs (Info, Modify, Attack,
  Protect, Packed, History), `SiegePanel` (the imitated opponent's turn), `HistoryPanel` (the map's
  discussion history), `FinishedBanner`, `TimeLapseBar`, zone menus and style pickers.
- **`utils/`** — pure logic, each with a `*.test.ts` beside it: `zoneRules.ts` (where a new node
  may go: no node inside a zone it doesn't belong to, zones never cross, no wasted space; a node the
  user drags only keeps off other nodes, its `free` mode),
  `canvasLayout.ts`, `siege.ts` (opponent strategies and moves), `finish.ts` (mirrors the backend's
  `finishRule` so the Finish button can say why it waits; the server still decides), `nodeType.ts`
  (mirrors `allowedAttackTypes`), `seedMap.ts`/`templates.ts` (starter structures as ghosts, in the
  user's language), `shapeLayout.ts` (templates and the Think map laid out as a circle, square or triangle, shared with the preview), `textSplit.ts`, `cardGlue.ts` (cards glue side to side and never
  overlap), `parentMagnet.ts` (a moved parent pulls its own far children back in), `emojiFace.ts` (emoji first, each type's emoji, a still emoji).
- **`offline/`** — read cache of every GET plus an outbox of changes made offline, replayed in order
  once the server is back (temporary `local_…` ids swapped for real ones); `public/sw.js` caches the
  app shell.
- **`i18n/`** — English, Czech, Ukrainian, Russian. Every user-visible string goes through
  `translations.ts` / `uiStrings.ts` / `siegeStrings.ts` / `thinkStrings.ts` in all four languages;
  stored values (node types etc.) stay English.
- Per-browser view preferences (card fills, locked blocks, minimap) live in
  `localStorage`; anything that should follow the user across devices goes through `/api/state`
  (`context/UserStateContext.tsx`).

## Conventions

- Keep the frontend's mirrored rules (`utils/finish.ts`, `utils/nodeType.ts`) in step with the
  backend's (`finishAbl.ts`, `attackAbl.ts`) in the same change.
- Pull logic out of `MapPage.tsx` into a hook or a pure util with tests rather than growing it.
- When you add, rename or remove a route, ABL module, DAO or model, update
  [Backend/CLAUDE.md](Backend/CLAUDE.md); when you add or change a user-facing feature, update
  [Frontend/web/README.md](Frontend/web/README.md); update this file when the layout or the
  product's shape changes.

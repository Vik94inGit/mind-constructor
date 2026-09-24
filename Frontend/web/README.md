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
- **Dashboard** (`/`) — maps you own or were invited to; create/rename/delete, invite members, see
  who's on a map and who owns it, copy a whole map's nodes to paste into another one.
- **Map canvas** (`/maps/:mapId`) — the core of the app. Drag your own nodes, branch off a node
  with the quick-add ghosts or the toolbar, link nodes explicitly, draw separator lines, attack
  other members' nodes with the three combat weapons, shield your own, pack nodes into a
  container, group nodes into a chosen circle, choose a node (and optionally its whole branch) to
  link/copy/number/delete together, and switch how nodes read (icons only, icons + text, or a
  classical mind map) for the whole map or just the chosen nodes.
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
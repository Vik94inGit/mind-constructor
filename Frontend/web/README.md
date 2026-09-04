# Mind Constructor — Web

React + TypeScript + Vite frontend for the Mind Constructor API (see `../../Backend/docs/api-guide.html`).

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL if the backend isn't on localhost:3000
npm run dev
```

The backend must be running (`npm run dev` in `Backend/`) and reachable at `VITE_API_URL`.

## What's here

- **Auth** — register/login/logout, JWT stored in `localStorage`. There's no `/me` endpoint on the
  backend, so on login the app fetches `GET /api/auth/users` and matches its own id out of the list
  to learn its `role` (needed to show the Admin tab) — the only place `role` is exposed at all.
- **Dashboard** (`/`) — maps you own or were invited to, create/delete/invite.
- **Map canvas** (`/maps/:mapId`) — drag your own nodes, create nodes/edges, attack other members'
  nodes with the three combat weapons, see auto-detected clusters and attack indicators as overlays.
- **Admin** (`/admin`) — visible only if your user's `role` is `admin`. Block/unblock/delete users,
  wipe the database.

## Known API limitations reflected in the UI

- `Node.parentId` and the weapon node's `targetNodeId` are the *internal* Mongo `_id` of the
  referenced node, not its public `nodeId` — the docs call this out explicitly. Since node list
  responses only ever expose the public `nodeId`, the frontend can't resolve either reference, so
  the argument-tree (`parentId`) isn't drawn on the canvas and a weapon node's "points at" line only
  shows up when it happens to be resolvable. Explicit **Edges** don't have this problem (the edges
  endpoint populates both ends with public ids) and are what the canvas actually draws.
- This cuts both ways: it also breaks `parentId` on *creation*, not just reading. `createNodeAbl`
  passes `parentId` straight through to Mongoose with no public-id → internal-id lookup (unlike
  `createEdgeAbl`, which explicitly resolves both node ids first) — so sending any real node's
  public `nodeId` as `parentId` fails Mongoose's `ObjectId` cast server-side. `null` is the only
  value that ever succeeds. The "New node" form has no parent picker for exactly this reason; add
  one once the backend resolves public ids for `parentId` the way it already does for edges.
- Combat cooldowns are tracked per attacker+weapon, not per attacker+weapon+target — the UI mirrors
  that: attacking anyone with `counterpoint` starts one 5-minute cooldown for that weapon everywhere.

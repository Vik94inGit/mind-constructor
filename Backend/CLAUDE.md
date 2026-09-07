# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in **this** directory

> **Before doing any implementation or task, check the available Skills and use whichever ones
> are relevant.** Do this first, not as an afterthought.

## What this is

The backend for Mind Constructor, a collaborative argument/decision-mapping tool. Users build a
**map** of **nodes** (Problem / Problematic option / Solution / Option / Success / Fail / unknown)
connected by **edges** with a sentiment (positive/negative/neutral). Multiple invited members work
the same map live over Socket.IO. Layered on top of the mapping itself is a "combat" system:
members can attack each other's nodes with one of three weapons (nitpick/counterpoint/fatalFlaw,
each with its own damage and cooldown) to deplete the node's health; each landed attack spawns a
visible "weapon node" pointing at its target. The one node a weapon node's own target can attack
back is that weapon node itself (retaliation — see `attackAbl.ts`), which also heals the
retaliating node's parent. The backend also derives read-only insight from the graph: auto-detected
circles (`parentId` stars — see `circleAbl.ts`) and attack indicators.

Stack: Express 5 + TypeScript + MongoDB (Mongoose), plus a Socket.IO server (attached to the same
HTTP server) for live map updates. Full REST endpoint reference:
[docs/api-guide.html](docs/api-guide.html).

## Commands

```bash
npm run dev              # nodemon + tsx, runs server.ts on $PORT (default 3000)
npm run build             # tsc -> dist
npm test                  # vitest, watch mode
npm run test:run          # vitest, single run (use this one for CI-style checks)
npx vitest run tests/nodeAbl.test.ts        # single test file
npx vitest run -t "test name substring"     # single test by name
npm run admin:promote -- someone@example.com  # promote a user to admin (no in-app endpoint for this, by design)
```

Requires a `.env` with `PORT`, `MONGO_URI`, `JWT_SECRET`. `test-db.ts` is a standalone
connectivity check (`npx tsx test-db.ts`), not part of the test suite.

Tests mock the DAO layer with `vi.mock(...)` (see any file in `tests/`) rather than hitting a real
MongoDB, so `npm run test:run` doesn't need `MONGO_URI` to pass.

## Architecture

Strict layering, one direction only: **routes → controllers → abl → dao → models**.

- **`src/routes/*.ts`** (`authRoutes.ts`, `mapRoute.ts`, `nodeRoute.ts`, `edgeRoute.ts`) — wires
  URLs to controller functions, applies `protect` (and `requireAdmin` where needed) from
  `src/middleware/auth.ts`. No logic here. Mounted in [server.ts](server.ts) as `/api/auth`,
  `/api/nodes`, `/api/edges`, and `/api` (map routes — note the mount point itself has no `/maps`
  segment, so these resolve as `/api/{mapId}/{nodes,edges,circles/select,circles/deselect,
attack-indicators,summary}`, not `/api/maps/{mapId}/...`).
- **`src/controllers/*.ts`** — HTTP concerns only: pull `req.user`/`req.params`/`req.body`, call
  one ABL function, translate its return value and thrown error classes into a status code + JSON
  body, call `broadcastToMap` on success. Every handler is a `try/catch` that pattern-matches on
  specific error classes imported from the ABL module before falling back to a generic 500 —
  follow that pattern for any new endpoint rather than inventing a different error shape.
- **`src/abl/*.ts`** ("application business logic") — the actual domain logic: validation (via
  `zod` schemas + `parseOrThrow` from `abl/errors.ts`, which turns a failed `safeParse` into a
  `ValidationError`), authorization checks (map membership, node ownership), and orchestrating DAO
  calls. Each module defines its own domain-specific error classes (e.g. `MapNotFoundError`,
  `ParentNotOwnedError`, `WeaponOnCooldownError`) that the matching controller knows how to map to
  a status code. Modules: `authAbl`, `userAbl`, `mapAbl`, `nodeAbl`, `edgeAbl`, `attackAbl`,
  `attackIndicatorAbl`, `circleAbl`.
- **`src/dao/*.ts`** (`userDao`, `mapsDao`, `nodeDao`, `edgeDao`, `attackDao`) — the only layer
  that touches Mongoose models directly.
- **`src/models/*.ts`** (`User`, `Map`, `Node`, `Edge`, `Attack`) — schemas. Each one strips
  `_id`/`__v` in its `toJSON` transform and exposes only a public id instead (`nodeId`, `mapId`,
  `edgeId` — nanoids, not Mongo ObjectIds). **This public/internal id split is load-bearing
  everywhere**: DAOs take a public id in, resolve it to an internal `ObjectId` to query with;
  anything that forgets to resolve (`parentId` below is one worked example of the pattern) breaks
  silently or throws a Mongoose cast error.

Cross-cutting pieces:

- **`src/middleware/auth.ts`** — `protect` verifies the JWT, loads the user, rejects blocked users
  (checked per-request, not just at login), attaches `req.user`. `requireAdmin` must run after it.
- **`src/realtime/io.ts`** — Socket.IO server sharing the same HTTP server and the same JWT as the
  REST API. One room per map, keyed by the map's public id. `broadcastToMap(publicMapId, event,
payload)` is the one function controllers call after a mutation commits; it's a no-op if `io`
  was never initialized (true under the test app), so it's safe to call unconditionally.
- **`src/abl/errors.ts`** — shared `ValidationError` + `parseOrThrow`.
- **`src/abl/circleAbl.ts`** — a "circle" is a node with 2+ direct `parentId`-children (the
  parentId "star" a frontend draws as a plain translucent, sentiment-colored backdrop — positive-
  majority halo color vs. negative-majority horns color, no actual halo/horns/wings artwork).
  Circles are computed on the fly from current nodes' `parentId` on every request, never persisted.
  Selecting one (`POST /:mapId/circles/select`) locks its members (`Node.locked`) and unlocks every
  other node; a frontend's layout/physics loop is expected to drift every unlocked, group-member
  node and leave locked ones alone — once a circle is chosen there's nothing left to click out to,
  so its members hold their drifted position for good, not just until the next drag. A member
  leaves its circle by clearing its own `parentId` (`PATCH /api/nodes/:nodeId` with `parentId:
null`, e.g. a frontend's drag-node-out-of-the-backdrop gesture) — once a root has fewer than 2
  children left it simply stops being a circle. This replaced an earlier same-sentiment k-core
  "cluster" detector: this app's maps are normally trees radiating from a Problem/Option node, and
  a tree's k-core for any `minDegree >= 2` is always empty (a forest has no cycles), so that
  approach could never actually fire on a real map.
- **`src/models/Attack.ts`** (`WEAPONS`) — the weapon catalog (damage, cooldown). Damage is
  snapshotted onto each `Attack` document at attack time, so rebalancing a weapon later doesn't
  rewrite history. Cooldowns are per attacker+weapon (not per attacker+weapon+target) — landing a
  hit with one weapon starts a cooldown for that weapon globally, regardless of target.
- **`src/abl/attackAbl.ts`** retaliation — a weapon node is otherwise excluded from combat
  entirely (nothing can attack an attack), except the one node it actually targeted striking back
  at it: `attackNodeAbl` special-cases `node.isWeapon`, requiring the caller to own the node the
  weapon's own `targetNodeId` resolves to (`CannotRetaliateError` otherwise), bypassing the normal
  own-node/discussion-mode rule entirely for that one case. A landed retaliation also heals the
  *retaliating node's own parent* (`Node.parentId`, not the retaliating node itself) by a fixed
  `RETALIATION_HEAL_AMOUNT`, via the new `healNodeDao` — capped at 100, and never clears
  `defeated` on its own (nothing else in this app un-defeats a node either). The attack response/
  broadcast (`node:attacked`) carries this as `healedParent` (`null` on an ordinary, non-
  retaliation attack) alongside the existing `node`/`weaponNode`.
- **`scripts/promoteAdmin.ts`** — the only way to grant the `admin` role; deliberately not exposed
  as an API endpoint.

### `parentId` vs `Edge`

`Node.parentId` (the argument-tree link, separate from the `Edge` collection) is stored as an
internal Mongo `ObjectId` but arrives at both `createNodeAbl` and `updateNodeAbl` as a public
`nodeId` — both resolve it the same way `createEdgeAbl` resolves `fromNodeId`/`toNodeId` (same map,
owned by the caller) before handing it to Mongoose, and node list responses populate it back out to
`{ nodeId, text, type }`. A previous version of this doc noted `parentId` as effectively
write-only/broken; that's no longer true — `circleAbl.ts`'s whole feature depends on it working.
Explicit `Edge` documents remain a separate, parallel graph (what the frontend canvas actually
draws as links) — a node's `parentId` and its `Edge`s don't have to agree, and usually represent
different things (branch lineage vs. an argued-for/against relationship).

## Keeping this file current

This file should stay in sync with the actual routes/abl/dao/model layout — when you add, rename,
or remove a route, ABL module, DAO, or model, update the relevant bullet above in the same change.

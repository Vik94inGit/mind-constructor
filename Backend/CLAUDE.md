# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in **this** directory

> **Before doing any implementation or task, check the available Skills and use whichever ones
> are relevant.** Do this first, not as an afterthought.

## What this is

The backend for Mind Constructor, a collaborative argument/decision-mapping tool. Users build a
**map** of **nodes** (Problem / Problematic option / Solution / Option / Success / Fail / unknown)
connected by **edges** with a sentiment (positive/negative/neutral). Multiple invited members work
the same map live over Socket.IO. Layered on top of the mapping itself is a "combat" system:
members can attack *any* node on the map with one of three weapons (nitpick/counterpoint/
fatalFlaw, each with its own damage — cooldowns are defined on the weapon catalog but no longer
enforced) to deplete its health, and each landed attack spawns a visible "weapon node" pointing at
its target. Combat is fully open (see `attackAbl.ts`) — no own-node rule, no restriction on
attacking a weapon node, no already-defeated block, no cooldown enforcement; this used to be far
more restricted (an evolving history of an own-node-only rule, a `Map.discussionMode` per-map
toggle between that and normal player-vs-player, then a "retaliation"-only exception for weapon
nodes — all now removed). The one surviving piece of that history: landing a hit on a weapon node
still heals whatever that weapon node's own target's parent is, for whoever lands it. The one
remaining way to actually stop an attack: a **protection node**, created by a node's own owner
(`POST /api/nodes/:nodeId/protect`), fully blocks every attack on its linked target for as long as
it stays undefeated (see `attackAbl.ts`'s `protectNodeAbl`/`findActiveProtectorDao`). Nodes can also
be **packed** into a chosen container node (`packAbl.ts`) — folded off the canvas, reversible via
unpack — and given one of three visual size tiers, which a container auto-bumps out of once
something is first packed into it. The backend also derives read-only insight from the graph:
auto-detected circles (`parentId` stars — see `circleAbl.ts`) and attack indicators.

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

Requires a `.env` with `PORT`, `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID` (the OAuth client id
"Sign in with Google" ID tokens are verified against — see `authAbl.ts`'s `googleAuthAbl`).
`test-db.ts` is a standalone connectivity check (`npx tsx test-db.ts`), not part of the test suite.

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
  `attackIndicatorAbl`, `circleAbl`, `packAbl`.
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
- **`src/abl/authAbl.ts`** `googleAuthAbl` — "Sign in with Google" is one endpoint
  (`POST /api/auth/google`) for both registering and logging in: the frontend hands it a Google ID
  token (never a password), the backend verifies it against `GOOGLE_CLIENT_ID` via
  `google-auth-library`, then resolves an account by the token's `sub` claim (`User.googleId`) —
  falling back to matching by email (linking Google onto an existing password account) before
  creating a brand-new one with a username derived from the email's local part. `User.passwordHash`
  is therefore optional: a Google-only account never gets one, and `loginAbl` treats that the same
  as a wrong password rather than a distinct error, so a probing login can't tell which case it hit.
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
- **`Node.manualZone`** — a manually-placed zone ring around exactly one node, independent of
  `circleAbl.ts`'s automatic detection above (no 2+-children requirement, and the color — positive/
  negative, `MANUAL_ZONE_COLORS` — is chosen outright rather than computed by majority vote). Plain
  `PATCH /api/nodes/:nodeId`, owner-only, same gating as `symbolOverride`; `null` removes it. If a
  node happens to have both an automatic circle *and* a manual zone at once, a frontend draws both —
  they're independent layers, not mutually exclusive.
- **`src/models/Attack.ts`** (`WEAPONS`) — the weapon catalog (damage, cooldown). Damage is
  snapshotted onto each `Attack` document at attack time, so rebalancing a weapon later doesn't
  rewrite history. Cooldowns are per attacker+weapon (not per attacker+weapon+target) — landing a
  hit with one weapon starts a cooldown for that weapon globally, regardless of target.
- **`src/abl/attackAbl.ts`** — combat is fully open: `attackNodeAbl` no longer checks node ownership
  (any map member can attack any node, including their own), whether the target is a weapon node,
  whether it's already defeated, or any weapon cooldown — only map membership is still checked.
  `CannotAttackOwnNodeError`, `CanOnlyAttackOwnNodeError`, `CannotRetaliateError`,
  `NodeAlreadyDefeatedError`, and `WeaponOnCooldownError` are all dead (never thrown), kept exported
  only because `nodeController.ts` still pattern-matches on them defensively — `Map.discussionMode`
  is likewise an inert, unused field now. The one mechanic that survives from the old
  ownership-gated "retaliation" concept: landing a hit on a weapon node still heals *that weapon
  node's own target's parent* (`Node.parentId`, not the weapon node or its target itself) by a fixed
  `RETALIATION_HEAL_AMOUNT`, via `healNodeDao` — capped at 100, and never clears `defeated` on its
  own (nothing else in this app un-defeats a node either) — now unconditional, for whoever lands the
  hit, not just the original victim. The attack response/broadcast (`node:attacked`) carries this as
  `healedParent` (`null` when the target wasn't a weapon node, or was one with nothing to heal)
  alongside the existing `node`/`weaponNode`. `attackNodeAbl` also checks
  `findActiveProtectorDao(node._id)` right before computing damage — if any undefeated protection
  node points at the target (`Node.isProtection` + `protectsNodeId`), the hit is blocked entirely:
  0 damage to the target, but the damage isn't erased — it's banked on the protector itself
  (`Node.blockedDamage`, via `incrementBlockedDamageDao`) instead. A shield defers a hit, it doesn't
  cancel it: deleting a protection node releases its whole running `blockedDamage` total onto
  whatever it was defending in one lump sum (`deleteNodeDao`'s own extra step, returning
  `{ node, damagedProtectedNode }` instead of just `node` — `damagedProtectedNode` is `null` unless
  that release actually happened) — "the protected node has its own damage back," per the feature's
  own ask. `deleteNode`'s controller broadcasts a `node:updated` for `damagedProtectedNode` alongside
  the usual `node:deleted`, unlike this same cascade's other, silent side effects (edge/parentId/
  weapon cleanup), specifically because a live health change is worth surfacing immediately rather
  than waiting for next reload. The attack response/broadcast (`node:attacked`) carries `blocked:
  true` and the protector's own updated document (as `protector`, its `blockedDamage` bumped) when
  blocked; the attacker's objection is still recorded as a real weapon node and in `logAttackDao`'s
  history either way. Protection nodes themselves are created by `protectNodeAbl`
  (`POST /:nodeId/protect`, `attackAbl.ts`) — same "real, typed content Node" shape as a weapon node
  (`createProtectionNodeMutationDao` mirrors `createWeaponNodeMutationDao`), but owner-of-the-target
  only (`NotNodeOwnerError`), not open like combat — a shield has a map-wide, no-cost, no-cooldown
  effect on everyone else's future attacks, so it's gated like editing the node's own text/type
  rather than left open. Creating one also immediately heals the node it defends by a fixed
  `PROTECT_CREATE_HEAL_AMOUNT` (via `healNodeDao`, capped at 100, returned/broadcast as
  `healedNode`) — on top of, not instead of, the ongoing block-and-bank-damage behavior above; adding
  a shield is both an immediate show of support and a standing defense. A frontend positions a protection node differently depending on whether the
  target currently has an active attacker (the most recent weapon node aimed at it): with one, the
  shield sits literally on that attack's own flight path, at the attacker-target midpoint (not nudged
  clear of either, unlike every other placement in `MapPage.tsx`'s `positions` memo — that midpoint
  is always within both nodes' own minimum-spacing zone, so the usual overlap-avoidance would just
  walk it back off the path), and that attack's arrows stop there instead of reaching the target; with
  none, it's placed like any other companion node. Either way it's rendered through the same `NodeCard`
  every node uses, distinguished only by its own small 🛡️ badge — no separate directional
  bow-and-emblem overlay any more, that read as redundant clutter once the node itself already sits on
  the arrow path.
- **`src/abl/packAbl.ts`** — folds one or more nodes into a chosen container node
  (`POST /:nodeId/pack`, body `{ nodeIds }`) so they stop rendering on the canvas
  (`Node.packedIntoNodeId`), reversible per member (`POST /:memberId/unpack`). A different
  relationship from a circle on purpose: eligible pack candidates are the union of the container's
  branch neighbors (`parentId` children + its own parent) *and* every node on either end of an
  `Edge` touching it — recomputed server-side on every call rather than trusting the client's picks,
  same "don't trust a stale snapshot" principle `selectCircleAbl` already applies to circle
  membership. Container-owner-only (`PackNotOwnedError`), same reasoning as protection's
  owner-gating above. The first time a container is ever packed, and only while its `Node.sizeTier`
  has never been touched (`null` — see below), `packNodesAbl` bumps it to tier 2 via the atomic
  `bumpSizeTierIfDefaultDao` (guarded by a `sizeTier: null` filter so a concurrent manual PATCH can't
  be clobbered). Deleting a container unpacks its members (`deleteNodeDao`'s cascade) rather than
  leaving them permanently hidden.
- **`Node.sizeTier`** (`1 | 2 | 3`, `models/Node.ts`) — three visual size tiers a frontend renders
  at 100%/115%/130%. `null` (not `1`) means "never touched, by anyone or anything" — that's the one
  state `packAbl.ts`'s auto-bump above will ever act on; once set, by the auto-bump or a plain
  `PATCH /api/nodes/:nodeId`, packing never silently changes it again. A frontend's "reset to 100%"
  control is expected to PATCH an explicit `1`, not `null`, so resetting doesn't quietly re-arm the
  auto-bump.
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

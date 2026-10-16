# Mind Constructor

Notes you can see. Jot a thought down in a second (a quick note lands in your Inbox map), then lay
your thoughts out on a canvas as **nodes**: a problem, the options around it, what worked and what
didn't. A node's place, its zone and its links show how the thoughts relate, so a map reads at a
glance instead of as a long list. Starter structures (analyze a problem, plan a goal, weigh a
decision, look back) arrive as faded **ghost** nodes carrying only a question, and fill in as you
answer them. Search finds any thought across all your maps.

Maps can also be shared and worked on live with other people, and a map in discussion mode adds a
challenge layer (attacking a node with an objection, shielding it, an imitated opponent's turn).
See [Backend/CLAUDE.md](Backend/CLAUDE.md) for the full feature rundown and architecture.

## Repo layout

This is one git repository, not one per folder:

- **`Backend/`** — Express 5 + TypeScript + MongoDB (Mongoose) API, plus the Socket.IO server for
  live updates. Its own [CLAUDE.md](Backend/CLAUDE.md) covers the domain model and architecture in
  depth; [`docs/api-guide.html`](Backend/docs/api-guide.html) is the REST endpoint reference.
- **`Frontend/web/`** — the real frontend: React + TypeScript + Vite, the map canvas
  (`MapPage.tsx`), node cards, minimap, and so on. See its own [README](Frontend/web/README.md).

## Quick start

Requires Node.js and a MongoDB instance (Atlas or local).

```bash
# Backend
cd Backend
npm install
cp .env.example .env   # fill in MONGO_URI, SESSION_SECRET, GOOGLE_CLIENT_ID (see below)
npm run dev             # http://localhost:3000

# Frontend, in a second terminal
cd Frontend/web
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:3000, fine for local dev
npm run dev             # http://localhost:5173
```

Password register/login works without any real Google OAuth setup, so local browser testing
doesn't need `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` filled in — only "Sign in with Google"
does. The "Try it without an account" demo button works with nothing configured either way.

## Environment variables

See [`Backend/.env.example`](Backend/.env.example) and
[`Frontend/web/.env.example`](Frontend/web/.env.example) for the full list with explanations
(`MONGO_URI`, `SESSION_SECRET`, `REDIS_URL`, `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID`, `CORS_ORIGIN`,
`VITE_API_URL`). Never commit a real `.env`.

## Testing

```bash
cd Backend
npm run test:run   # vitest, single run — mocks the DAO layer, doesn't need MONGO_URI

cd Frontend/web
npm run lint        # tsc --noEmit
npm test            # vitest, single run
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same checks, plus a
frontend build, on every push to `main` and every pull request.

## Admin access

There's no in-app way to grant the `admin` role, by design:

```bash
cd Backend
npm run admin:promote -- someone@example.com
```

## Deploying

- **Backend**: [`render.yaml`](render.yaml) is a Render Blueprint — point Render at this repo and
  it picks it up, prompting for `MONGO_URI`/`JWT_SECRET`/`CORS_ORIGIN`/`GOOGLE_CLIENT_ID` in its
  dashboard rather than expecting them in the file.
- **Frontend**: [`Frontend/web/vercel.json`](Frontend/web/vercel.json) is a plain SPA rewrite
  config for Vercel (or any static host that needs one) — set `VITE_API_URL` to the deployed
  backend's origin and `CORS_ORIGIN` on the backend to the deployed frontend's origin.

# VibeOCPP

Own CSMS (Charging Station Management System) backend and operator frontend
built as a BFF/integration layer in front of [CitrineOS](https://citrineos.org)
(Apache 2.0). CitrineOS runs unmodified as its own Docker Compose stack —
this repo never forks or patches it and reaches it only through its public
REST APIs and subscription/webhook mechanism.

See [docs/architecture-proposal.md](docs/architecture-proposal.md) for the
full architecture (service topology, data ownership, settings/secrets
layer, role model, and the incremental build plan).

## Layout

```
backend/    NestJS BFF — auth, RBAC, encrypted settings store, audit log
            (this is the only implemented package so far)
frontend/   React operator UI (not yet implemented)
ops-agent/  Whitelisted container-ops microservice (not yet implemented)
hasura/     Metadata for our own read-only Hasura mirror (not yet implemented)
docs/       Architecture proposal and other design docs
```

## Running

Requires Node 22, pnpm (`corepack enable` picks up the pinned version), and
either Docker or a local Postgres.

**Docker Compose (backend + its own database):**

```sh
cp .env.example .env   # fill in real secrets — see comments in the file
docker compose up --build
curl http://localhost:3000/health
```

**Local development, without Docker:**

```sh
pnpm install
cd backend
cp .env.example .env   # point DATABASE_URL at a local Postgres
pnpm db:migrate
SEED_SUPERADMIN_PASSWORD='...' pnpm db:seed   # creates the first SuperAdmin login
pnpm start:dev
```

## Testing

```sh
cd backend
pnpm test       # unit tests (mocked dependencies)
pnpm test:e2e   # exercises real HTTP + a real Postgres database
```

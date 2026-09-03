# Own Hasura instance

A **separate** Hasura instance from CitrineOS's own (the one its
`apps/operator-ui` uses) — same underlying CitrineOS-core Postgres database,
our own metadata below, never touching the citrineos-core repo or its
compose file. See `docs/architecture-proposal.md` §9 for why: the frontend
reads live/list CitrineOS data directly from this instance over GraphQL
(subscriptions included) using the same JWT the backend issues, while every
write still goes through the BFF's REST endpoints. `metadata/` defines
**no insert/update/delete permissions anywhere** — this instance is
read-only by construction, not just by convention.

## What's exposed

Fifteen CitrineOS-core tables, picked to cover the frontend views described
in the architecture proposal (station map/list, transactions, meter values,
status, boot/certificate/variable diagnostics): `ChargingStations`,
`Locations`, `Evses`, `Connectors`, `Transactions`, `TransactionEvents`,
`StartTransactions`, `StopTransactions`, `MeterValues`,
`StatusNotifications`, `LatestStatusNotifications`, `Boots`, `Certificates`,
`VariableAttributes`, `Reservations`.

Table, column, and relationship names are transcribed from CitrineOS-core's
own metadata (`apps/ocpp-server/hasura-metadata` in `citrineos-core`) — not
reinvented. `Certificates` and `VariableAttributes` are restricted to
`superadmin`/`csms_admin` (closer to "configuration" than day-to-day
operation, per the role table); the rest are readable by all three roles.

## Roles

| Our `Role` enum | Hasura role | Why not a straight `toLowerCase()` |
|---|---|---|
| `SuperAdmin` | `superadmin` | — |
| `Admin` | `csms_admin` | **`admin` is a Hasura-reserved role name** — the backend used a bare `role.toLowerCase()` originally, and defining `select_permissions` for a role literally named `admin` was caught as inconsistent metadata by actually running it against a real Hasura container before this shipped (see "Verified" below). `backend/src/auth/auth.types.ts`'s `toHasuraRole()` is the one place this mapping lives now. |
| `Mitarbeiter` | `mitarbeiter` | — |
| `Driver` | `driver` | Unused in Phase 1, mapped for consistency. |

The backend embeds these under the `https://hasura.io/jwt/claims` claim
(Hasura's default JWT claim namespace) in every access token it issues —
see `AuthService.issueTokenPair`. `HASURA_GRAPHQL_JWT_SECRET` in
`docker-compose.yml` is built from the same `JWT_ACCESS_SECRET`, so the
token the backend hands the frontend at login also authenticates GraphQL
requests, with no second login step.

## Single-tenant simplification

Every table's `select_permissions` filters on `tenantId: {_eq: 1}` — a
**literal**, not a session variable. Phase 1 assumes a single CitrineOS
tenant, matching the default at `settings/citrineos/citrineosTenantId`. If
that setting is ever changed from its default, update the filter in every
file under `metadata/databases/default/tables/` to match. Making this
dynamic (a per-request session variable instead) is real work for whenever
multi-tenancy actually ships — see `docs/architecture-proposal.md` §3 — not
attempted here.

## How the metadata gets applied

`docker-compose.yml`'s `hasura` service uses the
`hasura/graphql-engine:v2.40.3.cli-migrations-v3` image tag (the same
version CitrineOS-core itself pins) with `./hasura/metadata` mounted at
`/hasura-metadata`. That specific `.cli-migrations-v3` variant is what
auto-applies a mounted metadata directory on container start — a plain
`hasura/graphql-engine` image does not do this on its own.

## Verified

Not just YAML-valid — actually run: a real `hasura/graphql-engine:v2.40.3.cli-migrations-v3`
container, pointed at a throwaway Postgres database with the 15 tables
above (minimal columns/FKs, not full CitrineOS fidelity), with this exact
`metadata/` mounted. This caught two real bugs before they shipped:

1. `role: admin` in every table's `select_permissions` — Hasura rejected it
   as inconsistent metadata ("cannot define permission for admin role").
   Fixed by renaming to `csms_admin` here and adding `toHasuraRole()` in
   the backend so `Role.Admin` never becomes bare `admin`.
2. `VariableAttributes`' `Component` relationship, declared via
   `foreign_key_constraint_on: componentId` — inconsistent because the
   constrained column had no actual FK in the throwaway schema. Removed:
   we don't expose a `Components` table in this reduced mirror, so the
   relationship added risk for a view nothing currently uses.

After both fixes: `get_inconsistent_metadata` reported
`is_consistent: true`, and a JWT shaped exactly like `AuthService`'s output
(same `https://hasura.io/jwt/claims` structure, same role mapping)
successfully queried `ChargingStations` as `csms_admin` and was correctly
denied `Certificates` as `mitarbeiter` (the field doesn't even appear in
that role's schema) while still reading `ChargingStations`.

Not verified: against a real CitrineOS-core database (only a schema stub —
see `docs/architecture-proposal.md` §0 for why no live CitrineOS instance
is reachable from this sandbox) — check `get_inconsistent_metadata` again
after pointing `HASURA_GRAPHQL_DATABASE_URL` at a real one, before relying
on this in production.

## Running

```sh
# in the repo root .env:
CITRINEOS_DATABASE_URL=postgres://citrine:citrine@your-citrineos-host:5432/citrine
HASURA_GRAPHQL_ADMIN_SECRET=... # openssl rand -hex 32
# JWT_ACCESS_SECRET is already required for the backend service — reused here.

docker compose --profile hasura up --build
```

Console at `http://localhost:8091` (or `$HASURA_PORT`), protected by
`HASURA_GRAPHQL_ADMIN_SECRET`. GraphQL endpoint at `/v1/graphql`.

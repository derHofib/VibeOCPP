# frontend

Operator UI for VibeOCPP — React + TypeScript + Vite, Tailwind v4 with an
own design-token set (not the default shadcn look — see
`src/styles/tokens.css`), TanStack Query for server state, react-i18next
(German default, English available), class-based dark mode with a
light/dark/system toggle. See `docs/architecture-proposal.md` §9/§11 for
the full frontend architecture and build plan.

## What's here

- **Auth**: `src/auth/auth-context.tsx` — login/refresh/logout against the
  backend's `/auth/*` endpoints, access token held in memory, refresh token
  in `localStorage`, silent session resume on reload, single in-flight
  refresh shared across concurrent 401s.
- **RBAC-gated routing**: `src/components/auth/protected-route.tsx` +
  `src/lib/roles.ts` (mirrors `backend/src/common/roles.enum.ts`) — hides
  nav items and redirects away from routes the current role can't reach.
  UI convenience only: every privileged action is re-checked server-side by
  the BFF's own guards regardless, per `docs/architecture-proposal.md` §6.
- **i18n**: `src/i18n/` — react-i18next with `de`/`en` namespaced resources,
  browser-language auto-detection persisted to `localStorage`.
- **Theming**: `src/theme/theme-context.tsx` — `data-theme` attribute
  toggle, `system` falls through to `prefers-color-scheme`.
- **UI primitives**: `src/components/ui/` — hand-written Button/Input/
  Label/Card/StatusBadge on the design tokens (own CVA-based variants, not
  shadcn's generated components) — `StatusBadge` pairs color with an icon
  so status is never conveyed by color alone (WCAG SC 1.4.1).
- **Shell**: `src/components/layout/app-shell.tsx` — sidebar nav (role-
  filtered) + topbar (language/theme toggles, user email, logout).
- **Domain views** (`src/pages/`, `src/api/`), all against the real backend
  REST endpoints via TanStack Query:
  - **Users** (`users-page.tsx`) — list, create (role choices limited to
    what the current actor may create, mirroring the backend's own rule),
    activate/deactivate.
  - **Settings** (`settings-page.tsx`) — categories rendered as tabs from
    whatever `GET /settings` actually returns (not a hardcoded list — only
    `citrineos` and `payment` exist server-side so far), add/edit a key,
    secret values shown masked. Rollback-to-a-prior-version is **not**
    built: the backend has no endpoint to list a setting's history, only
    `POST /settings/rollback/:id` taking a version number on faith — a gap
    worth closing before this ships.
  - **Testsuite** (`testsuite-page.tsx`) — start a run, list runs, and a
    step-by-step detail view that polls while a run is `running` (it
    executes in the background on the server).
  - **Live Monitor** (`monitor-page.tsx`) — filterable OCPP message list,
    polls every 5s, CSV export (fetched through the authenticated client
    and handed to the browser as a Blob, since a plain `<a href>` can't
    carry the bearer token).
  - **Infrastructure** (`ops-page.tsx`) — one card per whitelisted service
    (status, logs on demand, restart), polling status every 15s.
  - **Stations** (`stations-page.tsx`) — the first view on the live-read
    path (`docs/architecture-proposal.md` §9/§10 decision A): reads
    directly from our own read-only Hasura mirror over a GraphQL
    subscription, not from the backend. List only so far (no map, no
    filters — see `docs/stations-feature-plan.md` for the rest). Shows a
    connection indicator (connecting/live/disconnected) per the
    no-polling requirement.
  - **Transactions** is still a `PlaceholderPage` stub — needs the same
    GraphQL wiring `stations-page.tsx` now provides, just not written yet.

New UI primitives added alongside these: `Table`, `Select`, `Textarea`, and
`Dialog` (wraps the native `<dialog>` element for its built-in focus trap
and Escape-to-close rather than hand-rolling either).

## GraphQL (Hasura live-read path)

`src/lib/graphql-client.ts` + `src/lib/use-graphql-subscription.ts`:

- `graphqlRequest()` — one-off queries via `graphql-request`, bearer token
  attached the same way `lib/api-client.ts` does for REST.
- `subscribe()` / `useGraphqlSubscription()` — live subscriptions via
  `graphql-ws`. The websocket auth handshake follows Hasura's own
  convention (`connectionParams: { headers: { Authorization: ... } }`),
  not a `graphql-ws` default — verified against a real Hasura container,
  see "Verified" below.
- Both share the same access-token source as the REST client
  (`AuthProvider` calls `configureGraphqlClient` alongside
  `configureApiClient`) — one login, one token, two transports.
- Reached at `/hasura/v1/graphql` (`vite.config.ts` proxies it to our own
  Hasura instance, `ws: true` so the subscription upgrade forwards too),
  configurable via `VITE_HASURA_URL` for production.

## Running

```sh
pnpm install
cd frontend
pnpm dev
# proxies /api/* to the backend on :3000 — see vite.config.ts
```

Requires a running backend (`cd ../backend && pnpm start:dev`) with at
least one seeded user (`pnpm db:seed`, see the root README) to log in.

## Testing

```sh
pnpm test            # vitest + Testing Library, jsdom
pnpm typecheck:test   # type-checks src/**/*.spec.{ts,tsx} (excluded from the app build)
pnpm build            # tsc -b (app source only) && vite build
pnpm lint
```

## Verified

Unit-tested (47 tests, all green): `cn` class merging, JWT decode/expiry,
role-rank comparison, settings grouped-by-category logic, the full
`AuthProvider` login/refresh/logout/session-resume flow (mocked `fetch`),
`ProtectedRoute` redirect and role-gating, `ThemeProvider`
persistence/`data-theme` toggling, the Users/Ops pages (list render, empty
state, create/restart/view-logs actions) against a mocked API, the GraphQL
client (auth header attachment, Hasura's connectionParams shape, one
shared websocket client across subscriptions) and `useGraphqlSubscription`
(connecting → connected/disconnected transitions, unsubscribe on unmount,
re-subscribe on query/variable change) against a mocked `graphql-ws`.
`pnpm build`, `pnpm typecheck:test`, and `pnpm lint` all clean.

The GraphQL/Hasura path specifically was also verified against a **real**
`hasura/graphql-engine:v2.40.3.cli-migrations-v3` container (no live
CitrineOS in this environment, so a throwaway Postgres stub with the exact
`ChargingStations`/`Locations`/`Evses`/`Connectors` schema and
relationships from our own `hasura/metadata`, seeded with one station):
a JWT shaped exactly like `AuthService`'s output authenticated both a
plain HTTP query and a `graphql-ws` subscription using the project's own
`STATIONS_LIST_SUBSCRIPTION` string and the exact `graphql-ws`/
`graphql-request` versions pinned in `package.json`; updating the
connector's `status` column directly in Postgres pushed a live update
through the open subscription with no re-query, matching the "no
polling" requirement. Then re-verified through the actual rendered
`StationsPage` in a real browser (Chromium via Playwright) against that
same Hasura container — the status badge changed live, with no page
reload, confirming the whole path end to end rather than just the client
library in isolation.

Also verified end-to-end in a real browser (Chromium via Playwright)
against a real running backend + local Postgres, not just unit-tested:

- Auth/RBAC (foundation increment): logged in as a seeded SuperAdmin and a
  seeded Mitarbeiter, confirmed the sidebar shows only the nav items each
  role is allowed, confirmed a Mitarbeiter navigating directly to
  `/settings` is redirected to `/`, checked dark mode and the DE/EN toggle.
- Domain views: created a real user through the Users dialog and watched
  the list refresh; viewed a real (pre-existing) settings category with a
  masked secret value; started a real testsuite run against a
  (deliberately unconfigured) station and watched the step table update
  live via polling, including the plain-text error each step failed with
  ("CitrineOS connection is not configured yet…") — confirming the
  architecture's plain-text-error requirement actually reaches the UI end
  to end, not just the API response; opened Settings/Testsuite/Monitor/Ops
  with no data yet and confirmed each shows its proper empty state rather
  than a blank screen; confirmed the Infrastructure page shows a clear
  error state (rather than crashing) when the ops-agent isn't reachable —
  expected here since this sandbox has no Docker daemon for it to run
  against, but worth re-checking with a live ops-agent before relying on
  it.

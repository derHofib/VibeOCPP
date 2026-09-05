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
  - **Stations** and **Transactions** are still `PlaceholderPage` stubs —
    see "Not done yet" below.

New UI primitives added alongside these: `Table`, `Select`, `Textarea`, and
`Dialog` (wraps the native `<dialog>` element for its built-in focus trap
and Escape-to-close rather than hand-rolling either).

## Not done yet

**Stations and Transactions** need the live-read path decided in
`docs/architecture-proposal.md` §9/§10 (decision A: read directly from our
own read-only Hasura mirror via GraphQL/subscriptions) — that client isn't
wired up yet, so these two nav items stay placeholders rather than shipping
GraphQL queries nobody has been able to run against real CitrineOS data in
this environment.

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

Unit-tested (32 tests, all green): `cn` class merging, JWT decode/expiry,
role-rank comparison, settings grouped-by-category logic, the full
`AuthProvider` login/refresh/logout/session-resume flow (mocked `fetch`),
`ProtectedRoute` redirect and role-gating, `ThemeProvider`
persistence/`data-theme` toggling, and the Users/Ops pages (list render,
empty state, create/restart/view-logs actions) against a mocked API.
`pnpm build`, `pnpm typecheck:test`, and `pnpm lint` all clean.

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

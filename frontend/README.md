# frontend

Operator UI for VibeOCPP — React + TypeScript + Vite, Tailwind v4 with an
own design-token set (not the default shadcn look — see
`src/styles/tokens.css`), TanStack Query for server state, react-i18next
(German default, English available), class-based dark mode with a
light/dark/system toggle. See `docs/architecture-proposal.md` §9/§11 for
the full frontend architecture and build plan.

## What's here (foundation increment)

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

Domain views (stations, transactions, testsuite, live monitor, settings,
users, ops) are `PlaceholderPage` stubs for now — routing/guards/nav are
wired end to end so later increments only need to fill in a component.

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

Unit-tested: `cn` class merging, JWT decode/expiry, role-rank comparison,
the full `AuthProvider` login/refresh/logout/session-resume flow (mocked
`fetch`), `ProtectedRoute` redirect and role-gating, `ThemeProvider`
persistence/`data-theme` toggling — 24 tests, all green; `pnpm build`,
`pnpm typecheck:test`, and `pnpm lint` all clean.

Also verified end-to-end in a real browser (Chromium via Playwright)
against a real running backend + local Postgres, not just unit-tested:
logged in as a seeded SuperAdmin and as a seeded Mitarbeiter, confirmed the
sidebar shows only the nav items each role is allowed (Benutzer/
Einstellungen/Infrastruktur hidden for Mitarbeiter), confirmed a
Mitarbeiter navigating directly to `/settings` is redirected to `/`, and
checked dark mode + the German/English toggle render correctly in both
languages and both themes.

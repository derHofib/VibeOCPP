# ops-agent

A minimal, separately-deployed microservice that holds the *only* Docker
socket access anywhere in this stack. `backend` — the thing actually exposed
to operators and reachable from the internet — never gets it. Per the
original requirement in `docs/architecture-proposal.md` §6/§7
("Sicher implementieren: keine beliebige Shell-Ausführung, nur eine fest
definierte Whitelist von Aktionen" — no arbitrary shell execution, only a
fixed whitelist of actions), this service exposes exactly three operations
against exactly five known service names, and nothing else:

- `GET /ops/status` — status of every whitelisted service
- `GET /ops/status/:service` — status of one
- `GET /ops/logs/:service` — tail of that container's logs
- `POST /ops/restart/:service` — restart that container

There is no generic exec/shell/command endpoint, and none of the four routes
above accept anything that reaches a shell: `:service` is checked against
`src/whitelist.ts`'s fixed `ALLOWED_SERVICES` list *before* any dockerode
call is made — an unknown name is rejected with 400 and never touches
dockerode. Containers are looked up by their `com.docker.compose.service`
label (`docker-client.ts`), not by string-templating a container name, so
there's no path from a service name to a shell command anywhere in this
service.

## Why a separate service at all

The alternative — giving `backend` itself Docker socket access — was
explicitly rejected: `backend` is the thing every role logs into, runs
third-party-influenced logic (CitrineOS responses, Stripe webhooks), and has
the largest attack surface in the stack. Docker socket access is
effectively root on the host. Isolating it here means a `backend`
compromise doesn't automatically mean a host compromise; the worst an
attacker who fully controls `backend` can do to this service is what the
five-action whitelist itself allows over an authenticated HTTP call — the
same as what a SuperAdmin can already do through the UI.

## Auth

Not exposed on any public port in `docker-compose.yml` — reachable only
from `backend` over the internal Compose network. Still authenticates every
request via a constant-time comparison (`src/auth.ts`) against
`OPS_AGENT_SHARED_SECRET`, a bootstrap `.env` value shared with `backend`
(see the "why this isn't a `settings` row" note in
`backend/src/config/env.validation.ts` — this service has no database
access at all, so there's nowhere else the secret could live). This is
belt-and-suspenders: a compromised or misconfigured neighbour container on
the same Docker network still can't call it for free.

## Backend integration

`backend/src/ops/` (`OpsController` + `OpsAgentClient`) is the only caller.
SuperAdmin-only (`@Roles(Role.SuperAdmin)`, same as the other
infrastructure-adjacent config areas), and `restart` is `@Audited()` —
logged with who/when/which service, per the audit-log requirement in
`docs/architecture-proposal.md` §6. `status`/`logs` are read-only and not
audited, same treatment as the CitrineOS `health` check.

## Verified

Unit-tested with real logic, mocked `dockerode` (no live Docker daemon in
this sandbox — see `docs/architecture-proposal.md` §0): `whitelist.spec.ts`
covers rejection of unknown names and shell-metacharacter/path-traversal
attempts; `auth.spec.ts` covers the constant-time secret check including
duplicate headers and length mismatches; `docker-client.spec.ts` covers the
label-based lookup, the "found: false" vs `ContainerNotFoundError` split,
and the raw Docker log-stream demuxing (`demuxDockerLogBuffer`) against
hand-built multiplexed frames. `pnpm build` (plain `tsc`) and `pnpm lint`
both pass. The backend-side `OpsAgentClient` is separately unit-tested
against a mocked `fetch`.

Not verified: against a real Docker daemon/`dockerode` at runtime, or the
actual `docker-compose.yml` wiring (`com.docker.compose.service` labels,
network reachability from `backend`, the read-only `docker.sock` mount) —
this sandbox has no functioning Docker daemon (see
`docs/architecture-proposal.md` §0). Check `docker compose --profile
<whatever> up` end-to-end, including an actual `POST /ops/restart/backend`
round-trip, before relying on this in production.

## Running

```sh
# repo root .env:
OPS_AGENT_SHARED_SECRET=...   # openssl rand -hex 32 — shared with backend

docker compose up   # ops-agent is not behind a profile — it always starts
```

Not reachable from outside the Compose network by design — there is no
`ports:` mapping for it in `docker-compose.yml`. Call it through
`backend`'s `/ops/*` endpoints (SuperAdmin JWT required) instead of directly.

```sh
cd ops-agent
pnpm test    # unit tests, mocked dockerode
pnpm build   # tsc
```

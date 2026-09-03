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
backend/    NestJS BFF — auth, RBAC, encrypted settings store, audit log,
            CitrineOS Data/Message API clients + webhook receiver,
            OCPP testsuite + Live-Message-Monitor, payment/tariff
            master-data management against citrineos-payment's own DB
            (this is the only implemented package so far)
frontend/   React operator UI (not yet implemented)
ops-agent/  Whitelisted container-ops microservice (not yet implemented)
hasura/     Metadata for our own read-only Hasura mirror of CitrineOS-core
            data — see hasura/README.md
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

Before any `/citrineos/*` endpoint works, configure the connection as SuperAdmin
(there is no UI yet — use the settings API directly):

```sh
TOKEN=$(curl -s -X POST localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' | jq -r .accessToken)

for kv in dataApiUrl:string:http://localhost:8080 \
          messageApiUrl:string:http://localhost:8080 \
          citrineosTenantId:string:1 \
          ocppVersion:string:2 \
          webhookBaseUrl:string:https://your-public-url \
          webhookSecret:secret:$(openssl rand -hex 24); do
  key="${kv%%:*}"; rest="${kv#*:}"; type="${rest%%:*}"; value="${rest#*:}"
  curl -s -X POST "localhost:3000/settings/citrineos/$key" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"type\":\"$type\",\"value\":\"$value\"}"
done
```

Once configured, run the testsuite against a connected station:

```sh
curl -s -X POST localhost:3000/testsuite/runs \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ocppConnectionName":"<station id>","ocppVersion":"2","manufacturer":"Bender","model":"CC612"}'
# poll GET /testsuite/runs/<id> for live step results
```

Similarly, before any `/payment/*` endpoint works, point it at the
Postgres database your citrineos-payment container uses (not this
project's own product-db — see docs/architecture-proposal.md §4):

```sh
curl -s -X POST localhost:3000/settings/payment/databaseUrl \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"secret","value":"postgresql://user:pass@host:5432/citrine"}'
```

To also run citrineos-payment + Directus themselves (Scan&Charge needs
both — see the comments in docker-compose.yml):

```sh
git clone https://github.com/citrineos/citrineos-payment ../citrineos-payment
cp ../citrineos-payment/.env.example ../citrineos-payment/.env   # fill in real values
docker compose --profile payment up --build
```

To run our own read-only Hasura mirror of CitrineOS-core's data (the
frontend will read live/list data from this directly — see
[hasura/README.md](hasura/README.md)):

```sh
docker compose --profile hasura up --build
# console at http://localhost:8091, protected by HASURA_GRAPHQL_ADMIN_SECRET
```

## Testing

```sh
cd backend
pnpm test       # unit tests (mocked dependencies)
pnpm test:e2e   # exercises real HTTP + a real Postgres database
```

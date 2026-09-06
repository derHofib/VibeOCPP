# citrineos-vendor

`hasura-metadata/` is an unmodified copy of
[`apps/ocpp-server/hasura-metadata`](https://github.com/citrineos/citrineos-core/tree/main/apps/ocpp-server/hasura-metadata)
from `citrineos/citrineos-core` at commit `61622a07d44dffa855de10c233f034fc822146d9`
(Apache-2.0, `LICENSE` in this directory).

This is deployment **config**, not application code — CitrineOS publishes
a server image (`ghcr.io/citrineos/citrineos-server`) but no image for its
`graphql-engine` service; that service is the stock
`hasura/graphql-engine` image plus this metadata, mounted the same way
CitrineOS's own `docker-compose.yml` mounts it from a local path. Vendoring
it here is what lets `docker compose up` run CitrineOS's `graphql-engine`
service without also cloning `citrineos-core` — it is not a fork of
CitrineOS itself, and nothing in it is edited.

Do not confuse this with `hasura/metadata` at the repo root — that's
VibeOCPP's own, separate, read-only Hasura mirror (see
`hasura/README.md`), authored by us, running as its own service on a
different port. This directory belongs entirely to CitrineOS's
`graphql-engine` service.

To refresh after a CitrineOS upgrade: re-copy
`apps/ocpp-server/hasura-metadata` from the `citrineos-core` version
you're pinning `ghcr.io/citrineos/citrineos-server` to, and update the
commit hash above.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
# Both empty by default (real deployments build with no proxy in front of
# them). Only set when building behind a TLS-intercepting proxy, e.g. this
# repo's sandboxed dev environment — see /root/.ccr/README.md.
ARG HTTPS_PROXY=""
ARG NODE_EXTRA_CA_CERTS=""
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY ops-agent/package.json ./ops-agent/
# The bracket glob is the standard "optional COPY" trick: it copies the file
# when present and is a silent no-op (not an error) when it's not, so this
# still builds without it in every environment that isn't behind our proxy.
COPY backend/ca-bundle.cr[t] ./
# Placeholder manifest so pnpm can resolve the workspace without frontend's
# full source (keeps this layer cacheable independent of it). ops-agent has
# a real package.json above — it's a separate deployable with its own
# Dockerfile, but pnpm still needs its manifest to resolve the workspace.
RUN mkdir -p frontend \
  && echo '{"name":"frontend","private":true}' > frontend/package.json
RUN if [ -f ./ca-bundle.crt ]; then export NODE_EXTRA_CA_CERTS="$(pwd)/ca-bundle.crt"; fi; \
    pnpm install --frozen-lockfile --filter backend...

FROM deps AS build
COPY backend ./backend
WORKDIR /workspace/backend
RUN pnpm db:generate
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/backend
COPY --from=build /workspace/node_modules /workspace/node_modules
COPY --from=build /workspace/backend/node_modules ./node_modules
COPY --from=build /workspace/backend/dist ./dist
COPY --from=build /workspace/backend/prisma ./prisma
COPY --from=build /workspace/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build /workspace/backend/package.json ./package.json
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]

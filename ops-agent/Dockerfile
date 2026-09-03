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
COPY ops-agent/package.json ./ops-agent/
COPY backend/ca-bundle.cr[t] ./
# Placeholder manifests so pnpm can resolve the workspace without the other
# packages' full source (keeps this layer cacheable independent of them).
RUN mkdir -p frontend backend \
  && echo '{"name":"frontend","private":true}' > frontend/package.json \
  && echo '{"name":"backend","private":true}' > backend/package.json
RUN if [ -f ./ca-bundle.crt ]; then export NODE_EXTRA_CA_CERTS="$(pwd)/ca-bundle.crt"; fi; \
    pnpm install --frozen-lockfile --filter ops-agent...

FROM deps AS build
COPY ops-agent ./ops-agent
WORKDIR /workspace/ops-agent
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/ops-agent
COPY --from=build /workspace/node_modules /workspace/node_modules
COPY --from=build /workspace/ops-agent/node_modules ./node_modules
COPY --from=build /workspace/ops-agent/dist ./dist
COPY --from=build /workspace/ops-agent/package.json ./package.json
EXPOSE 3100
CMD ["node", "dist/main.js"]

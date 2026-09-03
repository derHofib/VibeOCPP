/**
 * The fixed set of services the ops-agent will ever touch — must match the
 * service names in the repo root docker-compose.yml. Any name not in this
 * list is rejected before it ever reaches dockerode; there is no way to
 * pass an arbitrary container name or command through this service.
 */
export const ALLOWED_SERVICES = [
  'product-db',
  'backend',
  'citrineos-payment',
  'directus',
  'hasura',
] as const;

export type AllowedService = (typeof ALLOWED_SERVICES)[number];

export function isAllowedService(name: string): name is AllowedService {
  return (ALLOWED_SERVICES as readonly string[]).includes(name);
}

/**
 * docker-compose prefixes container names with the project name and a
 * per-service index (`<project>-<service>-1`). We only ever match on the
 * `<service>` segment via label lookup (see docker-client.ts), so no name
 * templating happens here — this just documents the mapping.
 */

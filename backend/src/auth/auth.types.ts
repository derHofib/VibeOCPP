export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

// The exact claim namespace Hasura's JWT auth mode looks for by default —
// see hasura/README.md and docs/architecture-proposal.md §9/§11. Our own
// guards never read this; it exists purely so the same access token that
// authenticates against the BFF also authenticates GraphQL reads against
// our own Hasura instance, without a second login step.
export interface HasuraClaims {
  'x-hasura-allowed-roles': string[];
  'x-hasura-default-role': string;
  'x-hasura-user-id': string;
}

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  'https://hasura.io/jwt/claims': HasuraClaims;
}

// "admin" is a Hasura-reserved role name (only the admin-secret request
// gets it) — a real Hasura instance rejects any select_permission defined
// for a role literally named "admin" as inconsistent metadata, discovered
// by actually running our own metadata against a real Hasura container
// before this shipped. Every other role also gets a mapping here, not
// just Admin, so this stays the one place role names can diverge from
// our own Role enum instead of assuming a bare toLowerCase() forever.
const ROLE_TO_HASURA_ROLE: Record<string, string> = {
  SuperAdmin: 'superadmin',
  Admin: 'csms_admin',
  Mitarbeiter: 'mitarbeiter',
  Driver: 'driver',
};

export function toHasuraRole(role: string): string {
  return ROLE_TO_HASURA_ROLE[role] ?? role.toLowerCase();
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

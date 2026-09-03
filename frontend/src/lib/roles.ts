// Mirrors backend/src/common/roles.enum.ts — kept as a separate literal for
// the same reason as ops-agent's whitelist mirror: this is a UI-side gate
// only (which nav items/routes render), never the source of authorization.
// Every privileged action is re-checked server-side regardless.
export const ROLES = ['SuperAdmin', 'Admin', 'Mitarbeiter', 'Driver'] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  Driver: 0,
  Mitarbeiter: 1,
  Admin: 2,
  SuperAdmin: 3,
};

export function hasAtLeastRole(userRole: string, required: Role): boolean {
  const userRank = ROLE_RANK[userRole as Role] ?? -1;
  return userRank >= ROLE_RANK[required];
}

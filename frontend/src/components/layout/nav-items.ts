import type { Role } from '../../lib/roles.js';

export interface NavItem {
  to: string;
  labelKey: string;
  requiredRole?: Role;
}

// Ordering matches the operator's typical workflow (status first, config
// last) — not alphabetical. requiredRole gates visibility only; the actual
// route is separately wrapped in <ProtectedRoute requiredRole=…> and every
// call the page makes is re-checked server-side.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard' },
  { to: '/stations', labelKey: 'nav.stations' },
  { to: '/transactions', labelKey: 'nav.transactions' },
  { to: '/testsuite', labelKey: 'nav.testsuite' },
  { to: '/monitor', labelKey: 'nav.monitor' },
  { to: '/users', labelKey: 'nav.users', requiredRole: 'Admin' },
  { to: '/settings', labelKey: 'nav.settings', requiredRole: 'SuperAdmin' },
  { to: '/ops', labelKey: 'nav.ops', requiredRole: 'SuperAdmin' },
];

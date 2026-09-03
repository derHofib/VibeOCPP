import { hasAtLeastRole } from './roles.js';

describe('hasAtLeastRole', () => {
  it('allows a higher-ranked role to satisfy a lower requirement', () => {
    expect(hasAtLeastRole('SuperAdmin', 'Admin')).toBe(true);
    expect(hasAtLeastRole('Admin', 'Mitarbeiter')).toBe(true);
  });

  it('allows a role to satisfy an equal requirement', () => {
    expect(hasAtLeastRole('Admin', 'Admin')).toBe(true);
  });

  it('rejects a lower-ranked role', () => {
    expect(hasAtLeastRole('Mitarbeiter', 'Admin')).toBe(false);
    expect(hasAtLeastRole('Driver', 'SuperAdmin')).toBe(false);
  });

  it('rejects an unknown role string entirely', () => {
    expect(hasAtLeastRole('NotARole', 'Driver')).toBe(false);
  });
});

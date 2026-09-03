import { toHasuraRole } from './auth.types.js';

describe('toHasuraRole', () => {
  it('never maps Admin to the Hasura-reserved "admin" role', () => {
    expect(toHasuraRole('Admin')).toBe('csms_admin');
    expect(toHasuraRole('Admin')).not.toBe('admin');
  });

  it('maps the other known roles to their lowercase Hasura role', () => {
    expect(toHasuraRole('SuperAdmin')).toBe('superadmin');
    expect(toHasuraRole('Mitarbeiter')).toBe('mitarbeiter');
    expect(toHasuraRole('Driver')).toBe('driver');
  });

  it('falls back to a plain lowercase for an unmapped role rather than throwing', () => {
    expect(toHasuraRole('SomeFutureRole')).toBe('somefuturerole');
  });
});

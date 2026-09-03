import { validateEnv } from './env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SETTINGS_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
  PORT: '3000',
};

describe('validateEnv', () => {
  it('accepts a fully populated, valid bootstrap config', () => {
    const result = validateEnv(validEnv);
    expect(result.PORT).toBe(3000);
  });

  it('rejects a missing DATABASE_URL', () => {
    const rest = { ...validEnv };
    delete (rest as Partial<typeof validEnv>).DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects a SETTINGS_MASTER_KEY that does not decode to 32 bytes', () => {
    expect(() => validateEnv({ ...validEnv, SETTINGS_MASTER_KEY: 'dG9vc2hvcnQ=' })).toThrow(
      /SETTINGS_MASTER_KEY/,
    );
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});

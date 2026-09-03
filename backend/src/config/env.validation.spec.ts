import { validateEnv } from './env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SETTINGS_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
  OPS_AGENT_SHARED_SECRET: 'c'.repeat(16),
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

  it('rejects an OPS_AGENT_SHARED_SECRET shorter than 16 characters', () => {
    expect(() => validateEnv({ ...validEnv, OPS_AGENT_SHARED_SECRET: 'short' })).toThrow(
      /OPS_AGENT_SHARED_SECRET/,
    );
  });

  it('defaults OPS_AGENT_URL to the internal Compose service name', () => {
    const result = validateEnv(validEnv);
    expect(result.OPS_AGENT_URL).toBe('http://ops-agent:3100');
  });
});

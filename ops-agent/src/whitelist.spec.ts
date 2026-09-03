import { describe, expect, it } from 'vitest';
import { ALLOWED_SERVICES, isAllowedService } from './whitelist.js';

describe('isAllowedService', () => {
  it('accepts every service listed in ALLOWED_SERVICES', () => {
    for (const service of ALLOWED_SERVICES) {
      expect(isAllowedService(service)).toBe(true);
    }
  });

  it('rejects names not in the whitelist', () => {
    expect(isAllowedService('unknown-service')).toBe(false);
  });

  it('rejects attempts to smuggle shell metacharacters or paths', () => {
    expect(isAllowedService('backend; rm -rf /')).toBe(false);
    expect(isAllowedService('../etc/passwd')).toBe(false);
    expect(isAllowedService('')).toBe(false);
  });
});

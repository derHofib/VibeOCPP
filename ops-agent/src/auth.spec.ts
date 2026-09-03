import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { isAuthorized } from './auth.js';

function reqWith(secret: string | string[] | undefined): IncomingMessage {
  return { headers: { 'x-ops-agent-secret': secret } } as unknown as IncomingMessage;
}

describe('isAuthorized', () => {
  const sharedSecret = 'correct-horse-battery-staple';

  it('accepts a matching secret', () => {
    expect(isAuthorized(reqWith(sharedSecret), sharedSecret)).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(isAuthorized(reqWith(undefined), sharedSecret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(isAuthorized(reqWith('nope'), sharedSecret)).toBe(false);
  });

  it('rejects a secret of different length without throwing', () => {
    expect(isAuthorized(reqWith('short'), sharedSecret)).toBe(false);
  });

  it('uses only the first value when the header is duplicated', () => {
    expect(isAuthorized(reqWith([sharedSecret, 'other']), sharedSecret)).toBe(true);
  });
});

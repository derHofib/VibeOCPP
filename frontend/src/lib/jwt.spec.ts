import { decodeAccessToken, isExpired } from './jwt.js';

function makeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.signature`;
}

describe('decodeAccessToken', () => {
  it('decodes a well-formed JWT payload', () => {
    const token = makeToken({ sub: 'u1', tenantId: 't1', email: 'a@b.c', role: 'Admin', exp: 999 });
    expect(decodeAccessToken(token)).toEqual({
      sub: 'u1',
      tenantId: 't1',
      email: 'a@b.c',
      role: 'Admin',
      exp: 999,
    });
  });

  it('returns null for a malformed token', () => {
    expect(decodeAccessToken('not-a-jwt')).toBeNull();
  });

  it('returns null for unparsable base64 payload', () => {
    expect(decodeAccessToken('a.!!!not-base64!!!.c')).toBeNull();
  });
});

describe('isExpired', () => {
  it('treats a future exp as not expired', () => {
    const claims = { sub: '', tenantId: '', email: '', role: '', exp: Date.now() / 1000 + 3600 };
    expect(isExpired(claims)).toBe(false);
  });

  it('treats a past exp as expired', () => {
    const claims = { sub: '', tenantId: '', email: '', role: '', exp: Date.now() / 1000 - 3600 };
    expect(isExpired(claims)).toBe(true);
  });

  it('applies the skew margin so a token expiring within it counts as expired', () => {
    const claims = { sub: '', tenantId: '', email: '', role: '', exp: Date.now() / 1000 + 5 };
    expect(isExpired(claims, 10)).toBe(true);
  });
});

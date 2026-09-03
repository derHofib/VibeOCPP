import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service.js';

function makeService(masterKeyBase64: string) {
  const configService = { getOrThrow: () => masterKeyBase64 } as unknown as ConfigService;
  return new EncryptionService(configService);
}

const VALID_KEY = Buffer.alloc(32, 7).toString('base64');

describe('EncryptionService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const service = makeService(VALID_KEY);
    const payload = service.encrypt('sk_live_super_secret_value');
    expect(payload.ciphertext).not.toEqual(Buffer.from('sk_live_super_secret_value'));
    expect(service.decrypt(payload)).toBe('sk_live_super_secret_value');
  });

  it('produces a different ciphertext and IV on every call (no IV reuse)', () => {
    const service = makeService(VALID_KEY);
    const a = service.encrypt('same-plaintext');
    const b = service.encrypt('same-plaintext');
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it('rejects a tampered ciphertext instead of silently returning garbage', () => {
    const service = makeService(VALID_KEY);
    const payload = service.encrypt('sk_live_super_secret_value');
    payload.ciphertext[0] = payload.ciphertext[0] ^ 0xff;
    expect(() => service.decrypt(payload)).toThrow();
  });

  it('rejects a master key that is not exactly 32 bytes', () => {
    const shortKey = Buffer.alloc(16, 1).toString('base64');
    expect(() => makeService(shortKey)).toThrow(/32 bytes/);
  });

  it('masks all but the last 4 characters', () => {
    const service = makeService(VALID_KEY);
    expect(service.mask('sk_live_abcdef1234')).toBe('••••1234');
  });

  it('fully masks values of 4 characters or fewer', () => {
    const service = makeService(VALID_KEY);
    expect(service.mask('abcd')).toBe('••••');
    expect(service.mask('a')).toBe('••••');
  });
});

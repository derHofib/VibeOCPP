import { pollUntil } from './poll-until.js';

describe('pollUntil', () => {
  it('returns the result as soon as check() resolves truthy', async () => {
    let calls = 0;
    const result = await pollUntil(
      async () => {
        calls++;
        return calls >= 3 ? { found: true } : null;
      },
      5000,
      1,
    );
    expect(result).toEqual({ found: true });
    expect(calls).toBe(3);
  });

  it('returns null once the timeout elapses without a match', async () => {
    const result = await pollUntil(async () => null, 20, 5);
    expect(result).toBeNull();
  });

  it('checks at least once even with a zero timeout', async () => {
    let calls = 0;
    await pollUntil(
      async () => {
        calls++;
        return null;
      },
      0,
      10,
    );
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});

import { cn } from './cn.js';

describe('cn', () => {
  it('merges class names and resolves conflicting Tailwind utilities', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

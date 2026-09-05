import { groupByCategory, type SettingRow } from './settings.js';

function row(overrides: Partial<SettingRow>): SettingRow {
  return {
    id: 'id',
    category: 'citrineos',
    key: 'dataApiUrl',
    type: 'string',
    value: 'http://x',
    version: 1,
    updatedBy: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('groupByCategory', () => {
  it('groups rows by category, preserving first-seen order', () => {
    const rows = [
      row({ category: 'citrineos', key: 'a' }),
      row({ category: 'payment', key: 'b' }),
      row({ category: 'citrineos', key: 'c' }),
    ];

    const groups = groupByCategory(rows);

    expect([...groups.keys()]).toEqual(['citrineos', 'payment']);
    expect(groups.get('citrineos')?.map((r) => r.key)).toEqual(['a', 'c']);
    expect(groups.get('payment')?.map((r) => r.key)).toEqual(['b']);
  });

  it('returns an empty map for no settings', () => {
    expect(groupByCategory([]).size).toBe(0);
  });
});

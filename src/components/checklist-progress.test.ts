import { describe, expect, it } from 'vitest';
import { groupItemsByBooth, summarizeChecklist } from './checklist-progress';

describe('summarizeChecklist', () => {
  it('is empty for no items', () => {
    expect(summarizeChecklist([])).toEqual({ checked: 0, total: 0, byBadge: [] });
  });

  it('counts overall and per badge in order of first appearance', () => {
    const summary = summarizeChecklist([
      { badgeId: 'pickup', checked: false },
      { badgeId: 'purchase', checked: true },
      { badgeId: 'pickup', checked: true },
      { badgeId: 'purchase', checked: false },
      { badgeId: 'purchase', checked: true },
    ]);
    expect(summary.checked).toBe(3);
    expect(summary.total).toBe(5);
    expect(summary.byBadge).toEqual([
      { badgeId: 'pickup', checked: 1, total: 2 },
      { badgeId: 'purchase', checked: 2, total: 3 },
    ]);
  });
});

describe('groupItemsByBooth', () => {
  it('groups by booth and keeps item order', () => {
    const items = [
      { id: 'a', boothId: 'b1' },
      { id: 'b', boothId: 'b2' },
      { id: 'c', boothId: 'b1' },
    ];
    const groups = groupItemsByBooth(items);
    expect([...groups.keys()]).toEqual(['b1', 'b2']);
    expect(groups.get('b1')?.map((item) => item.id)).toEqual(['a', 'c']);
    expect(groups.get('b2')?.map((item) => item.id)).toEqual(['b']);
  });
});

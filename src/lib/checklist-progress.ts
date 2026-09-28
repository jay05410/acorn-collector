import type { Item } from '@/types';

export interface BadgeProgress {
  badgeId: string;
  checked: number;
  total: number;
}

export interface ChecklistProgress {
  checked: number;
  total: number;
  /** Per badge, in order of first appearance. */
  byBadge: BadgeProgress[];
}

/** Checked/total counts overall and per badge. */
export function summarizeChecklist(
  items: readonly Pick<Item, 'badgeId' | 'checked'>[]
): ChecklistProgress {
  const byBadge = new Map<string, BadgeProgress>();
  let checked = 0;
  for (const item of items) {
    const entry = byBadge.get(item.badgeId) ?? {
      badgeId: item.badgeId,
      checked: 0,
      total: 0,
    };
    entry.total += 1;
    if (item.checked) {
      entry.checked += 1;
      checked += 1;
    }
    byBadge.set(item.badgeId, entry);
  }
  return { checked, total: items.length, byBadge: [...byBadge.values()] };
}

/** Items grouped by booth id, keeping their order. */
export function groupItemsByBooth<T extends Pick<Item, 'boothId'>>(
  items: readonly T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.boothId);
    if (group) group.push(item);
    else groups.set(item.boothId, [item]);
  }
  return groups;
}

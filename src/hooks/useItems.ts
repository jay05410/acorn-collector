import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { DEFAULT_BADGE_ID } from '@/constants/presetBadges';
import type { Item } from '@/types';

export function useItems(boothId: string) {
  const items = useLiveQuery(
    () => db.items.where('boothId').equals(boothId).toArray(),
    [boothId]
  );

  const createItem = async (
    data: Omit<
      Item,
      | 'id'
      | 'createdAt'
      | 'checked'
      | 'quantity'
      | 'originalName'
      | 'currency'
      | 'category'
      | 'option'
    > &
      Partial<
        Pick<
          Item,
          | 'checked'
          | 'quantity'
          | 'originalName'
          | 'currency'
          | 'category'
          | 'option'
        >
      >
  ): Promise<string> => {
    const id = generateId();
    const { badgeId, ...rest } = data;
    await db.items.add({
      checked: false,
      quantity: 1,
      originalName: null,
      currency: null,
      category: null,
      option: null,
      badgeId: badgeId ?? DEFAULT_BADGE_ID,
      ...rest,
      id,
      createdAt: Date.now(),
    });
    return id;
  };

  const updateItem = async (
    id: string,
    data: Partial<Omit<Item, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await db.items.update(id, data);
  };

  const deleteItem = async (id: string): Promise<void> => {
    await db.items.delete(id);
  };

  const toggleItemCheck = async (id: string): Promise<void> => {
    const item = await db.items.get(id);
    if (item) {
      await db.items.update(id, { checked: !item.checked });
    }
  };

  const checkedCount = items?.filter((i) => i.checked).length ?? 0;
  const totalCount = items?.length ?? 0;

  const badgeCounts = items?.reduce(
    (acc, item) => {
      if (!item.checked) {
        acc[item.badgeId] = (acc[item.badgeId] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  const badgeStats: Record<string, { total: number; checked: number }> = {};
  if (items) {
    for (const item of items) {
      const existing = badgeStats[item.badgeId];
      if (existing) {
        existing.total += 1;
        if (item.checked) {
          existing.checked += 1;
        }
      } else {
        badgeStats[item.badgeId] = { total: 1, checked: item.checked ? 1 : 0 };
      }
    }
  }

  return {
    items: items ?? [],
    isLoading: items === undefined,
    checkedCount,
    totalCount,
    badgeCounts,
    badgeStats,
    createItem,
    updateItem,
    deleteItem,
    toggleItemCheck,
  };
}

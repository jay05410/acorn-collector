import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { summarizeChecklist } from '@/lib/checklist-progress';
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

  /** Puts a deleted item back as it was (undo). */
  const restoreItem = async (item: Item): Promise<void> => {
    await db.items.put(item);
  };

  const toggleItemCheck = async (id: string): Promise<void> => {
    const item = await db.items.get(id);
    if (item) {
      await db.items.update(id, { checked: !item.checked });
    }
  };

  const progress = useMemo(() => summarizeChecklist(items ?? []), [items]);

  return {
    items: items ?? [],
    isLoading: items === undefined,
    /** Checked/total counts, overall and per badge. */
    progress,
    createItem,
    updateItem,
    deleteItem,
    restoreItem,
    toggleItemCheck,
  };
}

/** Live items of several booths (e.g. a whole event), in one query. */
export function useItemsForBooths(boothIds: readonly string[]): Item[] {
  const key = boothIds.join('\n');
  const items = useLiveQuery(
    () =>
      boothIds.length > 0
        ? db.items.where('boothId').anyOf([...boothIds]).toArray()
        : [],
    [key]
  );
  return items ?? [];
}

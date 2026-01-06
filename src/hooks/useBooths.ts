import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type { Booth } from '@/types';

export function useBooths(eventId: string) {
  const booths = useLiveQuery(
    () => db.booths.where('eventId').equals(eventId).sortBy('order'),
    [eventId]
  );

  const createBooth = async (
    data: Omit<Booth, 'id' | 'createdAt' | 'updatedAt' | 'order'>
  ): Promise<string> => {
    const now = Date.now();
    const id = generateId();
    const maxOrder = await db.booths
      .where('eventId')
      .equals(eventId)
      .count();

    await db.booths.add({
      ...data,
      id,
      order: maxOrder,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  };

  const updateBooth = async (
    id: string,
    data: Partial<Omit<Booth, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await db.booths.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  };

  const deleteBooth = async (id: string): Promise<void> => {
    await db.transaction('rw', [db.booths, db.items], async () => {
      await db.items.where('boothId').equals(id).delete();
      await db.booths.delete(id);
    });
  };

  const getBooth = async (id: string): Promise<Booth | undefined> => {
    return db.booths.get(id);
  };

  return {
    booths: booths ?? [],
    isLoading: booths === undefined,
    createBooth,
    updateBooth,
    deleteBooth,
    getBooth,
  };
}

export function useBooth(boothId: string) {
  const booth = useLiveQuery(() => db.booths.get(boothId), [boothId]);
  return { booth, isLoading: booth === undefined };
}

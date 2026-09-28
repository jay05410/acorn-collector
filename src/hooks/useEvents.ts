import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type { Event } from '@/types';

export function useEvents() {
  const events = useLiveQuery(() =>
    db.events.orderBy('createdAt').reverse().toArray()
  );

  const createEvent = async (
    data: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'currency'> &
      Partial<Pick<Event, 'currency'>>
  ): Promise<string> => {
    const now = Date.now();
    const id = generateId();
    await db.events.add({
      currency: null,
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  };

  const updateEvent = async (
    id: string,
    data: Partial<Omit<Event, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await db.events.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  };

  const deleteEvent = async (id: string): Promise<void> => {
    await db.transaction('rw', [db.events, db.booths, db.items], async () => {
      const booths = await db.booths.where('eventId').equals(id).toArray();
      const boothIds = booths.map((b) => b.id);

      await db.items.where('boothId').anyOf(boothIds).delete();
      await db.booths.where('eventId').equals(id).delete();
      await db.events.delete(id);
    });
  };

  const getEvent = async (id: string): Promise<Event | undefined> => {
    return db.events.get(id);
  };

  return {
    events: events ?? [],
    isLoading: events === undefined,
    createEvent,
    updateEvent,
    deleteEvent,
    getEvent,
  };
}

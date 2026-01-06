import Dexie, { type EntityTable } from 'dexie';
import type { Event, Booth, Item, Badge } from '@/types';
import { PRESET_BADGES } from '@/constants/presetBadges';

export const db = new Dexie('AcornCollectorDB') as Dexie & {
  events: EntityTable<Event, 'id'>;
  booths: EntityTable<Booth, 'id'>;
  items: EntityTable<Item, 'id'>;
  badges: EntityTable<Badge, 'id'>;
};

db.version(1).stores({
  events: 'id, name, date, createdAt',
  booths: 'id, eventId, boothNumber, circleName, order, createdAt',
  items: 'id, boothId, name, badgeId, checked, createdAt',
  badges: 'id, label, isPreset, createdAt',
});

export async function initPresetBadges(): Promise<void> {
  const existingPresets = await db.badges
    .where('isPreset')
    .equals(1)
    .count();

  if (existingPresets === 0) {
    const presets = Object.values(PRESET_BADGES);
    await db.badges.bulkPut(presets);
  }
}

export async function initializeDatabase(): Promise<void> {
  await initPresetBadges();
}

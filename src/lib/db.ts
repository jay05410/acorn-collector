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

db.version(2)
  .stores({
    events: 'id, name, date, createdAt',
    booths: 'id, eventId, boothNumber, circleName, order, createdAt',
    items: 'id, boothId, name, badgeId, checked, createdAt',
    badges: 'id, label, isPreset, createdAt',
  })
  .upgrade((tx) => {
    return tx
      .table('booths')
      .toCollection()
      .modify((booth) => {
        if (booth.formUrl === undefined) {
          booth.formUrl = null;
        }
      });
  });

db.version(3)
  .stores({
    events: 'id, name, date, createdAt',
    booths: 'id, eventId, boothNumber, circleName, zone, order, createdAt',
    items: 'id, boothId, name, badgeId, checked, createdAt',
    badges: 'id, label, isPreset, createdAt',
  })
  .upgrade((tx) => {
    return tx
      .table('booths')
      .toCollection()
      .modify((booth) => {
        if (booth.zone === undefined) {
          booth.zone = null;
        }
      });
  });

db.version(4)
  .stores({
    events: 'id, name, date, createdAt',
    booths: 'id, eventId, boothNumber, circleName, zone, order, createdAt',
    items: 'id, boothId, name, badgeId, checked, createdAt',
    badges: 'id, label, isPreset, createdAt',
  })
  .upgrade((tx) => {
    return tx
      .table('booths')
      .toCollection()
      .modify((booth) => {
        if (booth.imageUrls === undefined) {
          booth.imageUrls = null;
        }
      });
  });

export async function initPresetBadges(): Promise<void> {
  await db.open();
  const totalBadges = await db.badges.count();
  if (totalBadges === 0) {
    const presets = Object.values(PRESET_BADGES);
    await db.badges.bulkPut(presets);
  }
}

export async function initializeDatabase(): Promise<void> {
  await initPresetBadges();
}

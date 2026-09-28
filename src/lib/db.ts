import Dexie, { type EntityTable } from 'dexie';
import type { Event, Booth, Item, Badge } from '@/types';
import { PRESET_BADGES } from '@/constants/presetBadges';

export const DB_NAME = 'AcornCollectorDB';

/** Local AI analysis cache row (see ./analysis-cache.ts). Added in DB v5. */
export interface AnalysisCacheEntry {
  key: string;
  value: unknown;
  createdAt: number;
}

export type AppDatabase = Dexie & {
  events: EntityTable<Event, 'id'>;
  booths: EntityTable<Booth, 'id'>;
  items: EntityTable<Item, 'id'>;
  badges: EntityTable<Badge, 'id'>;
  analysisCache: EntityTable<AnalysisCacheEntry, 'key'>;
};

const V4_STORES = {
  events: 'id, name, date, createdAt',
  booths: 'id, eventId, boothNumber, circleName, zone, order, createdAt',
  items: 'id, boothId, name, badgeId, checked, createdAt',
  badges: 'id, label, isPreset, createdAt',
};

type Row = Record<string, unknown>;

/** Set each listed field to null when a legacy row does not have it. */
function fillMissing(row: Row, fields: readonly string[]): void {
  for (const field of fields) {
    if (row[field] === undefined) row[field] = null;
  }
}

/**
 * Declares the full schema history on a Dexie instance. Exposed as a factory
 * so migrations can be tested against throwaway databases.
 */
export function createAppDatabase(name: string = DB_NAME): AppDatabase {
  const database = new Dexie(name) as AppDatabase;

  database.version(1).stores({
    events: 'id, name, date, createdAt',
    booths: 'id, eventId, boothNumber, circleName, order, createdAt',
    items: 'id, boothId, name, badgeId, checked, createdAt',
    badges: 'id, label, isPreset, createdAt',
  });

  database
    .version(2)
    .stores({
      events: 'id, name, date, createdAt',
      booths: 'id, eventId, boothNumber, circleName, order, createdAt',
      items: 'id, boothId, name, badgeId, checked, createdAt',
      badges: 'id, label, isPreset, createdAt',
    })
    .upgrade((tx) =>
      tx
        .table('booths')
        .toCollection()
        .modify((booth: Row) => fillMissing(booth, ['formUrl']))
    );

  database
    .version(3)
    .stores(V4_STORES)
    .upgrade((tx) =>
      tx
        .table('booths')
        .toCollection()
        .modify((booth: Row) => fillMissing(booth, ['zone']))
    );

  database
    .version(4)
    .stores(V4_STORES)
    .upgrade((tx) =>
      tx
        .table('booths')
        .toCollection()
        .modify((booth: Row) => fillMissing(booth, ['imageUrls']))
    );

  database
    .version(5)
    .stores({ ...V4_STORES, analysisCache: 'key, createdAt' })
    .upgrade(async (tx) => {
      await tx
        .table('events')
        .toCollection()
        .modify((event: Row) => fillMissing(event, ['currency']));
      await tx
        .table('booths')
        .toCollection()
        .modify((booth: Row) => fillMissing(booth, ['sourceText']));
      await tx
        .table('items')
        .toCollection()
        .modify((item: Row) =>
          fillMissing(item, ['originalName', 'currency', 'category', 'option'])
        );
    });

  return database;
}

export const db = createAppDatabase();

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

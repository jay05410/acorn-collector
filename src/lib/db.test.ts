import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAppDatabase,
  db,
  initializeDatabase,
  type AppDatabase,
} from './db';

const V4_STORES = {
  events: 'id, name, date, createdAt',
  booths: 'id, eventId, boothNumber, circleName, zone, order, createdAt',
  items: 'id, boothId, name, badgeId, checked, createdAt',
  badges: 'id, label, isPreset, createdAt',
};

const V1_STORES = {
  events: 'id, name, date, createdAt',
  booths: 'id, eventId, boothNumber, circleName, order, createdAt',
  items: 'id, boothId, name, badgeId, checked, createdAt',
  badges: 'id, label, isPreset, createdAt',
};

const legacyEvent = {
  id: 'e1',
  name: 'Comic 45',
  date: '2026-10-03',
  location: null,
  mapImageUrl: null,
  createdAt: 1,
  updatedAt: 1,
};

const legacyBooth = {
  id: 'b1',
  eventId: 'e1',
  boothNumber: 'A-01',
  circleName: 'Moon',
  sourceUrl: null,
  memo: null,
  order: 0,
  createdAt: 1,
  updatedAt: 1,
};

const legacyItem = {
  id: 'i1',
  boothId: 'b1',
  name: 'Sticker',
  price: 3000,
  badgeId: 'purchase',
  checked: true,
  quantity: 2,
  createdAt: 1,
};

let counter = 0;
const openDatabases: Dexie[] = [];

function uniqueName(): string {
  counter += 1;
  return `acorn-db-test-${counter}`;
}

async function seedLegacy(
  name: string,
  version: number,
  stores: Record<string, string>,
  seed: (legacy: Dexie) => Promise<void>
): Promise<void> {
  const legacy = new Dexie(name);
  legacy.version(version).stores(stores);
  await legacy.open();
  await seed(legacy);
  legacy.close();
}

async function openApp(name: string): Promise<AppDatabase> {
  const database = createAppDatabase(name);
  openDatabases.push(database);
  await database.open();
  return database;
}

afterEach(async () => {
  for (const database of openDatabases.splice(0)) {
    database.close();
    await Dexie.delete(database.name);
  }
});

describe('database v5 migration', () => {
  it('fills the v5 fields on rows written by v4', async () => {
    const name = uniqueName();
    await seedLegacy(name, 4, V4_STORES, async (legacy) => {
      await legacy.table('events').add(legacyEvent);
      await legacy
        .table('booths')
        .add({ ...legacyBooth, zone: null, formUrl: null, imageUrls: null });
      await legacy
        .table('items')
        .bulkAdd([
          legacyItem,
          { ...legacyItem, id: 'i2', currency: 'JPY', option: 'B' },
        ]);
    });

    const database = await openApp(name);

    expect(database.verno).toBe(5);
    expect(await database.events.get('e1')).toEqual({
      ...legacyEvent,
      currency: null,
    });
    expect(await database.booths.get('b1')).toMatchObject({
      boothNumber: 'A-01',
      sourceText: null,
    });
    expect(await database.items.get('i1')).toEqual({
      ...legacyItem,
      originalName: null,
      currency: null,
      category: null,
      option: null,
    });
    expect(await database.items.get('i2')).toMatchObject({
      currency: 'JPY',
      option: 'B',
      originalName: null,
      category: null,
    });
    expect(await database.analysisCache.count()).toBe(0);
  });

  it('runs every upgrade step for a v1 database', async () => {
    const name = uniqueName();
    await seedLegacy(name, 1, V1_STORES, async (legacy) => {
      await legacy.table('events').add(legacyEvent);
      await legacy.table('booths').add(legacyBooth);
    });

    const database = await openApp(name);

    expect(await database.booths.get('b1')).toEqual({
      ...legacyBooth,
      formUrl: null,
      zone: null,
      imageUrls: null,
      sourceText: null,
    });
  });

  it('creates the analysis cache table with a createdAt index', async () => {
    const database = await openApp(uniqueName());
    await database.analysisCache.bulkPut([
      { key: 'b', value: 2, createdAt: 20 },
      { key: 'a', value: 1, createdAt: 10 },
    ]);

    const ordered = await database.analysisCache.orderBy('createdAt').keys();
    expect(ordered).toEqual([10, 20]);
  });
});

describe('initializeDatabase', () => {
  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  it('seeds the preset badges once', async () => {
    await initializeDatabase();
    await initializeDatabase();

    const badges = await db.badges.toArray();
    expect(badges.map((b) => b.id).sort()).toEqual([
      'etc',
      'pickup',
      'purchase',
    ]);
    expect(badges.every((b) => b.isPreset)).toBe(true);
  });
});

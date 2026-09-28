import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, initializeDatabase } from './db';
import {
  BACKUP_VERSION,
  BackupFormatError,
  createBackup,
  importDataFromJson,
  parseBackup,
} from './export';

const NOW = Date.UTC(2026, 8, 29);

const v1Backup = {
  version: '1.0',
  exportedAt: '2025-11-01T00:00:00.000Z',
  events: [
    {
      id: 'e1',
      name: 'Comic 45',
      date: '2025-11-15',
      location: 'COEX',
      mapImageUrl: null,
      createdAt: 10,
      updatedAt: 20,
    },
  ],
  booths: [
    {
      id: 'b1',
      eventId: 'e1',
      boothNumber: 'A-01',
      circleName: 'Moon',
      zone: null,
      sourceUrl: 'https://x.com/moon/status/1',
      formUrl: null,
      memo: null,
      imageUrls: ['https://pbs.twimg.com/media/a.jpg'],
      order: 0,
      createdAt: 10,
      updatedAt: 10,
    },
  ],
  items: [
    {
      id: 'i1',
      boothId: 'b1',
      name: 'Sticker',
      price: 3000,
      badgeId: 'pickup',
      checked: true,
      quantity: 2,
      createdAt: 11,
    },
  ],
  customBadges: [],
};

function blob(value: unknown): Blob {
  return new Blob([JSON.stringify(value)], { type: 'application/json' });
}

describe('parseBackup', () => {
  it('fills the fields added in v2 for a v1 backup', () => {
    const backup = parseBackup(v1Backup, NOW);

    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe(v1Backup.exportedAt);
    expect(backup.events[0]).toEqual({ ...v1Backup.events[0], currency: null });
    expect(backup.booths[0]).toEqual({
      ...v1Backup.booths[0],
      sourceText: null,
    });
    expect(backup.items[0]).toEqual({
      ...v1Backup.items[0],
      originalName: null,
      currency: null,
      category: null,
      option: null,
    });
  });

  it('keeps v2 fields', () => {
    const backup = parseBackup(
      {
        ...v1Backup,
        version: '2.0',
        events: [{ ...v1Backup.events[0], currency: 'twd' }],
        items: [
          {
            ...v1Backup.items[0],
            originalName: 'ステッカー',
            currency: 'JPY',
            category: 'sticker',
            option: 'B',
          },
        ],
      },
      NOW
    );

    expect(backup.events[0]?.currency).toBe('TWD');
    expect(backup.items[0]).toMatchObject({
      originalName: 'ステッカー',
      currency: 'JPY',
      category: 'sticker',
      option: 'B',
    });
  });

  it('fills defaults for sparse legacy rows', () => {
    const backup = parseBackup(
      {
        version: '1.0',
        events: [{ id: 'e1', name: 'Fair' }],
        booths: [
          { id: 'b1', eventId: 'e1', boothNumber: '', circleName: 'Sun' },
          {
            id: 'b2',
            eventId: 'e1',
            boothNumber: 'B',
            circleName: 'Sky',
            imageUrls: [],
          },
        ],
        items: [
          {
            id: 'i1',
            boothId: 'b1',
            name: 'Book',
            price: 'free',
            quantity: 0,
            category: 'weapon',
            currency: 'yen!',
          },
        ],
      },
      NOW
    );

    expect(backup.events[0]).toMatchObject({
      date: null,
      currency: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(backup.booths.map((b) => b.order)).toEqual([0, 1]);
    expect(backup.booths[1]?.imageUrls).toBeNull();
    expect(backup.items[0]).toMatchObject({
      price: null,
      quantity: 1,
      category: null,
      currency: null,
      badgeId: 'purchase',
      checked: false,
    });
    expect(backup.customBadges).toEqual([]);
  });

  it('keeps custom badges and drops preset ones', () => {
    const backup = parseBackup(
      {
        ...v1Backup,
        customBadges: [
          {
            id: 'purchase',
            label: 'Buy',
            isPreset: true,
            color: null,
            createdAt: 0,
          },
          {
            id: 'c1',
            label: 'Later',
            isPreset: true,
            color: '#fff',
            createdAt: 5,
          },
        ],
      },
      NOW
    );

    expect(backup.customBadges).toEqual([
      {
        id: 'c1',
        label: 'Later',
        isPreset: false,
        color: '#fff',
        createdAt: 5,
      },
    ]);
  });

  it.each([
    ['a non-object', 'backup'],
    ['a missing version', { events: [] }],
    ['an unsupported version', { version: '3.0', events: [] }],
    ['missing events', { version: '2.0' }],
    ['a non-array section', { version: '2.0', events: [], items: {} }],
    ['a row without id', { version: '1.0', events: [{ name: 'x' }] }],
    ['a row without required text', { version: '1.0', events: [{ id: 'e' }] }],
    ['a non-object row', { version: '1.0', events: ['e1'] }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseBackup(raw, NOW)).toThrow(BackupFormatError);
  });
});

describe('backup round trip', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  it('imports a v1 backup and reports counts', async () => {
    const summary = await importDataFromJson(blob(v1Backup));

    expect(summary).toEqual({ events: 1, booths: 1, items: 1 });
    expect(await db.items.get('i1')).toMatchObject({
      currency: null,
      quantity: 2,
    });
    expect(await db.booths.get('b1')).toMatchObject({ sourceText: null });
  });

  it('exports version 2.0 with custom badges only and re-imports it', async () => {
    await importDataFromJson(blob(v1Backup));
    await db.badges.add({
      id: 'c1',
      label: 'Later',
      isPreset: false,
      color: null,
      createdAt: 1,
    });

    const backup = await createBackup();
    expect(backup.version).toBe('2.0');
    expect(backup.customBadges.map((b) => b.id)).toEqual(['c1']);
    expect(parseBackup(JSON.parse(JSON.stringify(backup)), NOW)).toEqual(
      backup
    );
  });

  it('writes nothing when the file is invalid', async () => {
    await expect(
      importDataFromJson(new Blob(['{not json'], { type: 'application/json' }))
    ).rejects.toThrow(BackupFormatError);
    await expect(
      importDataFromJson(
        blob({ ...v1Backup, items: [{ id: 'i9', name: 'no booth' }] })
      )
    ).rejects.toThrow(BackupFormatError);

    expect(await db.events.count()).toBe(0);
    expect(await db.items.count()).toBe(0);
  });
});

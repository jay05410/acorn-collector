import { LEGACY_EVENT_CURRENCY, db } from '@/lib/db';
import { DEFAULT_BADGE_ID, PRESET_BADGE_IDS } from '@/constants/presetBadges';
import { normalizeCurrencyCode } from '@/i18n/format';
import {
  ITEM_CATEGORIES,
  type Badge,
  type Booth,
  type Event,
  type Item,
  type ItemCategory,
} from '@/types';

export const BACKUP_VERSION = '2.0';

/** Backup majors this build can read: 1.x (DB v4 rows) and 2.x (DB v5). */
const SUPPORTED_MAJORS = ['1', '2'];

export interface Backup {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  events: Event[];
  booths: Booth[];
  items: Item[];
  customBadges: Badge[];
}

export interface ImportSummary {
  events: number;
  booths: number;
  items: number;
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

export async function exportChecklistAsImage(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    style: {
      padding: '16px',
    },
  });

  const link = document.createElement('a');
  link.download = `booth-checklist-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}

/** Consistent snapshot of all user data. Preset badges are not included. */
export async function createBackup(): Promise<Backup> {
  return db.transaction(
    'r',
    [db.events, db.booths, db.items, db.badges],
    async () => {
      const [events, booths, items, badges] = await Promise.all([
        db.events.toArray(),
        db.booths.toArray(),
        db.items.toArray(),
        db.badges.toArray(),
      ]);
      return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        events,
        booths,
        items,
        customBadges: badges.filter((badge) => !badge.isPreset),
      };
    }
  );
}

export async function exportDataAsJson(): Promise<void> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `acorn-collector-backup-${Date.now()}.json`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}

type Row = Record<string, unknown>;

function asRow(value: unknown, path: string): Row {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BackupFormatError(`${path} must be an object`);
  }
  return value as Row;
}

function rows(backup: Row, key: string, required: boolean): Row[] {
  const value = backup[key];
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) {
    throw new BackupFormatError(`${key} must be an array`);
  }
  return value.map((entry, index) => asRow(entry, `${key}[${index}]`));
}

function id(row: Row, key: string, path: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new BackupFormatError(`${path}.${key} must be a non-empty string`);
  }
  return value;
}

function text(row: Row, key: string, path: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new BackupFormatError(`${path}.${key} must be a string`);
  }
  return value;
}

function optionalText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function finiteNumber(row: Row, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function category(value: unknown): ItemCategory | null {
  return (ITEM_CATEGORIES as readonly unknown[]).includes(value)
    ? (value as ItemCategory)
    : null;
}

/**
 * `legacy` is true for 1.x backups, written before events had a currency;
 * v1 rendered every price as KRW, so their events default to KRW. Items
 * keep a null currency either way and inherit the event's.
 */
function normalizeEvent(
  row: Row,
  path: string,
  now: number,
  legacy: boolean
): Event {
  const createdAt = finiteNumber(row, 'createdAt') ?? now;
  const currency = normalizeCurrencyCode(optionalText(row, 'currency'));
  return {
    id: id(row, 'id', path),
    name: text(row, 'name', path),
    date: optionalText(row, 'date'),
    location: optionalText(row, 'location'),
    mapImageUrl: optionalText(row, 'mapImageUrl'),
    currency: currency ?? (legacy ? LEGACY_EVENT_CURRENCY : null),
    createdAt,
    updatedAt: finiteNumber(row, 'updatedAt') ?? createdAt,
  };
}

function normalizeBooth(
  row: Row,
  path: string,
  index: number,
  now: number
): Booth {
  const createdAt = finiteNumber(row, 'createdAt') ?? now;
  const imageUrls = Array.isArray(row.imageUrls)
    ? row.imageUrls.filter((url): url is string => typeof url === 'string')
    : [];
  return {
    id: id(row, 'id', path),
    eventId: id(row, 'eventId', path),
    boothNumber: text(row, 'boothNumber', path),
    circleName: text(row, 'circleName', path),
    zone: optionalText(row, 'zone'),
    sourceUrl: optionalText(row, 'sourceUrl'),
    formUrl: optionalText(row, 'formUrl'),
    memo: optionalText(row, 'memo'),
    imageUrls: imageUrls.length > 0 ? imageUrls : null,
    sourceText: optionalText(row, 'sourceText'),
    order: finiteNumber(row, 'order') ?? index,
    createdAt,
    updatedAt: finiteNumber(row, 'updatedAt') ?? createdAt,
  };
}

function normalizeItem(row: Row, path: string, now: number): Item {
  const quantity = finiteNumber(row, 'quantity');
  return {
    id: id(row, 'id', path),
    boothId: id(row, 'boothId', path),
    name: text(row, 'name', path),
    originalName: optionalText(row, 'originalName'),
    price: finiteNumber(row, 'price'),
    currency: normalizeCurrencyCode(optionalText(row, 'currency')),
    category: category(row.category),
    option: optionalText(row, 'option'),
    badgeId: optionalText(row, 'badgeId') ?? DEFAULT_BADGE_ID,
    checked: row.checked === true,
    quantity: quantity !== null && quantity > 0 ? quantity : 1,
    createdAt: finiteNumber(row, 'createdAt') ?? now,
  };
}

function normalizeBadge(row: Row, path: string, now: number): Badge {
  return {
    id: id(row, 'id', path),
    label: text(row, 'label', path),
    isPreset: false,
    color: optionalText(row, 'color'),
    createdAt: finiteNumber(row, 'createdAt') ?? now,
  };
}

/**
 * Validates a parsed backup file and normalizes it to the current schema.
 * v1 backups get the fields added in DB v5 (null), except that events
 * without a currency get KRW. Throws BackupFormatError when the file is not
 * a backup or a row lacks an id or required text.
 */
export function parseBackup(raw: unknown, now: number = Date.now()): Backup {
  const backup = asRow(raw, 'backup');
  const version = backup.version;
  const major =
    typeof version === 'string' ? (version.split('.')[0] ?? '') : '';
  if (!SUPPORTED_MAJORS.includes(major)) {
    throw new BackupFormatError('Unsupported backup version');
  }
  const legacy = major !== '2';

  const presetIds: readonly string[] = PRESET_BADGE_IDS;
  return {
    version: BACKUP_VERSION,
    exportedAt:
      typeof backup.exportedAt === 'string'
        ? backup.exportedAt
        : new Date(now).toISOString(),
    events: rows(backup, 'events', true).map((row, i) =>
      normalizeEvent(row, `events[${i}]`, now, legacy)
    ),
    booths: rows(backup, 'booths', false).map((row, i) =>
      normalizeBooth(row, `booths[${i}]`, i, now)
    ),
    items: rows(backup, 'items', false).map((row, i) =>
      normalizeItem(row, `items[${i}]`, now)
    ),
    customBadges: rows(backup, 'customBadges', false)
      .map((row, i) => normalizeBadge(row, `customBadges[${i}]`, now))
      .filter((badge) => !presetIds.includes(badge.id)),
  };
}

/** Restores a backup file, merging rows by id. Nothing is written on error. */
export async function importDataFromJson(file: Blob): Promise<ImportSummary> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new BackupFormatError('Backup is not valid JSON');
  }
  const backup = parseBackup(raw);

  await db.transaction(
    'rw',
    [db.events, db.booths, db.items, db.badges],
    async () => {
      await db.events.bulkPut(backup.events);
      await db.booths.bulkPut(backup.booths);
      await db.items.bulkPut(backup.items);
      await db.badges.bulkPut(backup.customBadges);
    }
  );

  return {
    events: backup.events.length,
    booths: backup.booths.length,
    items: backup.items.length,
  };
}

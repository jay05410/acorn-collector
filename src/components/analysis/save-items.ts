/** Adds reviewed items to an existing booth in one transaction. */
import { db, type AppDatabase } from '@/lib/db';
import { toItemRecords, type ReviewRow } from './items-review-state';

export interface AddReviewedItemsInput {
  boothId: string;
  rows: readonly ReviewRow[];
  /** The booth's event currency; matching items store null. */
  eventCurrency: string;
  badgeId: string;
  now?: number;
  database?: AppDatabase;
}

/** Resolves to the number of items added. */
export async function addReviewedItems(input: AddReviewedItemsInput): Promise<number> {
  const database = input.database ?? db;
  const items = toItemRecords(input.rows, {
    boothId: input.boothId,
    eventCurrency: input.eventCurrency,
    badgeId: input.badgeId,
    now: input.now ?? Date.now(),
  });
  if (items.length === 0) return 0;
  await database.transaction('rw', database.items, async () => {
    await database.items.bulkAdd(items);
  });
  return items.length;
}

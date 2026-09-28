/**
 * Saves a reviewed capture in one transaction: the new event (if any), the
 * booth and the selected items.
 */
import {
  toItemRecords,
  type ReviewRow,
} from '@/components/analysis/items-review-state';
import type { PageSnapshot } from '@/lib/capture/types';
import { db, type AppDatabase } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type { Event } from '@/types';
import {
  boothFields,
  draftEventCurrency,
  NEW_EVENT,
  type BoothDraft,
} from './capture-draft';

export interface SaveCaptureInput {
  draft: BoothDraft;
  events: readonly Event[];
  snapshot: PageSnapshot | null;
  /** Images the user kept. */
  imageUrls: readonly string[];
  /** Booth number for a mail-order booth without one. */
  mailOrderLabel: string;
  rows: readonly ReviewRow[];
  badgeId: string;
  now?: number;
  database?: AppDatabase;
}

export interface SaveCaptureResult {
  eventId: string;
  boothId: string;
  itemCount: number;
}

export async function saveCapture(input: SaveCaptureInput): Promise<SaveCaptureResult> {
  const database = input.database ?? db;
  const now = input.now ?? Date.now();
  const { draft } = input;
  const eventCurrency = draftEventCurrency(draft, input.events);

  const newEvent: Event | null =
    draft.eventId === NEW_EVENT
      ? {
          id: generateId(),
          name: draft.newEventName.trim(),
          date: null,
          location: null,
          mapImageUrl: null,
          currency: eventCurrency,
          createdAt: now,
          updatedAt: now,
        }
      : null;
  const eventId = newEvent?.id ?? draft.eventId;
  const boothId = generateId();
  const booth = {
    ...boothFields({
      draft,
      snapshot: input.snapshot,
      imageUrls: input.imageUrls,
      mailOrderLabel: input.mailOrderLabel,
    }),
    id: boothId,
    eventId,
    createdAt: now,
    updatedAt: now,
  };
  const items = toItemRecords(input.rows, {
    boothId,
    eventCurrency,
    badgeId: input.badgeId,
    now,
  });

  await database.transaction(
    'rw',
    [database.events, database.booths, database.items],
    async () => {
      if (newEvent) await database.events.add(newEvent);
      const order = await database.booths.where('eventId').equals(eventId).count();
      await database.booths.add({ ...booth, order });
      if (items.length > 0) await database.items.bulkAdd(items);
    }
  );
  return { eventId, boothId, itemCount: items.length };
}

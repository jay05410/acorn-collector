import { db } from '@/lib/db';

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

export async function exportDataAsJson(): Promise<void> {
  const events = await db.events.toArray();
  const booths = await db.booths.toArray();
  const items = await db.items.toArray();
  const badges = await db.badges.where('isPreset').equals(0).toArray();

  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    events,
    booths,
    items,
    customBadges: badges,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `acorn-collector-backup-${Date.now()}.json`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}

export async function importDataFromJson(file: File): Promise<{
  events: number;
  booths: number;
  items: number;
}> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.version || !data.events) {
    throw new Error('Invalid backup file format');
  }

  await db.transaction(
    'rw',
    [db.events, db.booths, db.items, db.badges],
    async () => {
      if (data.events?.length) {
        await db.events.bulkPut(data.events);
      }
      if (data.booths?.length) {
        await db.booths.bulkPut(data.booths);
      }
      if (data.items?.length) {
        await db.items.bulkPut(data.items);
      }
      if (data.customBadges?.length) {
        await db.badges.bulkPut(data.customBadges);
      }
    }
  );

  return {
    events: data.events?.length || 0,
    booths: data.booths?.length || 0,
    items: data.items?.length || 0,
  };
}

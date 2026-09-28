// i18n-scan-ignore-file: Korean and Japanese capture fixtures
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { reviewReducer } from '@/components/analysis/items-review-state';
import type { ExtractionOutcome } from '@/hooks/useExtraction';
import { createSnapshot } from '@/lib/capture/snapshot';
import { createAppDatabase } from '@/lib/db';
import type { Event } from '@/types';
import {
  boothFields,
  draftErrors,
  draftEventCurrency,
  draftReducer,
  initialDraft,
  NEW_EVENT,
  normalizeLinkInput,
  type DraftState,
} from './capture-draft';
import { saveCapture } from './save-capture';

const EVENTS: Event[] = [
  {
    id: 'ev1',
    name: '서울코믹월드 2026 가을',
    date: null,
    location: null,
    mapImageUrl: null,
    currency: 'KRW',
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: 'ev2',
    name: 'コミックマーケット108',
    date: null,
    location: null,
    mapImageUrl: null,
    currency: 'JPY',
    createdAt: 1,
    updatedAt: 1,
  },
];

const SNAPSHOT = createSnapshot({
  site: 'x',
  url: 'https://x.com/moonlight_circle/status/1',
  capturedAt: 1,
  text: '[서코/B-12] 달빛서클 신간 & 굿즈 안내! 통판 폼 https://witchform.com/example #서울코믹월드',
  author: { name: '달빛서클', handle: 'moonlight_circle', url: null },
  links: ['https://witchform.com/example', 'https://x.com/moonlight_circle'],
});

function outcome(patch: Partial<ExtractionOutcome['booth']>, currency: string | null = 'KRW'): ExtractionOutcome {
  return {
    booth: {
      boothNumber: null,
      circleName: null,
      eventName: null,
      zone: null,
      isMailOrder: false,
      ...patch,
    },
    currency,
    meta: { provider: 'openai', model: 'm', latencyMs: 1, cached: false, skippedImages: [] },
  };
}

function start(): DraftState {
  return initialDraft({ snapshot: SNAPSHOT, events: EVENTS, defaultCurrency: 'KRW' });
}

describe('initialDraft', () => {
  it('prefills booth, circle, event match and order links from the post', () => {
    const { draft, eventOrigin } = start();
    expect(draft).toMatchObject({
      eventId: 'ev1',
      boothNumber: 'B-12',
      circleName: '달빛서클',
      isMailOrder: true,
    });
    expect(eventOrigin).toBe('post');
    const included = draft.links.filter((l) => l.included).map((l) => l.url);
    expect(included).toEqual(['https://witchform.com/example']);
  });

  it('prefers a preselected event and falls back to the given one', () => {
    expect(
      initialDraft({
        snapshot: SNAPSHOT,
        events: EVENTS,
        preselectedEventId: 'ev2',
        defaultCurrency: 'KRW',
      }).draft.eventId
    ).toBe('ev2');
    const manual = initialDraft({
      snapshot: null,
      events: EVENTS,
      fallbackEventId: 'ev2',
      defaultCurrency: 'JPY',
    });
    expect(manual.draft).toMatchObject({ eventId: 'ev2', boothNumber: '', links: [] });
  });

  it('proposes a new event when the post names one the user does not have', () => {
    const { draft } = initialDraft({
      snapshot: createSnapshot({ url: 'https://x.com/a/status/2', capturedAt: 1, text: 'C108 2日目 東ホ-12a' }),
      events: [EVENTS[0]!],
      defaultCurrency: 'JPY',
    });
    expect(draft.eventId).toBe(NEW_EVENT);
    expect(draft.newEventName).not.toBe('');
  });

  it('starts a new event when there are no events', () => {
    expect(initialDraft({ snapshot: null, events: [], defaultCurrency: 'USD' }).draft.eventId).toBe(
      NEW_EVENT
    );
  });
});

describe('draftReducer applyAI', () => {
  it('fills fields the user has not edited, keeps the ones they have', () => {
    let state = start();
    state = draftReducer(state, { type: 'set', patch: { circleName: 'Moonlight' } });
    state = draftReducer(state, {
      type: 'applyAI',
      outcome: outcome({ circleName: '달빛 서클', boothNumber: 'B12', zone: '쁘띠존' }),
      events: EVENTS,
    });
    expect(state.draft).toMatchObject({ circleName: 'Moonlight', boothNumber: 'B12', zone: '쁘띠존' });
  });

  it('keeps heuristic values when the AI has none', () => {
    const state = draftReducer(start(), { type: 'applyAI', outcome: outcome({}), events: EVENTS });
    expect(state.draft.boothNumber).toBe('B-12');
  });

  it('switches to an event the AI matched, unless the user picked one', () => {
    const matched = draftReducer(start(), {
      type: 'applyAI',
      outcome: outcome({ eventName: 'コミケ108' }),
      events: EVENTS,
    });
    expect(matched.draft.eventId).toBe('ev2');
    expect(matched.eventOrigin).toBe('ai');

    const picked = draftReducer(draftReducer(start(), { type: 'set', patch: { eventId: 'ev1' } }), {
      type: 'applyAI',
      outcome: outcome({ eventName: 'コミケ108' }),
      events: EVENTS,
    });
    expect(picked.draft.eventId).toBe('ev1');
  });

  it('names a new event and takes its currency from the AI', () => {
    const state = draftReducer(
      initialDraft({ snapshot: null, events: [], defaultCurrency: 'KRW' }),
      { type: 'applyAI', outcome: outcome({ eventName: 'Anime Expo 2026' }, 'USD'), events: [] }
    );
    expect(state.draft).toMatchObject({
      eventId: NEW_EVENT,
      newEventName: 'Anime Expo 2026',
      newEventCurrency: 'USD',
    });
  });
});

describe('links', () => {
  it('toggles, adds and removes links', () => {
    let state = start();
    state = draftReducer(state, { type: 'toggleLink', url: 'https://witchform.com/example' });
    expect(state.draft.links.every((l) => !l.included)).toBe(true);
    state = draftReducer(state, { type: 'addLink', url: 'forms.gle/abc' });
    expect(state.draft.links.at(-1)).toMatchObject({ url: 'https://forms.gle/abc', included: true, custom: true });
    state = draftReducer(state, { type: 'addLink', url: 'not a url' });
    state = draftReducer(state, { type: 'removeLink', url: 'https://forms.gle/abc' });
    expect(state.draft.links.some((l) => l.custom)).toBe(false);
  });

  it('normalizes typed links', () => {
    expect(normalizeLinkInput(' https://a.example/x ')).toBe('https://a.example/x');
    expect(normalizeLinkInput('a.example')).toBe('https://a.example');
    expect(normalizeLinkInput('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkInput('hello')).toBeNull();
  });
});

describe('validation and booth fields', () => {
  it('requires an event, a circle and a booth number or mail order', () => {
    const { draft } = start();
    expect(draftErrors(draft, EVENTS)).toEqual([]);
    expect(
      draftErrors({ ...draft, eventId: NEW_EVENT, newEventName: ' ', circleName: '', boothNumber: '', isMailOrder: false }, EVENTS)
    ).toEqual(['event', 'circleName', 'boothNumber']);
    expect(draftErrors({ ...draft, boothNumber: '', isMailOrder: true }, EVENTS)).toEqual([]);
  });

  it('uses the mail-order label when there is no booth number', () => {
    const { draft } = start();
    const fields = boothFields({
      draft: { ...draft, boothNumber: '', isMailOrder: true },
      snapshot: SNAPSHOT,
      imageUrls: ['https://img.example/a.jpg'],
      mailOrderLabel: 'MAIL',
    });
    expect(fields).toMatchObject({
      boothNumber: 'MAIL',
      circleName: '달빛서클',
      sourceUrl: SNAPSHOT.url,
      formUrl: 'https://witchform.com/example',
      imageUrls: ['https://img.example/a.jpg'],
      sourceText: SNAPSHOT.text,
      memo: null,
      zone: null,
    });
  });

  it("saves the post's canonical URL as the source when the capture has one", () => {
    const { draft } = start();
    // Right-clicking a status link on the X home timeline.
    const fromTimeline = {
      ...SNAPSHOT,
      url: 'https://x.com/home',
      canonicalUrl: 'https://x.com/moonlight_circle/status/1',
    };
    const input = { draft, imageUrls: [], mailOrderLabel: 'MAIL' };
    expect(boothFields({ ...input, snapshot: fromTimeline }).sourceUrl).toBe(
      'https://x.com/moonlight_circle/status/1'
    );
    expect(boothFields({ ...input, snapshot: { ...SNAPSHOT, canonicalUrl: null } }).sourceUrl).toBe(SNAPSHOT.url);
    expect(boothFields({ ...input, snapshot: null }).sourceUrl).toBeNull();
  });

  it('resolves the event currency for new and existing events', () => {
    const { draft } = start();
    expect(draftEventCurrency(draft, EVENTS)).toBe('KRW');
    expect(draftEventCurrency({ ...draft, eventId: 'ev2' }, EVENTS)).toBe('JPY');
    expect(draftEventCurrency({ ...draft, eventId: NEW_EVENT, newEventCurrency: 'twd' }, EVENTS)).toBe('TWD');
  });
});

describe('saveCapture', () => {
  let name = '';
  afterEach(async () => {
    if (name) await Dexie.delete(name);
  });

  it('writes the new event, booth and items in one go, with per-item currency', async () => {
    name = `acorn-save-capture-${Date.now()}`;
    const database = createAppDatabase(name);
    await database.open();
    const rows = reviewReducer([], {
      type: 'sync',
      rows: [
        {
          key: '0:a',
          item: { name: '아크릴 키링', originalName: null, price: 5000, category: 'keyring', options: ['A 루나', 'B 솔'] },
          currency: 'KRW',
        },
        {
          key: '1:b',
          item: { name: '신간', originalName: '新刊「星の庭」', price: 800, category: 'book', options: [] },
          currency: 'JPY',
        },
      ],
    });
    const state = draftReducer(start(), {
      type: 'set',
      patch: { eventId: NEW_EVENT, newEventName: '서코 가을', newEventCurrency: 'KRW' },
    });

    const result = await saveCapture({
      draft: state.draft,
      events: EVENTS,
      snapshot: SNAPSHOT,
      imageUrls: [],
      mailOrderLabel: 'MAIL',
      rows,
      badgeId: 'purchase',
      now: 1000,
      database,
    });

    const event = await database.events.get(result.eventId);
    expect(event).toMatchObject({ name: '서코 가을', currency: 'KRW' });
    const booth = await database.booths.get(result.boothId);
    expect(booth).toMatchObject({ eventId: result.eventId, boothNumber: 'B-12', order: 0, imageUrls: null });
    const items = await database.items.where('boothId').equals(result.boothId).sortBy('createdAt');
    expect(items.map((i) => [i.name, i.currency, i.option])).toEqual([
      ['아크릴 키링', null, 'A 루나'],
      ['신간', 'JPY', null],
    ]);
    expect(result.itemCount).toBe(2);
    database.close();
  });
});

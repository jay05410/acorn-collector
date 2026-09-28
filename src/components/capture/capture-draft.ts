/**
 * Booth draft of the capture review sheet (pure, unit-tested): the instant
 * heuristic prefill from a PageSnapshot, the AI fill that never overwrites
 * what the user edited, validation and the records to save.
 */
import { normalizeCurrencyCode } from '@/i18n/format';
import type { ExtractionOutcome } from '@/hooks/useExtraction';
import type { PageSnapshot } from '@/lib/capture/types';
import { matchEvent, parseBoothText, type LinkKind } from '@/lib/parser/text';
import { resolveEventCurrency } from '@/lib/utils';
import type { Booth, Event } from '@/types';

/** Select value of the "new event" choice. */
export const NEW_EVENT = '__new__';

export interface DraftLink {
  url: string;
  kind: LinkKind;
  included: boolean;
  /** Added by the user (can be removed). */
  custom: boolean;
}

export interface BoothDraft {
  /** An existing event id, or NEW_EVENT. */
  eventId: string;
  newEventName: string;
  newEventCurrency: string;
  boothNumber: string;
  circleName: string;
  zone: string;
  isMailOrder: boolean;
  links: DraftLink[];
  memo: string;
}

export type DraftField = keyof BoothDraft;

/** Where the current event choice came from (shown as a hint). */
export type EventOrigin = 'preselected' | 'post' | 'ai' | 'default' | 'user';

export interface DraftState {
  draft: BoothDraft;
  /** Fields the user changed; AI results never overwrite them. */
  touched: readonly DraftField[];
  eventOrigin: EventOrigin;
}

export interface EventRef {
  id: string;
  name: string;
}

export interface InitialDraftOptions {
  snapshot: PageSnapshot | null;
  events: readonly EventRef[];
  /** "Add booth" inside an event. */
  preselectedEventId?: string | null;
  /** Event to fall back to (e.g. the one last viewed). */
  fallbackEventId?: string | null;
  /** Currency for a new event before the AI suggests one. */
  defaultCurrency: string;
}

/** "name @handle", from which the parser reads the circle name. */
export function authorLabel(author: PageSnapshot['author']): string | undefined {
  if (!author) return undefined;
  const handle = author.handle ? `@${author.handle.replace(/^@/, '')}` : null;
  const label = [author.name, handle].filter(Boolean).join(' ');
  return label || undefined;
}

/** Original-language text the parser and the AI read. */
export function snapshotText(snapshot: PageSnapshot | null): string {
  if (!snapshot) return '';
  return snapshot.text || snapshot.selection || '';
}

export function initialDraft(options: InitialDraftOptions): DraftState {
  const { snapshot, events } = options;
  const known = (id: string | null | undefined): id is string =>
    Boolean(id) && events.some((event) => event.id === id);
  const parsed = snapshot
    ? parseBoothText(snapshotText(snapshot), {
        author: authorLabel(snapshot.author),
        links: snapshot.links,
        existingEvents: events,
      })
    : null;

  let eventId = NEW_EVENT;
  let newEventName = '';
  let eventOrigin: EventOrigin = 'default';
  if (known(options.preselectedEventId)) {
    eventId = options.preselectedEventId;
    eventOrigin = 'preselected';
  } else if (parsed?.matchedEvent && known(parsed.matchedEvent.id)) {
    eventId = parsed.matchedEvent.id;
    eventOrigin = 'post';
  } else if (parsed?.eventHint) {
    newEventName = parsed.eventHint;
    eventOrigin = 'post';
  } else if (known(options.fallbackEventId)) {
    eventId = options.fallbackEventId;
  } else if (events[0]) {
    eventId = events[0].id;
  }

  const formUrls = new Set((parsed?.formUrl ?? '').split('\n').filter(Boolean));
  return {
    draft: {
      eventId,
      newEventName,
      newEventCurrency: options.defaultCurrency,
      boothNumber: parsed?.boothNumber ?? '',
      circleName: parsed?.circleName ?? '',
      zone: parsed?.zone ?? '',
      isMailOrder: parsed?.isMailOrder ?? false,
      links: (parsed?.links ?? []).map((link) => ({
        url: link.url,
        kind: link.kind,
        included: formUrls.has(link.url),
        custom: false,
      })),
      memo: '',
    },
    touched: [],
    eventOrigin,
  };
}

export type DraftAction =
  | { type: 'set'; patch: Partial<BoothDraft> }
  | { type: 'toggleLink'; url: string }
  | { type: 'addLink'; url: string }
  | { type: 'removeLink'; url: string }
  | { type: 'applyAI'; outcome: ExtractionOutcome; events: readonly EventRef[] };

function touch(touched: readonly DraftField[], fields: readonly DraftField[]): DraftField[] {
  return [...new Set([...touched, ...fields])];
}

/** Normalizes a typed link; null when it is not an http(s) URL. */
export function normalizeLinkInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname.includes('.') ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * AI booth fields fill only what the user has not edited: a value the AI
 * found replaces the heuristic one, a missing value leaves it alone.
 */
function applyAI(state: DraftState, outcome: ExtractionOutcome, events: readonly EventRef[]): DraftState {
  const untouched = (field: DraftField) => !state.touched.includes(field);
  const draft = { ...state.draft };
  let { eventOrigin } = state;
  const { booth, currency } = outcome;

  if (booth.boothNumber && untouched('boothNumber')) draft.boothNumber = booth.boothNumber;
  if (booth.circleName && untouched('circleName')) draft.circleName = booth.circleName;
  if (booth.zone && untouched('zone')) draft.zone = booth.zone;
  if (booth.isMailOrder && untouched('isMailOrder')) draft.isMailOrder = true;

  const code = normalizeCurrencyCode(currency);
  if (code && untouched('newEventCurrency')) draft.newEventCurrency = code;

  const canChangeEvent =
    untouched('eventId') && eventOrigin !== 'preselected' && eventOrigin !== 'user';
  if (booth.eventName && canChangeEvent) {
    const match = matchEvent(booth.eventName, events);
    if (match) {
      // A post-matched event stays unless the AI names a different one.
      draft.eventId = match.event.id;
      eventOrigin = 'ai';
    } else if (draft.eventId === NEW_EVENT || eventOrigin === 'default') {
      draft.eventId = NEW_EVENT;
      if (untouched('newEventName') || draft.newEventName.trim() === '') {
        draft.newEventName = booth.eventName;
      }
      eventOrigin = 'ai';
    }
  }
  return { ...state, draft, eventOrigin };
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'set': {
      const fields = Object.keys(action.patch) as DraftField[];
      return {
        draft: { ...state.draft, ...action.patch },
        touched: touch(state.touched, fields),
        eventOrigin: fields.includes('eventId') ? 'user' : state.eventOrigin,
      };
    }
    case 'toggleLink':
      return {
        ...state,
        draft: {
          ...state.draft,
          links: state.draft.links.map((link) =>
            link.url === action.url ? { ...link, included: !link.included } : link
          ),
        },
        touched: touch(state.touched, ['links']),
      };
    case 'addLink': {
      const url = normalizeLinkInput(action.url);
      if (!url || state.draft.links.some((link) => link.url === url)) return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          links: [...state.draft.links, { url, kind: 'other', included: true, custom: true }],
        },
        touched: touch(state.touched, ['links']),
      };
    }
    case 'removeLink':
      return {
        ...state,
        draft: {
          ...state.draft,
          links: state.draft.links.filter((link) => link.url !== action.url),
        },
        touched: touch(state.touched, ['links']),
      };
    case 'applyAI':
      return applyAI(state, action.outcome, action.events);
  }
}

// ---------------------------------------------------------------------------
// Validation and saving

export type DraftError = 'event' | 'circleName' | 'boothNumber';

export function draftErrors(draft: BoothDraft, events: readonly EventRef[]): DraftError[] {
  const errors: DraftError[] = [];
  const eventOk =
    draft.eventId === NEW_EVENT
      ? draft.newEventName.trim() !== ''
      : events.some((event) => event.id === draft.eventId);
  if (!eventOk) errors.push('event');
  if (!draft.circleName.trim()) errors.push('circleName');
  if (!draft.boothNumber.trim() && !draft.isMailOrder) errors.push('boothNumber');
  return errors;
}

/** Currency items of this booth are priced in by default. */
export function draftEventCurrency(
  draft: BoothDraft,
  events: readonly Pick<Event, 'id' | 'currency'>[]
): string {
  if (draft.eventId === NEW_EVENT) {
    return normalizeCurrencyCode(draft.newEventCurrency) ?? resolveEventCurrency(null);
  }
  return resolveEventCurrency(events.find((event) => event.id === draft.eventId)?.currency);
}

export interface BoothRecordInput {
  draft: BoothDraft;
  snapshot: PageSnapshot | null;
  /** Images the user kept. */
  imageUrls: readonly string[];
  /** Booth number used for mail-order booths without one. */
  mailOrderLabel: string;
}

export type BoothFields = Omit<Booth, 'id' | 'eventId' | 'order' | 'createdAt' | 'updatedAt'>;

export function boothFields({
  draft,
  snapshot,
  imageUrls,
  mailOrderLabel,
}: BoothRecordInput): BoothFields {
  const links = draft.links.filter((link) => link.included).map((link) => link.url);
  const text = snapshot?.text.trim() ?? '';
  return {
    boothNumber: draft.boothNumber.trim() || (draft.isMailOrder ? mailOrderLabel : ''),
    circleName: draft.circleName.trim(),
    zone: draft.zone.trim() || null,
    // The post's permalink: `url` can be the page it was captured from (e.g.
    // the X home timeline when a status link was right-clicked).
    sourceUrl: snapshot ? (snapshot.canonicalUrl ?? snapshot.url) : null,
    formUrl: links.length > 0 ? links.join('\n') : null,
    memo: draft.memo.trim() || null,
    imageUrls: imageUrls.length > 0 ? [...imageUrls] : null,
    sourceText: text || null,
  };
}

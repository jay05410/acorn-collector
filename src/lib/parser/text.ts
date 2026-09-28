/**
 * Static judgment: the instant, offline, zero-cost heuristic that pre-fills
 * booth info from post text before (or without) any AI call.
 *
 * Pipeline (order matters, see the ACORN-11 bug note on detectMailOrder):
 *   normalize (NFKC, dashes) -> links -> events -> booth candidates ->
 *   mail order / day / sale mode -> circle -> zone -> confidence.
 */
import type { ParsedBooth } from '@/types';
import {
  BOOTH_MIN_CONFIDENCE,
  findBoothCandidates,
  isBoothCode,
  maskLinksAndHandles,
  type BoothCandidate,
  type BoothSource,
} from './booth';
import { circleFromAuthorName, extractLabeledCircle, splitAuthor } from './circle';
import {
  detectEvents,
  eventConfidence,
  matchEvent,
  pickEvent,
  type DetectedEvent,
  type EventRef,
} from './events';
import { extractLinks, pickFormLinks, type ClassifiedLink } from './links';
import { clamp01, normalizeText, round2 } from './normalize';
import {
  detectDay,
  detectMailOrder,
  detectSaleMode,
  detectZone,
  type SaleMode,
  type Weekday,
} from './signals';

export type { BoothCandidate, BoothSource } from './booth';
export type { ClassifiedLink, LinkKind } from './links';
export type { DetectedEvent, EventMatch, EventRef } from './events';
export type { SaleMode, Weekday } from './signals';
export { EVENT_MATCH_THRESHOLD, detectEvents, matchEvent } from './events';
export { classifyUrl, cleanUrl, extractLinks } from './links';

export interface ParseOptions {
  /** Author display string, e.g. "달빛서클 @moon" or "山田@C108 1日目東ホ-12a". */
  author?: string;
  /** Outbound links captured from the DOM (PageSnapshot.links). */
  links?: readonly string[];
  /** When given, `matchedEvent` is filled from these. */
  existingEvents?: readonly EventRef[];
}

export interface FieldConfidence {
  eventHint: number;
  boothNumber: number;
  circleName: number;
  zone: number;
  formUrl: number;
  isMailOrder: number;
  dayHint: number;
}

/** ParsedBooth plus the richer static-judgment fields (all additive). */
export interface StaticJudgment extends ParsedBooth {
  /** Sold by mail order / online (통판, 通販, 通贩, mail order ...). */
  isMailOrder: boolean;
  /** Day marker as written: "2日目", "Day 2", "토요일", "周六". */
  dayHint?: string;
  /** 1-based event day when written as an ordinal. */
  dayIndex?: number;
  weekday?: Weekday;
  /** Pre-order (선입금, 予約, 预售) vs on-site (현장판매, 当日頒布). */
  saleMode?: SaleMode;
  /** Dictionary id of the detected event, e.g. "comiket". */
  eventKey?: string;
  /** Edition number or year of the detected event, e.g. 108 for C108. */
  eventNumber?: number;
  /** Best existing event for `eventHint` (only with options.existingEvents). */
  matchedEvent?: { id: string; name: string; score: number };
  /** Every outbound link, classified; formUrl is derived from these. */
  links: ClassifiedLink[];
  /** Ranked alternatives for the booth field, best first (max 5). */
  boothCandidates: Array<{ value: string; source: BoothSource; confidence: number }>;
  fieldConfidence: FieldConfidence;
}

/** Weights of the overall confidence; the fields a booth card needs most. */
const WEIGHTS = { boothNumber: 0.4, circleName: 0.3, eventHint: 0.2, formUrl: 0.1 } as const;

interface EventChoice {
  hint: string;
  confidence: number;
  detected?: DetectedEvent;
}

function chooseEvent(
  candidates: readonly BoothCandidate[],
  bodyEvents: readonly DetectedEvent[],
  authorEvents: readonly DetectedEvent[],
  context: string
): EventChoice | undefined {
  const options: EventChoice[] = [];
  for (const c of candidates) {
    if (c.source !== 'bracket' || !c.eventHint) continue;
    const detected = pickEvent(detectEvents(c.eventHint, context));
    options.push({
      hint: c.eventHint,
      confidence: detected && !detected.generic ? 0.9 : 0.6,
      detected,
    });
  }
  const body = pickEvent(bodyEvents);
  if (body) options.push({ hint: body.hint, confidence: eventConfidence(body), detected: body });
  const fromAuthor = pickEvent(authorEvents);
  if (fromAuthor) {
    options.push({
      hint: fromAuthor.hint,
      confidence: eventConfidence(fromAuthor) * 0.85,
      detected: fromAuthor,
    });
  }
  let best: EventChoice | undefined;
  for (const o of options) if (!best || o.confidence > best.confidence) best = o;
  return best;
}

export function parseBoothText(text: string, options?: ParseOptions): StaticJudgment {
  const norm = normalizeText(text ?? '');
  const scan = maskLinksAndHandles(norm);

  // Author: display name + any event info after "@". A bare handle is no info.
  const author = options?.author ? splitAuthor(options.author) : undefined;
  const authorInfo = author && !author.nameIsHandle ? normalizeText(`${author.name} ${author.tail}`) : '';

  // Links first: they are masked out of everything below.
  const links = extractLinks(norm, options?.links ?? []);
  const form = pickFormLinks(links);

  // Events before booths: C108 / CP29 / FF42 look like booth codes.
  const events = detectEvents(scan);
  const bodyCandidates = findBoothCandidates(norm, events);
  const authorEvents = authorInfo ? detectEvents(authorInfo, `${norm}\n${authorInfo}`) : [];
  const authorCandidates = authorInfo
    ? findBoothCandidates(authorInfo, authorEvents).map((c) => ({
        ...c,
        source: 'author' as const,
        confidence: round2(c.confidence * 0.85),
      }))
    : [];

  const physical =
    [...bodyCandidates, ...authorCandidates]
      .filter((c) => c.confidence >= BOOTH_MIN_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence)[0] ?? undefined;

  // Mail order is a flag; it becomes the booth number only without a
  // physical booth. (v1 checked it first, so "[서코/B-12] … 통판 폼" lost B-12.)
  const mail = detectMailOrder(author?.tail ? `${scan}\n${author.tail}` : scan, physical !== undefined);

  const result: StaticJudgment = {
    confidence: 0,
    isMailOrder: mail.isMailOrder,
    links,
    boothCandidates: [],
    fieldConfidence: {
      eventHint: 0,
      boothNumber: 0,
      circleName: 0,
      zone: 0,
      formUrl: 0,
      isMailOrder: round2(mail.confidence),
      dayHint: 0,
    },
  };
  const fc = result.fieldConfidence;

  if (physical) {
    result.boothNumber = physical.value;
    fc.boothNumber = physical.confidence;
  } else if (mail.isMailOrder && mail.label) {
    result.boothNumber = mail.label;
    fc.boothNumber = 0.5;
  }
  result.boothCandidates = [...bodyCandidates, ...authorCandidates]
    .sort((a, b) => b.confidence - a.confidence)
    .filter((c, i, all) => all.findIndex((o) => o.value === c.value) === i)
    .slice(0, 5)
    .map(({ value, source, confidence }) => ({ value, source, confidence }));

  const event = chooseEvent(bodyCandidates, events, authorEvents, norm);
  if (event) {
    result.eventHint = event.hint;
    fc.eventHint = round2(event.confidence);
    if (event.detected) {
      result.eventKey = event.detected.id;
      if (event.detected.number !== undefined) result.eventNumber = event.detected.number;
    }
    if (options?.existingEvents?.length) {
      const m = matchEvent(event.hint, options.existingEvents);
      if (m) result.matchedEvent = { id: m.event.id, name: m.event.name, score: m.score };
    }
  }

  const day = detectDay(scan).dayHint ? detectDay(scan) : detectDay(authorInfo);
  if (day.dayHint) {
    result.dayHint = day.dayHint;
    fc.dayHint = day.dayIndex !== undefined ? 0.85 : 0.7;
  }
  if (day.dayIndex !== undefined) result.dayIndex = day.dayIndex;
  if (day.weekday) result.weekday = day.weekday;

  const saleMode = detectSaleMode(scan);
  if (saleMode) result.saleMode = saleMode;

  const labeled = extractLabeledCircle(scan);
  if (labeled) {
    result.circleName = labeled;
    fc.circleName = 0.85;
  } else if (author) {
    const fromAuthor = circleFromAuthorName(author.name);
    if (fromAuthor) {
      result.circleName = fromAuthor;
      fc.circleName = 0.6;
    }
  }

  const zone = detectZone(scan);
  if (zone) {
    result.zone = zone;
    fc.zone = 0.6;
  }

  if (form.formUrl) {
    result.formUrl = form.formUrl;
    fc.formUrl = form.confidence;
  }

  result.confidence = round2(
    clamp01(
      WEIGHTS.boothNumber * fc.boothNumber +
        WEIGHTS.circleName * fc.circleName +
        WEIGHTS.eventHint * fc.eventHint +
        WEIGHTS.formUrl * fc.formUrl
    )
  );
  return result;
}

/**
 * True for a physical booth code in any supported convention: "A-01", "B12",
 * "AA-214", "東ホ-12a", "홀1-B32", "き18a", "1234". Mail-order labels are not
 * booth codes.
 */
export function isValidBoothNumber(boothNumber: string): boolean {
  return isBoothCode(boothNumber);
}

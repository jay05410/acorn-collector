/**
 * Sponsor feed schema v1 and its strict validator.
 *
 * The feed is plain JSON data fetched from a static host (never code). Every
 * string is sanitized and later rendered as React text, never as HTML. A bad
 * envelope rejects the whole feed; a bad creative is skipped on its own so one
 * typo cannot take every sponsor offline.
 */
import { APP_LANGUAGES, type AppLanguage } from '@/i18n/languages';
import { HttpsUrlError, parseHttpsUrl } from '@/lib/https-url';

export const PLACEMENTS = ['footer', 'analysis', 'settings'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export type CreativeLocale = '*' | AppLanguage;

export interface Creative {
  id: string;
  placements: readonly Placement[];
  /** '*' for every language, or app language codes. */
  locales: readonly CreativeLocale[];
  title: string;
  body?: string;
  imageUrl?: string;
  clickUrl: string;
  cta?: string;
  /** ISO 8601 date-time with a time zone. */
  startsAt?: string;
  endsAt?: string;
  /** Relative selection weight, integer 1-100 (default 1). */
  weight?: number;
  sponsorName: string;
}

export interface SponsorFeed {
  version: 1;
  updatedAt: string;
  creatives: readonly Creative[];
}

export interface FeedIssue {
  /** Position in the source `creatives` array. */
  index: number;
  id?: string;
  reason: string;
}

export interface ParsedFeed {
  feed: SponsorFeed;
  /** Creatives that were skipped, with the reason. For the feed author. */
  issues: FeedIssue[];
}

export interface FeedValidationOptions {
  /** Hosts images may load from; when omitted any https host is accepted. */
  imageHosts?: readonly string[];
}

export const LIMITS = {
  id: 64,
  title: 60,
  body: 120,
  cta: 24,
  sponsorName: 40,
  url: 2048,
  creatives: 50,
  weightMin: 1,
  weightMax: 100,
} as const;

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
/** C0/C1 control characters (newlines, tabs, NUL...): become spaces. */
// eslint-disable-next-line no-control-regex -- matching controls is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
/**
 * Invisible format characters that could hide or reorder what the user
 * reads (zero-width, bidi embeddings/overrides/isolates, BOM): removed.
 * ZWJ (U+200D) is kept for emoji sequences.
 */
const INVISIBLE_CHARS =
  /[\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

const PLACEMENT_SET: ReadonlySet<string> = new Set(PLACEMENTS);
const LOCALE_SET: ReadonlySet<string> = new Set<string>([
  '*',
  ...APP_LANGUAGES,
]);

export class SponsorFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SponsorFeedError';
  }
}

/** Thrown per creative and turned into a FeedIssue. */
class CreativeError extends Error {}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Removes invisible/control characters and collapses whitespace. */
export function sanitizeText(value: string): string {
  return value
    .replace(CONTROL_CHARS, ' ')
    .replace(INVISIBLE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Length in code points, so one CJK character or emoji counts once. */
function length(value: string): number {
  return [...value].length;
}

function requiredText(raw: UnknownRecord, field: string, max: number): string {
  const value = raw[field];
  if (typeof value !== 'string') throw new CreativeError(`${field}: missing`);
  const clean = sanitizeText(value);
  if (!clean) throw new CreativeError(`${field}: empty`);
  if (length(clean) > max)
    throw new CreativeError(`${field}: longer than ${max} characters`);
  return clean;
}

/** JSON null counts as absent for optional fields ("body": null). */
function isAbsent(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}

function optionalText(
  raw: UnknownRecord,
  field: string,
  max: number
): string | undefined {
  if (isAbsent(raw[field])) return undefined;
  return requiredText(raw, field, max);
}

/** Parses an ISO 8601 date-time with zone; rejects impossible dates. */
export function parseIsoDateTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, offH, offM] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const calendar = new Date(Date.UTC(y, m - 1, d));
  if (
    calendar.getUTCFullYear() !== y ||
    calendar.getUTCMonth() !== m - 1 ||
    calendar.getUTCDate() !== d ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second ?? 0) > 59 ||
    Number(offH ?? 0) > 23 ||
    Number(offM ?? 0) > 59
  ) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function optionalDate(raw: UnknownRecord, field: string): string | undefined {
  const value = raw[field];
  if (isAbsent(value)) return undefined;
  if (parseIsoDateTime(value) === null)
    throw new CreativeError(`${field}: not an ISO 8601 date-time with zone`);
  return value as string;
}

function httpsUrl(value: unknown, field: string): URL {
  if (typeof value !== 'string' || value.length > LIMITS.url)
    throw new CreativeError(`${field}: missing or too long`);
  try {
    return parseHttpsUrl(value);
  } catch (error) {
    if (error instanceof HttpsUrlError)
      throw new CreativeError(`${field}: ${error.message}`);
    throw error;
  }
}

function imageUrl(
  value: unknown,
  imageHosts: readonly string[] | undefined
): string | undefined {
  if (isAbsent(value)) return undefined;
  const url = httpsUrl(value, 'imageUrl');
  if (!IMAGE_EXTENSIONS.test(url.pathname))
    throw new CreativeError('imageUrl: must be .png, .jpg, .jpeg or .webp');
  if (imageHosts && !imageHosts.includes(url.host))
    throw new CreativeError(`imageUrl: host ${url.host} is not allowed`);
  return url.href;
}

function stringList<T extends string>(
  value: unknown,
  field: string,
  allowed: ReadonlySet<string>
): T[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new CreativeError(`${field}: must be a non-empty array`);
  for (const entry of value) {
    if (typeof entry !== 'string' || !allowed.has(entry))
      throw new CreativeError(`${field}: unknown value ${String(entry)}`);
  }
  return [...new Set(value as T[])];
}

function weight(value: unknown): number | undefined {
  if (isAbsent(value)) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < LIMITS.weightMin ||
    value > LIMITS.weightMax
  ) {
    throw new CreativeError(
      `weight: must be an integer ${LIMITS.weightMin}-${LIMITS.weightMax}`
    );
  }
  return value;
}

function parseCreative(raw: unknown, options: FeedValidationOptions): Creative {
  if (!isRecord(raw)) throw new CreativeError('not an object');
  const id = raw.id;
  if (typeof id !== 'string' || id.length > LIMITS.id || !ID_PATTERN.test(id)) {
    throw new CreativeError('id: letters, digits, "-" or "_" (max 64)');
  }
  const startsAt = optionalDate(raw, 'startsAt');
  const endsAt = optionalDate(raw, 'endsAt');
  if (
    startsAt !== undefined &&
    endsAt !== undefined &&
    (parseIsoDateTime(endsAt) ?? 0) <= (parseIsoDateTime(startsAt) ?? 0)
  ) {
    throw new CreativeError('endsAt: must be after startsAt');
  }

  const creative: Creative = {
    id,
    placements: stringList<Placement>(
      raw.placements,
      'placements',
      PLACEMENT_SET
    ),
    locales: stringList<CreativeLocale>(raw.locales, 'locales', LOCALE_SET),
    title: requiredText(raw, 'title', LIMITS.title),
    clickUrl: httpsUrl(raw.clickUrl, 'clickUrl').href,
    sponsorName: requiredText(raw, 'sponsorName', LIMITS.sponsorName),
  };
  // Absent optional fields stay absent, so a validated feed re-validates to
  // an identical object (the cache stores validated feeds).
  const body = optionalText(raw, 'body', LIMITS.body);
  const image = imageUrl(raw.imageUrl, options.imageHosts);
  const cta = optionalText(raw, 'cta', LIMITS.cta);
  const selectionWeight = weight(raw.weight);
  if (body !== undefined) creative.body = body;
  if (image !== undefined) creative.imageUrl = image;
  if (cta !== undefined) creative.cta = cta;
  if (startsAt !== undefined) creative.startsAt = startsAt;
  if (endsAt !== undefined) creative.endsAt = endsAt;
  if (selectionWeight !== undefined) creative.weight = selectionWeight;
  return creative;
}

/**
 * Validates untrusted feed JSON. Throws SponsorFeedError when the envelope is
 * wrong; otherwise returns the valid creatives (first of each id wins, at most
 * LIMITS.creatives) and an issue per skipped one. Unknown fields are ignored so
 * later schema additions stay readable by this version.
 */
export function parseSponsorFeed(
  raw: unknown,
  options: FeedValidationOptions = {}
): ParsedFeed {
  if (!isRecord(raw)) throw new SponsorFeedError('feed is not an object');
  if (raw.version !== 1) throw new SponsorFeedError('unsupported feed version');
  if (parseIsoDateTime(raw.updatedAt) === null)
    throw new SponsorFeedError('updatedAt is not an ISO 8601 date-time');
  if (!Array.isArray(raw.creatives))
    throw new SponsorFeedError('creatives is not an array');

  const creatives: Creative[] = [];
  const issues: FeedIssue[] = [];
  const seen = new Set<string>();
  raw.creatives.forEach((entry: unknown, index) => {
    const id =
      isRecord(entry) && typeof entry.id === 'string' ? entry.id : undefined;
    try {
      if (creatives.length >= LIMITS.creatives)
        throw new CreativeError(`more than ${LIMITS.creatives} creatives`);
      const creative = parseCreative(entry, options);
      if (seen.has(creative.id)) throw new CreativeError('duplicate id');
      seen.add(creative.id);
      creatives.push(creative);
    } catch (error) {
      if (!(error instanceof CreativeError)) throw error;
      issues.push({ index, id, reason: error.message });
    }
  });

  return {
    feed: { version: 1, updatedAt: raw.updatedAt as string, creatives },
    issues,
  };
}

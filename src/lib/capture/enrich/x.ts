/**
 * Original (untranslated) X post text. X may auto-translate the text it
 * renders, so the DOM copy is not trustworthy as the source language.
 *
 * Sources, both unofficial and best effort:
 * 1. cdn.syndication.twimg.com/tweet-result (the embed widget's endpoint).
 *    As observed on 2026-09-29: live posts return 200 JSON, a missing token
 *    returns 200 `{}`, deleted posts return 404; the token is required but
 *    any non-empty value was accepted. Long posts (`note_tweet`) are
 *    truncated there.
 * 2. og:description of the logged-out status page, used when (1) fails or
 *    is truncated. Requested in parallel with (1) so a fallback costs no
 *    extra round trip; not awaited when (1) is complete.
 * Any failure falls back to the DOM text.
 */
import { decodeHtmlEntities, parseMetaTagsFromHtml } from '../meta';
import { normalizeSnapshot } from '../snapshot';
import { parseXStatusId, xStatusUrl } from '../sites/x';
import type { CapturedImage, PageSnapshot } from '../types';
import { isRecord } from '../util';
import { type EnrichDeps, fetchJson, fetchText, stringOr } from './http';

/** Token derivation used by the embed widget (as in vercel/react-tweet). */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export function syndicationUrl(id: string): string {
  return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}`;
}

export interface TweetOriginal {
  id: string;
  text: string;
  lang: string | null;
  /** True for long posts, whose syndication text is cut short. */
  truncated: boolean;
  author: { name: string | null; handle: string | null } | null;
  publishedAt: string | null;
  photos: CapturedImage[];
  /** Expanded targets of the post's t.co links. */
  links: string[];
  /** t.co URL (https form) -> expanded target, for the post's own links. */
  expansions: Record<string, string>;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && value > 0 ? value : undefined;
}

function photosOf(tweet: Record<string, unknown>): CapturedImage[] {
  const photos = records(tweet.photos)
    .map((photo): CapturedImage | null => {
      const url = stringOr(photo.url);
      if (!url) return null;
      const image: CapturedImage = { url };
      const width = positiveNumber(photo.width);
      const height = positiveNumber(photo.height);
      if (width) image.width = width;
      if (height) image.height = height;
      return image;
    })
    .filter((photo): photo is CapturedImage => photo !== null);
  if (photos.length) return photos;
  // Older payloads only list media details.
  return records(tweet.mediaDetails)
    .filter((media) => media.type === 'photo')
    .map((media) => stringOr(media.media_url_https))
    .filter((url): url is string => url !== null)
    .map((url) => ({ url }));
}

const SHORT_LINK_PREFIX = 'https://t.co/';

/** t.co links appear as http:// in older payloads and https:// in the DOM. */
function shortLinkKey(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

/** Strip reply mentions, drop media t.co links, expand the other t.co links. */
function displayText(tweet: Record<string, unknown>, raw: string): {
  text: string;
  links: string[];
  expansions: Record<string, string>;
} {
  const range = Array.isArray(tweet.display_text_range) ? tweet.display_text_range : [];
  const start = typeof range[0] === 'number' ? range[0] : 0;
  // Indices count code points. Leading reply mentions contain no entities,
  // so slicing the start is safe on the raw text.
  let text = start > 0 ? Array.from(raw).slice(start).join('') : raw;

  const entities = isRecord(tweet.entities) ? tweet.entities : {};
  for (const media of records(entities.media)) {
    const url = stringOr(media.url);
    if (url) text = text.split(url).join('');
  }
  const links: string[] = [];
  const expansions: Record<string, string> = {};
  for (const entry of records(entities.urls)) {
    const url = stringOr(entry.url);
    const expanded = stringOr(entry.expanded_url);
    if (!url || !expanded) continue;
    text = text.split(url).join(expanded);
    links.push(expanded);
    expansions[shortLinkKey(url)] = expanded;
  }
  return { text: decodeHtmlEntities(text).trim(), links, expansions };
}

/**
 * Replace t.co links by their targets in place (a right-clicked link that
 * the capture put first stays first) and drop the ones the post does not
 * explain (media links).
 */
function expandShortLinks(
  links: readonly string[],
  expansions: Record<string, string>
): string[] {
  return links.flatMap((link) => {
    if (!link.startsWith(SHORT_LINK_PREFIX)) return [link];
    const target = expansions[shortLinkKey(link)];
    return target ? [target] : [];
  });
}

/** Parse a tweet-result payload; null for `{}`, tombstones and bad data. */
export function parseSyndicationTweet(payload: unknown): TweetOriginal | null {
  if (!isRecord(payload) || payload.__typename !== 'Tweet') return null;
  const id = stringOr(payload.id_str);
  const raw = typeof payload.text === 'string' ? payload.text : null;
  if (!id || raw === null) return null;

  const { text, links, expansions } = displayText(payload, raw);
  const user = isRecord(payload.user) ? payload.user : null;
  return {
    id,
    text,
    lang: stringOr(payload.lang),
    truncated: isRecord(payload.note_tweet),
    author: user
      ? { name: stringOr(user.name), handle: stringOr(user.screen_name) }
      : null,
    publishedAt: stringOr(payload.created_at),
    photos: photosOf(payload),
    links,
    expansions,
  };
}

export async function fetchSyndicationTweet(
  id: string,
  deps: EnrichDeps
): Promise<TweetOriginal | null> {
  return parseSyndicationTweet(await fetchJson(syndicationUrl(id), deps));
}

/** og:description of the logged-out status page (no cookies are sent). */
export async function fetchStatusDescription(
  id: string,
  deps: EnrichDeps
): Promise<string | null> {
  const html = await fetchText(xStatusUrl(id), deps);
  if (!html) return null;
  return parseMetaTagsFromHtml(html)['og:description']?.trim() || null;
}

/** Letters and digits only: ignores URLs, emoji, punctuation and spacing. */
export function comparableText(text: string): string {
  return text
    .replace(/(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

/**
 * Decide which text is the original. The DOM copy wins only when it is a
 * longer continuation of the original (untranslated long post). When it is
 * the same text or a cut-off prefix ("Show more"), the original is kept
 * alone; otherwise (translated) the DOM copy becomes `displayedText`.
 */
export function mergeTweetText(
  domText: string,
  original: string | null
): { text: string; displayedText: string | null } {
  if (original === null) return { text: domText, displayedText: null };
  const dom = comparableText(domText);
  const orig = comparableText(original);
  if (!dom || orig.startsWith(dom)) return { text: original, displayedText: null };
  if (orig && dom.startsWith(orig)) return { text: domText, displayedText: null };
  return { text: original, displayedText: domText };
}

function isLongerOriginal(candidate: string, current: string | null): boolean {
  if (current === null) return true;
  const next = comparableText(candidate);
  const base = comparableText(current);
  return next.length > base.length && next.startsWith(base.slice(0, 20));
}

export async function enrichXSnapshot(
  snapshot: PageSnapshot,
  deps: EnrichDeps
): Promise<PageSnapshot> {
  const id =
    parseXStatusId(snapshot.canonicalUrl ?? '') ?? parseXStatusId(snapshot.url);
  if (!id) return snapshot;

  // Both requests go out now; the status page is only waited for when the
  // syndication copy is missing or cut short.
  const statusDescription = fetchStatusDescription(id, deps).catch(() => null);
  const tweet = await fetchSyndicationTweet(id, deps);
  let original = tweet?.text ?? null;
  if (!tweet || tweet.truncated) {
    const description = await statusDescription;
    if (description && isLongerOriginal(description, original)) {
      original = description;
    }
  }
  if (!tweet && original === null) return snapshot;

  const { text, displayedText } = mergeTweetText(snapshot.text, original);
  const handle = tweet?.author?.handle ?? snapshot.author?.handle ?? null;
  const statusUrl = xStatusUrl(id, handle);
  return normalizeSnapshot({
    ...snapshot,
    url: statusUrl,
    canonicalUrl: statusUrl,
    text,
    displayedText,
    // The DOM lang attribute may describe a translation.
    lang: tweet?.lang ?? (displayedText ? null : snapshot.lang),
    author:
      snapshot.author ??
      (tweet?.author
        ? {
            name: tweet.author.name,
            handle: tweet.author.handle,
            url: tweet.author.handle ? `https://x.com/${tweet.author.handle}` : null,
          }
        : null),
    publishedAt: snapshot.publishedAt ?? tweet?.publishedAt ?? null,
    images: [...(tweet?.photos ?? []), ...snapshot.images],
    // With the original in hand, t.co links are replaced by their targets.
    links: tweet
      ? [...expandShortLinks(snapshot.links, tweet.expansions), ...tweet.links]
      : snapshot.links,
  });
}

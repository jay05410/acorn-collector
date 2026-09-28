/**
 * Result of the on-demand readability extractor (extractor.ts) and how the
 * background merges it into a snapshot. Kept free of the defuddle import so
 * the background bundle stays small.
 */
import { normalizeSnapshot } from './snapshot';
import type { PageSnapshot } from './types';

export interface ReadableResult {
  title: string | null;
  /** Main content as Markdown. */
  text: string;
  author: string | null;
  published: string | null;
  image: string | null;
  lang: string | null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** executeScript results cross a process boundary; check their shape. */
export function isReadableResult(value: unknown): value is ReadableResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.text === 'string' &&
    isNullableString(v.title) &&
    isNullableString(v.author) &&
    isNullableString(v.published) &&
    isNullableString(v.image) &&
    isNullableString(v.lang)
  );
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Main content wins as `text`; text the content script found around the
 * right-clicked element is kept in front when the article does not already
 * contain it. Metadata only fills gaps.
 */
export function mergeReadable(
  snapshot: PageSnapshot,
  readable: ReadableResult
): PageSnapshot {
  const current = snapshot.text.trim();
  const main = readable.text.trim();
  let text = current;
  if (main) {
    text = !current || squash(main).includes(squash(current))
      ? main
      : `${current}\n\n${main}`;
  }
  return normalizeSnapshot({
    ...snapshot,
    text,
    title: snapshot.title || readable.title || '',
    author:
      snapshot.author ??
      (readable.author ? { name: readable.author, handle: null, url: null } : null),
    publishedAt: snapshot.publishedAt ?? readable.published,
    lang: snapshot.lang ?? readable.lang,
    images: readable.image
      ? [...snapshot.images, { url: readable.image }]
      : snapshot.images,
  });
}
